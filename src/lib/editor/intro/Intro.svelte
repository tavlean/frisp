<script lang="ts">
  // The landing screen: our logo over a field of soft pink blobs, with a central
  // "Drop OR Paste" target that opens the file dialog on click. Structure +
  // blob animation are adapted from Squoosh's prerendered-app/Intro (we keep
  // only the hero — no demo thumbnails, waves or info sections). The whole page
  // is already a drop target (see fileDrop in +page.svelte); this adds the
  // click-to-open and paste affordances.
  import { onMount, untrack } from 'svelte';
  import { asset } from '$app/paths';
  import { startBlobAnim } from './blob-anim';

  interface Props {
    /** Hand a chosen image (from the dialog or a paste) up to the page. */
    onFiles: (list: FileList | null | undefined) => void;
    /** Shown when a paste contains no image (reuses the page's snackbar). */
    onMessage?: (text: string) => void;
  }
  let { onFiles, onMessage }: Props = $props();

  let fileInput = $state<HTMLInputElement>();
  let canvas = $state<HTMLCanvasElement>();
  let target = $state<HTMLElement>();

  const supportsClipboardRead =
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    'read' in navigator.clipboard;

  onMount(() => {
    if (canvas && target) {
      const stop = untrack(() => startBlobAnim(canvas!, target!));
      return stop;
    }
  });

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
    bind:this={fileInput}
    type="file"
    accept="image/*"
    onchange={onFileChange}
  />

  <div class="main">
    <canvas class="blob-canvas" bind:this={canvas} aria-hidden="true"></canvas>

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

    <div class="load-img" bind:this={target}>
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
          <span class="drop-text">Drop</span> OR
          {#if supportsClipboardRead}
            <button class="paste-btn" type="button" onclick={onPasteClick}
              >Paste</button
            >
          {:else}
            Paste
          {/if}
        </div>
      </div>
    </div>

    <p class="tagline">
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
    /* The blob colour + softness, read by the canvas animation. Soft peach. */
    --blob-color: hsl(20, 85%, 80%);
    --center-blob-opacity: 0.2;
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
    gap: 24px;
  }
  .logo {
    display: block;
    width: 128px;
    height: 128px;
  }
  /* Size the wordmark by height so it locks up optically with the 128px icon
     (its glyphs sit ~56px tall, a touch under half the icon — a balanced
     horizontal logo lockup). Width follows the SVG's intrinsic aspect ratio. */
  .wordmark {
    display: block;
    height: 56px;
    width: auto;
  }

  .load-img {
    position: relative;
    color: var(--white, #fff);
    font-style: italic;
    font-size: 1.2rem;
  }

  .load-img-content {
    position: relative;
    --size: 29rem;
    width: 90vw;
    max-width: var(--size);
    height: var(--size);
    display: grid;
    grid-template-rows: max-content max-content;
    justify-items: center;
    align-content: center;
    gap: 0.7rem;
  }

  .load-btn {
    background: none;
    border: 0;
    padding: 0;
    margin: 0;
    cursor: pointer;
    display: grid;
    place-items: center;
    border-radius: 50%;
    transition: transform 150ms ease;
  }
  .load-btn:hover {
    transform: scale(1.06);
  }
  .load-btn:focus-visible {
    outline: 3px solid var(--white, #fff);
    outline-offset: 6px;
  }
  .load-icon {
    --size: 5rem;
    width: var(--size);
    height: var(--size);
    fill: var(--white, #fff);
    filter: drop-shadow(0 4px 4px rgba(0, 0, 0, 0.05));
  }

  .load-text {
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
  }

  .paste-btn {
    background: none;
    border: 0;
    padding: 0;
    cursor: pointer;
    text-decoration: underline;
    font: inherit;
    color: inherit;
  }
  .paste-btn:hover {
    opacity: 0.85;
  }

  .tagline {
    position: relative;
    margin: 1.5rem 0 0;
    font-size: 16px;
    color: hsl(0, 0%, 56%);
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
