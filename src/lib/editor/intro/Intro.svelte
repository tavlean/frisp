<script lang="ts">
  // The landing screen: brand lockup + gradient headline over a field of soft
  // coral blobs, with a central drop/paste/browse target. Structure + blob
  // animation are adapted from Squoosh's prerendered-app/Intro (we keep only
  // the hero — no demo thumbnails, waves or info sections). The whole page is
  // already a drop target (see fileDrop in +page.svelte); this adds the
  // click-to-open and paste affordances.
  import type { Attachment } from 'svelte/attachments';
  import { asset } from '$app/paths';
  import { fromFileList, type ImportedFile } from '$lib/bulk/import-sources';
  import { APP_NAME } from 'shared/brand';
  import { startBlobAnim } from './blob-anim';

  interface Props {
    /** Hand chosen files (from picker/folder/paste) up to the page. */
    onFiles: (files: ImportedFile[]) => void;
    /** Shown when a paste contains no image (reuses the page's snackbar). */
    onMessage?: (text: string) => void;
  }
  let { onFiles, onMessage }: Props = $props();

  const supportsClipboardRead =
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    'read' in navigator.clipboard;

  /** Output codec line-up shown as chips under the drop target. */
  const formats = ['AVIF', 'WebP', 'JPEG XL', 'PNG', 'JPEG'];

  // The hidden file input, captured on mount for the open/change handlers.
  let fileInput: HTMLInputElement | undefined;
  let folderInput: HTMLInputElement | undefined;
  const captureInput: Attachment<HTMLInputElement> = (node) => {
    fileInput = node;
  };
  const captureFolderInput: Attachment<HTMLInputElement> = (node) => {
    folderInput = node;
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

  // Deliver a single pasted File through the same ImportedFile[] boundary.
  function deliver(file: File) {
    onFiles([{ file }]);
  }

  function onOpenClick() {
    fileInput?.click();
  }

  function onFolderClick() {
    folderInput?.click();
  }

  function onFileChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files?.length) onFiles(fromFileList(input.files));
    input.value = '';
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
    multiple
    onchange={onFileChange}
  />
  <input
    class="hide"
    {@attach captureFolderInput}
    type="file"
    {...{ webkitdirectory: true }}
    onchange={onFileChange}
  />

  <div class="main">
    <canvas class="blob-canvas" {@attach blobAnim} aria-hidden="true"></canvas>

    <h1 class="logo-container reveal" style="--reveal-order: 0">
      <img
        class="logo"
        src={asset('/logo.webp')}
        alt=""
        width="128"
        height="128"
        fetchpriority="high"
      />
      <img class="wordmark" src={asset('/wordmark.svg')} alt={APP_NAME} />
    </h1>

    <div class="load-img" {@attach captureBlobTarget}>
      <div class="load-img-content reveal" style="--reveal-order: 1">
        <button
          class="load-btn"
          type="button"
          onclick={onOpenClick}
          aria-label="Select images"
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
          <span class="drop-text">Drop</span>, click, or
          <span class="secondary-actions">
            {#if supportsClipboardRead}
              <button class="paste-btn" type="button" onclick={onPasteClick}
                >Paste image</button
              >
            {:else}
              paste
            {/if}
            <button class="paste-btn" type="button" onclick={onFolderClick}
              >Choose folder</button
            >
          </span>
        </div>
      </div>
    </div>

    <ul class="formats reveal" style="--reveal-order: 2">
      {#each formats as f (f)}
        <li class="format-chip">{f}</li>
      {/each}
    </ul>

    <p class="tagline reveal" style="--reveal-order: 3">
      <svg class="lock" viewBox="0 0 16 16" aria-hidden="true">
        <path
          d="M4.5 6.5V5a3.5 3.5 0 1 1 7 0v1.5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
        />
        <rect
          x="3"
          y="6.5"
          width="10"
          height="7.5"
          rx="2"
          fill="currentColor"
        />
      </svg>
      Local-first image compression. Nothing leaves your device.
    </p>
  </div>
</div>

<style>
  .intro {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    overflow: hidden;
    color: var(--white, #fff);
    /* A faint warm glow rising behind the hero. The intro paints its own base
       colour (rather than leaning on the shared body background) so it can flip
       to light on its own — see the prefers-color-scheme block below — without
       touching the editor, which keeps the dark body background for now. */
    background:
      radial-gradient(
        ellipse 70% 55% at 50% 38%,
        rgba(255, 122, 80, 0.07),
        transparent 70%
      ),
      #0c0c0f;
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
    /* The blob colour + softness, read by the canvas animation. Brand coral. */
    --blob-color: hsl(15, 100%, 65%);
    --center-blob-opacity: 0.085;
    position: relative;
    min-height: 541px;
    display: grid;
    grid-template-rows: repeat(4, max-content);
    justify-items: center;
    align-content: center;
    padding: 24px;
  }

  /* Staggered entrance: each hero row fades up once on load. */
  .reveal {
    animation: rise 700ms cubic-bezier(0.22, 1, 0.36, 1) both;
    animation-delay: calc(var(--reveal-order, 0) * 90ms);
  }

  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .reveal {
      animation-duration: 1ms;
      animation-delay: 0ms;
    }
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
    margin: 0 0 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
  }
  .logo {
    display: block;
    width: 96px;
    height: 96px;
    filter: drop-shadow(0 8px 24px rgba(255, 122, 80, 0.25));
  }
  /* Size the wordmark by height so it locks up optically with the icon as one
     horizontal logo. Width follows the SVG's intrinsic aspect ratio. */
  .wordmark {
    display: block;
    height: 60px;
    width: auto;
    margin-top: 10px;
  }

  .load-img {
    position: relative;
    color: var(--white, #fff);
    font-size: 1.25rem;
  }

  .load-img-content {
    position: relative;
    --size: 36rem;
    width: 90vw;
    max-width: var(--size);
    height: var(--size);
    display: grid;
    grid-template-rows: max-content max-content;
    justify-items: center;
    align-content: center;
    gap: 1.1rem;
  }

  /* The browse button: a coral-gradient disc that invites a squeeze. */
  .load-btn {
    --size: 7.2rem;
    width: var(--size);
    height: var(--size);
    background: linear-gradient(145deg, hsl(20, 95%, 66%), hsl(8, 88%, 58%));
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
    border-radius: 50%;
    box-shadow:
      0 12px 40px rgba(255, 100, 60, 0.35),
      inset 0 1.5px 0 rgba(255, 255, 255, 0.35);
    transition:
      transform 200ms cubic-bezier(0.34, 1.4, 0.64, 1),
      box-shadow 200ms ease;
  }
  .load-btn:hover {
    transform: scale(1.07);
    box-shadow:
      0 16px 52px rgba(255, 100, 60, 0.5),
      inset 0 1.5px 0 rgba(255, 255, 255, 0.35);
  }
  .load-btn:active {
    transform: scale(0.97);
  }
  .load-btn:focus-visible {
    outline: 3px solid var(--white, #fff);
    outline-offset: 5px;
  }
  .load-icon {
    --size: 3.4rem;
    width: var(--size);
    height: var(--size);
    fill: #fff;
    filter: drop-shadow(0 2px 4px rgba(120, 30, 0, 0.3));
  }

  .load-text {
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
    text-align: center;
  }
  .drop-text {
    font-weight: 700;
  }
  .secondary-actions {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.75ch;
    flex-wrap: wrap;
  }

  .paste-btn {
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 3px;
    font: inherit;
    font-weight: 700;
    color: inherit;
  }
  .paste-btn:hover {
    color: hsl(20, 100%, 80%);
  }

  /* The codec line-up. */
  .formats {
    position: relative;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 7px;
    list-style: none;
    margin: 1.6rem 0 0;
    padding: 0;
  }
  .format-chip {
    padding: 4px 11px;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.13);
    background: rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.6);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.05em;
  }

  .tagline {
    position: relative;
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 1.4rem 0 0;
    font-size: 1.15rem;
    color: rgba(235, 235, 245, 0.45);
  }
  .lock {
    width: 12px;
    height: 12px;
    color: rgba(235, 235, 245, 0.45);
  }

  @media (min-width: 600px) {
    .main {
      min-height: 660px;
    }
    .load-img-content {
      --size: 45rem;
    }
  }

  /*
   * Light mode — driven purely by the user's OS/browser theme setting (no
   * toggle yet), and scoped to the intro screen only. We flip four things:
   * the base background, the wordmark SVG (recoloured via filter since it's an
   * <img> with a baked-in off-white fill), the load-target copy, and the
   * format chips + privacy tagline. The blobs are left alone on purpose — they
   * paint the coral accent at low opacity, so they read correctly over either
   * background without a colour change.
   */
  @media (prefers-color-scheme: light) {
    .intro {
      color: #18181b;
      background:
        radial-gradient(
          ellipse 70% 55% at 50% 38%,
          rgba(255, 122, 80, 0.1),
          transparent 70%
        ),
        #fafafa;
    }

    /* Off-white wordmark (#F4F4F5) → near-black ink to match the body text.
       brightness(0.1) scales the flat fill down to ~#181818 while preserving
       the anti-aliased edges. */
    .wordmark {
      filter: brightness(0.1);
    }

    .load-text {
      color: rgba(24, 24, 27, 0.85);
      text-shadow: none;
    }
    .paste-btn:hover {
      color: hsl(14, 85%, 46%);
    }

    .format-chip {
      border-color: rgba(24, 24, 27, 0.14);
      background: rgba(24, 24, 27, 0.03);
      color: rgba(24, 24, 27, 0.62);
    }

    .tagline,
    .lock {
      color: rgba(24, 24, 27, 0.5);
    }

    /* The white focus ring vanishes on a light background. */
    .load-btn:focus-visible {
      outline-color: #18181b;
    }
  }
</style>
