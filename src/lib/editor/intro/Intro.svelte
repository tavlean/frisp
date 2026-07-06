<script lang="ts">
  // The landing screen: brand lockup over a field of soft coral blobs, with a
  // central drop/paste/browse target. Structure + blob
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
      <!-- The bird swaps per theme: the light-mode file is a dark bird on an
           opaque #f8fbfb square, which the light background below matches so it
           reads as transparent. The dark-mode file is the coral bird. -->
      <picture class="logo-pic">
        <source
          srcset={asset('/logo-light-mode.webp')}
          media="(prefers-color-scheme: light)"
        />
        <img
          class="logo"
          src={asset('/logo.webp')}
          alt=""
          width="128"
          height="128"
          fetchpriority="high"
        />
      </picture>
      <!-- Inlined (was an <img src=wordmark.svg>) so its colour follows the
           theme via currentColor instead of an external SVG we can't recolour. -->
      <svg
        class="wordmark"
        viewBox="0 0 599 293"
        role="img"
        aria-label={APP_NAME}
      >
        <path
          fill="currentColor"
          d="M22.9958 55.1249C22.9958 22.0499 44.4158 -5.48363e-05 77.4908 -5.48363e-05H95.1308V36.2249H84.1058C71.5058 36.2249 65.5208 42.8399 65.5208 55.7549V66.1499H98.9108V102.375H65.5208V229.95H22.9958V102.375H0.000781361V66.1499H22.9958V55.1249ZM113.155 229.95V66.1499H154.42V97.3349C160.09 73.7099 176.785 60.795 205.135 62.3699V102.375H199.15C174.58 102.375 155.68 118.755 155.68 146.16V229.95H113.155ZM219.283 229.95V66.1499H261.808V229.95H219.283ZM214.873 27.4049C214.873 13.8599 225.898 2.51993 240.388 2.51993C255.193 2.51993 265.903 13.8599 265.903 27.4049C265.903 41.5799 255.193 52.6049 240.388 52.6049C225.898 52.6049 214.873 41.2649 214.873 27.4049ZM343.028 234.045C315.308 234.045 292.943 224.595 274.988 205.38L303.653 179.235C315.623 192.78 328.223 199.395 342.083 199.395C356.573 199.395 364.763 192.15 364.763 182.385C364.763 173.88 360.668 169.155 334.838 163.17C291.053 152.775 284.438 132.93 284.438 112.14C284.438 83.4749 307.118 62.0549 345.548 62.0549C372.008 62.0549 389.648 68.6699 406.343 90.4049L375.473 114.03C367.598 101.43 357.518 96.3899 346.493 96.3899C334.838 96.3899 326.018 100.8 326.018 110.88C326.018 116.55 328.538 121.59 348.068 126.63C395.633 138.915 406.658 156.555 406.658 181.125C406.658 211.365 379.253 234.045 343.028 234.045ZM423.233 292.95V66.1499H465.128V92.6099C473.948 74.6549 488.753 62.6849 517.418 62.6849C562.463 62.6849 598.373 101.43 598.373 148.68C598.373 195.93 562.463 234.045 517.418 234.045C489.383 234.045 474.578 222.705 465.758 205.695V292.95H423.233ZM464.498 148.68C464.498 174.195 482.453 195.615 510.488 195.615C537.578 195.615 555.848 173.25 555.848 148.365C555.848 122.85 537.578 101.115 510.488 101.115C482.453 101.115 464.498 123.165 464.498 148.68Z"
        />
      </svg>
    </h1>

    <div class="load-img" {@attach captureBlobTarget}>
      <div class="load-img-content reveal" style="--reveal-order: 1">
        <!-- A click anywhere on the blob opens the picker. The disc below stays
             the labelled, keyboard-focusable control; this one is skipped in the
             tab order. The paste/folder links sit above and handle their own
             clicks (see the pointer-events rules). -->
        <button
          class="load-hit"
          type="button"
          onclick={onOpenClick}
          aria-label="Select images"
          tabindex="-1"
        ></button>
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
          <!-- Pointer devices get the full set: drop-target, paste, browse,
               plus a folder shortcut. -->
          <p class="load-line pointer-only">
            <span class="drop-text">Drop</span> an image,
            {#if supportsClipboardRead}
              <button class="paste-btn" type="button" onclick={onPasteClick}
                >paste</button
              >,
            {:else}
              paste,
            {/if}
            or click to browse
          </p>
          <p class="load-sub pointer-only">
            or <button class="paste-btn" type="button" onclick={onFolderClick}
              >choose a folder</button
            >
          </p>
          <!-- Touch devices can't drag-drop or pick folders, so we show only
               the gesture that applies. -->
          <p class="load-line touch-only">Tap to add an image</p>
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
    /* Extra space below lifts the lockup and opens up breathing room over the
       blob field (which is centred on the load target just below). Desktop
       gets much more (see the min-width block). */
    margin: 0 0 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  /* Flex (not display:contents) so the <source> stays metadata — under
     display:contents it would surface as a zero-width flex item and add a
     phantom gap that shoves the lockup off-centre. */
  .logo-pic {
    display: flex;
  }
  .logo {
    display: block;
    width: 96px;
    height: 96px;
    filter: drop-shadow(0 8px 24px rgba(255, 122, 80, 0.25));
  }
  /* Size the wordmark by height so it locks up optically with the icon as one
     horizontal logo. Width follows the SVG's intrinsic aspect ratio; colour
     follows the theme via currentColor (zinc-100 dark / zinc-800 light). */
  .wordmark {
    display: block;
    height: 56px;
    width: auto;
    margin-top: 8px;
    color: #f4f4f5;
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

  /* Transparent full-area hit target: a click anywhere on the blob opens the
     picker. It sits behind the disc + text (which are lifted above via
     z-index); the text layer passes clicks through to it (pointer-events:
     none) except the real paste/folder links. */
  .load-hit {
    position: absolute;
    inset: 0;
    z-index: 0;
    margin: 0;
    padding: 0;
    border: 0;
    background: none;
    border-radius: 50%;
    cursor: pointer;
  }

  /* The browse button: a coral-gradient disc that invites a squeeze. */
  .load-btn {
    position: relative;
    z-index: 1;
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
    position: relative;
    z-index: 1;
    /* Let clicks fall through to the hit target; the links below re-enable. */
    pointer-events: none;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.85);
    text-shadow: 0 1px 6px rgba(0, 0, 0, 0.25);
    text-align: center;
  }
  .load-line {
    margin: 0;
  }
  /* The folder shortcut sits a touch smaller and dimmer under the main line. */
  .load-sub {
    margin: 0.35rem 0 0;
    font-size: 0.9em;
    color: rgba(255, 255, 255, 0.6);
  }
  .drop-text {
    font-weight: 700;
  }

  /* Copy visibility by input type: pointer devices see drop/paste/folder;
     touch devices (or very narrow viewports) see only the tap gesture. */
  .touch-only {
    display: none;
  }
  @media (hover: none) and (pointer: coarse), (max-width: 480px) {
    .pointer-only {
      display: none;
    }
    .touch-only {
      display: block;
    }
  }

  .paste-btn {
    /* Re-enable clicks the .load-text layer disabled. */
    pointer-events: auto;
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
    /* Breathing room below the blob field before the badges. */
    margin: 2.75rem 0 0;
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
    /* Much more air around the lockup and above the badges on the roomier
       desktop canvas. */
    .logo-container {
      margin-bottom: 6rem;
    }
    .formats {
      margin-top: 4rem;
    }
  }

  /* Ease the wordmark down a touch on small screens. */
  @media (max-width: 599px) {
    .wordmark {
      height: 48px;
    }
  }

  /*
   * Light mode — driven purely by the user's OS/browser theme setting (no
   * toggle yet), and scoped to the intro screen only. We flip: the base
   * background (to #f8fbfb, which matches the opaque background baked into the
   * light-mode bird so it reads as transparent), the wordmark ink, the
   * load-target copy, and the format chips + privacy tagline. The blobs are
   * left alone on purpose — they paint the coral accent at low opacity, so
   * they read correctly over either background without a colour change.
   */
  @media (prefers-color-scheme: light) {
    .intro {
      color: #18181b;
      /* Flat — no warm glow — so it matches the opaque square baked into the
         light-mode bird exactly (the glow would tint the page around the logo
         and reveal its edges). The blobs still carry the coral accent. */
      background: #f8fbfb;
    }

    /* The light-mode bird carries its own opaque square, so the coral glow
       would just outline that square — drop it. */
    .logo {
      filter: none;
    }

    /* zinc-800 ink on the light background. */
    .wordmark {
      color: #27272a;
    }

    .load-text {
      color: rgba(24, 24, 27, 0.85);
      text-shadow: none;
    }
    .load-sub {
      color: rgba(24, 24, 27, 0.6);
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
      color: rgba(24, 24, 27, 0.62);
    }

    /* The white focus ring vanishes on a light background. */
    .load-btn:focus-visible {
      outline-color: #18181b;
    }
  }
</style>
