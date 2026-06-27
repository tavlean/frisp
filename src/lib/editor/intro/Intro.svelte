<script lang="ts">
  // The landing screen: our logo over a field of soft peach blobs, with a central
  // "Drop OR Paste" target that opens the file dialog on click. Structure +
  // blob animation are adapted from Squoosh's prerendered-app/Intro (we keep
  // only the hero — no demo thumbnails, waves or info sections). The whole page
  // is already a drop target (see fileDrop in +page.svelte); this adds the
  // click-to-open and paste affordances.
  import type { Attachment } from 'svelte/attachments';
  import { asset } from '$app/paths';
  import { startBlobAnim } from './blob-anim';

  interface Props {
    /** Hand a chosen image (from the dialog or a paste) up to the page. */
    onFiles: (list: FileList | null | undefined) => void;
    /** Shown when a paste contains no image (reuses the page's snackbar). */
    onMessage?: (text: string) => void;
  }
  let { onFiles, onMessage }: Props = $props();

  const supportsClipboardRead =
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    'read' in navigator.clipboard;

  // The hidden file input, captured on mount for the open/change handlers.
  let fileInput: HTMLInputElement | undefined;
  const captureInput: Attachment<HTMLInputElement> = (node) => {
    fileInput = node;
  };

  // Blob animation (canvas). It gravitates towards the load target, so it needs
  // both the canvas and that element: capture the target into $state so the
  // canvas attachment re-runs once it's set, then start the animation from the
  // canvas attachment, returning startBlobAnim's teardown for cleanup on unmount.
  let blobTarget = $state<HTMLElement>();
  const captureBlobTarget: Attachment<HTMLElement> = (node) => {
    blobTarget = node;
  };
  const blobAnim: Attachment<HTMLCanvasElement> = (canvas) => {
    if (blobTarget) return startBlobAnim(canvas, blobTarget);
  };

  // Deliver a single File as a real FileList, so it flows through the same
  // pickFiles path as the dialog and the drop handler.
  function deliver(file: File) {
    const dt = new DataTransfer();
    dt.items.add(file);
    onFiles(dt.files);
  }

  function onOpenClick() {
    fileInput?.click();
  }

  function onFileChange() {
    if (!fileInput) return;
    onFiles(fileInput.files);
    fileInput.value = '';
  }

  async function onPasteClick() {
    if (!supportsClipboardRead) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          deliver(new File([blob], 'pasted-image', { type: blob.type }));
          return;
        }
      }
      onMessage?.('No image found on the clipboard.');
    } catch {
      onMessage?.("Couldn't read the clipboard.");
    }
  }

  // "Try a sample": draw a small sunset scene locally (gradient sky, haze
  // layers, grain) and feed it through the normal pickFiles path. Zero bytes
  // shipped, zero network — honest for a local-first app — and it lets someone
  // feel the whole flow without hunting for a file.
  async function onSampleClick() {
    const w = 1280;
    const h = 800;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#1e1b4b');
    sky.addColorStop(0.45, '#7c3aed');
    sky.addColorStop(0.72, '#fb7185');
    sky.addColorStop(1, '#fbbf24');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Sun + glow.
    const sun = ctx.createRadialGradient(
      w * 0.62,
      h * 0.58,
      10,
      w * 0.62,
      h * 0.58,
      260,
    );
    sun.addColorStop(0, 'rgba(255, 241, 197, 0.95)');
    sun.addColorStop(0.25, 'rgba(255, 199, 120, 0.55)');
    sun.addColorStop(1, 'rgba(255, 199, 120, 0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, w, h);

    // Layered mountain silhouettes with haze.
    const layers = [
      { base: 0.62, amp: 90, color: 'rgba(49, 27, 84, 0.55)', seed: 3 },
      { base: 0.72, amp: 70, color: 'rgba(35, 19, 64, 0.75)', seed: 7 },
      { base: 0.82, amp: 55, color: 'rgba(22, 12, 43, 0.95)', seed: 11 },
    ];
    for (const layer of layers) {
      ctx.fillStyle = layer.color;
      ctx.beginPath();
      ctx.moveTo(0, h);
      for (let x = 0; x <= w; x += 8) {
        const t = x / w;
        const y =
          h * layer.base -
          layer.amp *
            (0.6 * Math.sin(t * Math.PI * 2 * 1.7 + layer.seed) +
              0.3 * Math.sin(t * Math.PI * 2 * 4.3 + layer.seed * 2) +
              0.1 * Math.sin(t * Math.PI * 2 * 9.1 + layer.seed * 3));
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }

    // Fine grain so the codecs have photographic texture to work on.
    const grain = ctx.getImageData(0, 0, w, h);
    const px = grain.data;
    let noiseSeed = 1234567;
    const rand = () => {
      // xorshift — deterministic, fast, no Math.random needed.
      noiseSeed ^= noiseSeed << 13;
      noiseSeed ^= noiseSeed >>> 17;
      noiseSeed ^= noiseSeed << 5;
      return (noiseSeed >>> 0) / 0xffffffff;
    };
    for (let i = 0; i < px.length; i += 4) {
      const n = (rand() - 0.5) * 14;
      px[i] += n;
      px[i + 1] += n;
      px[i + 2] += n;
    }
    ctx.putImageData(grain, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/png'),
    );
    if (blob) {
      deliver(new File([blob], 'sample-sunset.png', { type: 'image/png' }));
    } else {
      onMessage?.("Couldn't generate the sample image.");
    }
  }

  // Catch a Cmd/Ctrl+V paste anywhere on the landing screen (clipboardData is
  // available synchronously here, no permission prompt).
  function onWindowPaste(event: ClipboardEvent) {
    const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
      f.type.startsWith('image/'),
    );
    if (file) {
      event.preventDefault();
      deliver(file);
    }
  }
</script>

<svelte:window onpaste={onWindowPaste} />

<div class="intro">
  <input
    class="hide"
    {@attach captureInput}
    type="file"
    accept="image/*"
    onchange={onFileChange}
  />

  <div class="main">
    <canvas class="blob-canvas" {@attach blobAnim} aria-hidden="true"></canvas>

    <h1 class="logo-container">
      <img
        class="logo"
        src={asset('/logo.webp')}
        alt=""
        width="128"
        height="128"
        fetchpriority="high"
      />
      <img class="wordmark" src={asset('/sqush-wordmark.svg')} alt="Sqush" />
    </h1>

    <div class="load-img" {@attach captureBlobTarget}>
      <div class="load-img-content">
        <button
          class="load-btn"
          type="button"
          onclick={onOpenClick}
          aria-label="Select an image"
        >
          <svg viewBox="0 0 18 18" class="load-icon" aria-hidden="true">
            <path
              d="M16.25 11.44L13.194 8.38395C12.122 7.31195 10.378 7.31295 9.30602 8.38395L3.47002 14.2199C3.34302 14.3459 3.27601 14.511 3.26001 14.683C3.41801 14.722 3.58002 14.75 3.75002 14.75H14.25C15.354 14.75 16.25 13.855 16.25 12.75V11.44Z"
            />
            <path
              d="M5.75 8.5C6.44 8.5 7 7.94 7 7.25C7 6.56 6.44 6 5.75 6C5.06 6 4.5 6.56 4.5 7.25C4.5 7.94 5.06 8.5 5.75 8.5Z"
            />
            <path
              d="M16.75 3H15V1.25C15 0.836 14.664 0.5 14.25 0.5C13.836 0.5 13.5 0.836 13.5 1.25V3H11.75C11.336 3 11 3.336 11 3.75C11 4.164 11.336 4.5 11.75 4.5H13.5V6.25C13.5 6.664 13.836 7 14.25 7C14.664 7 15 6.664 15 6.25V4.5H16.75C17.164 4.5 17.5 4.164 17.5 3.75C17.5 3.336 17.164 3 16.75 3Z"
            />
            <path
              d="M14.25 15.5H3.75C2.2334 15.5 1 14.2666 1 12.75V5.25C1 3.7334 2.2334 2.5 3.75 2.5H8.793C9.2071 2.5 9.543 2.8359 9.543 3.25C9.543 3.6641 9.2071 4 8.793 4H3.75C3.0605 4 2.5 4.5605 2.5 5.25V12.75C2.5 13.4395 3.0605 14 3.75 14H14.25C14.9395 14 15.5 13.4395 15.5 12.75V8.47662C15.5 8.06252 15.8359 7.72662 16.25 7.72662C16.6641 7.72662 17 8.06252 17 8.47662V12.75C17 14.2666 15.7666 15.5 14.25 15.5Z"
            />
          </svg>
        </button>
        <div class="load-text">
          <span class="drop-text">Drop</span> an image,
          {#if supportsClipboardRead}
            <button class="paste-btn" type="button" onclick={onPasteClick}
              >paste</button
            >
          {:else}
            paste
          {/if}, or click to browse
        </div>
        <button class="sample-btn" type="button" onclick={onSampleClick}>
          No image handy? Try a sample
        </button>
      </div>
    </div>

    <p class="tagline">
      Local-first image compression. Nothing leaves your device.
    </p>
    <p class="formats" aria-label="Supported output formats">
      <span>AVIF</span><span>JPEG XL</span><span>WebP</span><span>PNG</span
      ><span>JPEG</span>
    </p>
  </div>
</div>

<style>
  .intro {
    position: relative;
    min-height: 100dvh;
    display: grid;
    place-items: center;
    overflow: hidden;
    color: var(--white, #fff);
  }

  /* Ambient brand glow: pink upper-left, sky lower-right, both whisper-quiet. */
  .intro::before {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(
        42% 38% at 22% 18%,
        rgba(244, 114, 182, 0.1),
        transparent 70%
      ),
      radial-gradient(
        46% 42% at 80% 86%,
        rgba(56, 189, 248, 0.09),
        transparent 70%
      );
    pointer-events: none;
  }

  .hide {
    /* Hidden, but kept in the tab order so the load button can reach it. */
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .main {
    /* The blob colour + softness, read by the canvas animation. Soft pink. */
    --blob-color: hsl(335, 90%, 78%);
    --center-blob-opacity: 0.07;
    position: relative;
    min-height: 541px;
    display: grid;
    grid-template-rows: max-content max-content max-content;
    justify-items: center;
    align-content: center;
    padding: 24px;
  }

  .blob-canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }

  .logo-container {
    position: relative;
    margin: 0 0 1rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 20px;
  }
  .logo {
    display: block;
    width: 88px;
    height: 88px;
  }
  /* Size the wordmark by height so it locks up optically with the icon as one
     horizontal logo. Width follows the SVG's intrinsic aspect ratio. */
  .wordmark {
    display: block;
    height: 48px;
    width: auto;
    margin-top: 4px;
  }

  .load-img {
    position: relative;
    color: var(--white, #fff);
    font-size: 1.3rem;
  }

  .load-img-content {
    position: relative;
    --size: 29rem;
    width: 90vw;
    max-width: var(--size);
    height: var(--size);
    display: grid;
    grid-template-rows: max-content max-content max-content;
    justify-items: center;
    align-content: center;
    gap: 1.6rem;
  }

  /* The hero action: a brand-gradient disc that opens the file dialog. */
  .load-btn {
    --size: 8.5rem;
    width: var(--size);
    height: var(--size);
    background: linear-gradient(135deg, #f472b6, #c084fc 52%, #38bdf8);
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
    border-radius: 50%;
    box-shadow:
      0 8px 40px rgba(236, 72, 153, 0.35),
      0 2px 12px rgba(56, 189, 248, 0.25),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
    transition:
      transform 200ms cubic-bezier(0.34, 1.3, 0.64, 1),
      box-shadow 200ms ease;
  }
  .load-btn:hover {
    transform: scale(1.06);
    box-shadow:
      0 12px 56px rgba(236, 72, 153, 0.5),
      0 4px 18px rgba(56, 189, 248, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.35);
  }
  .load-btn:active {
    transform: scale(1.01);
  }
  .load-btn:focus-visible {
    outline: 3px solid var(--white, #fff);
    outline-offset: 6px;
  }
  .load-icon {
    --size: 3.4rem;
    width: var(--size);
    height: var(--size);
    fill: var(--white, #fff);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .load-text {
    color: #d4d4d8;
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
  }
  .drop-text {
    font-weight: 700;
    color: #fff;
  }

  .paste-btn {
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-decoration-color: rgba(244, 114, 182, 0.7);
    text-underline-offset: 3px;
    font: inherit;
    font-weight: 700;
    color: #fff;
  }
  .paste-btn:hover {
    color: #f472b6;
  }

  .sample-btn {
    margin-top: -0.4rem;
    background: none;
    border: 0;
    padding: 4px 8px;
    border-radius: 999px;
    cursor: pointer;
    font: inherit;
    font-size: 1.05rem;
    color: #a1a1aa;
    text-decoration: underline;
    text-decoration-color: rgba(255, 255, 255, 0.25);
    text-underline-offset: 3px;
    transition: color 150ms ease;
  }
  .sample-btn:hover {
    color: #e4e4e7;
  }
  .sample-btn:focus-visible {
    outline: 2px solid #f472b6;
    outline-offset: 2px;
  }

  .tagline {
    position: relative;
    margin: 1.2rem 0 0;
    font-size: 16px;
    color: #a1a1aa;
  }

  /* Supported-format chips under the tagline. */
  .formats {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px;
    margin: 1.4rem 0 0;
  }
  .formats span {
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #a1a1aa;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }

  @media (min-width: 600px) {
    .main {
      min-height: 688px;
    }
    .load-img-content {
      --size: 36rem;
    }
  }
</style>
