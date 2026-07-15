<script lang="ts">
  // The landing screen — the "frame" design promoted from the intro lab
  // (docs/lab-intro-page.md). The whole viewport is the drop zone, ringed by a
  // dashed viewfinder, with the chrome reduced to HUD micro-copy pinned to the
  // frame's inner corners. It themes off the OS (color-scheme: light dark), like
  // the rest of the landing. Real drops/picks/pastes route up through onFiles.
  //
  // The app wraps everything in a global fileDrop (see +page.svelte). This
  // component attaches its OWN drop target and calls stopPropagation, so a drop
  // over the intro routes exactly once (here, not the global) and never triggers
  // the global pink overlay — the viewfinder is our drag feedback instead.
  import { onMount } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import {
    fromDataTransfer,
    fromFileList,
    type ImportedFile,
  } from '$lib/bulk/import-sources';
  import { APP_NAME } from 'shared/brand';

  interface Props {
    /** Hand chosen files (from drop/picker/paste) up to the page. */
    onFiles: (files: ImportedFile[]) => void;
  }
  let { onFiles }: Props = $props();

  const formatsLine = 'WebP · AVIF · JPEG XL · JPEG · PNG';

  let fileInput = $state<HTMLInputElement>();

  // Entrance reveal — released next frame so the transition plays from the
  // start state on mount.
  let entered = $state(false);
  // Enter/leave depth counter so nested children never flicker the drag state.
  let dragDepth = $state(0);
  const dragActive = $derived(dragDepth > 0);

  onMount(() => {
    requestAnimationFrame(() => (entered = true));
  });

  /** True when the drag actually carries files (not text, links, etc.). */
  function dragHasFiles(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    return !!types && Array.prototype.includes.call(types, 'Files');
  }

  // Our own drop target. stopPropagation shields the app-wide fileDrop so the
  // drop routes once and the global overlay stays hidden; fromDataTransfer walks
  // dropped folders exactly like the global path does.
  const dropTarget: Attachment<HTMLElement> = (node) => {
    const onEnter = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      dragDepth += 1;
    };
    const onOver = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };
    const onLeave = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      event.stopPropagation();
      dragDepth = Math.max(0, dragDepth - 1);
    };
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      dragDepth = 0;
      if (!event.dataTransfer) return;
      void fromDataTransfer(event.dataTransfer).then((files) => {
        if (files.length) onFiles(files);
      });
    };

    node.addEventListener('dragenter', onEnter);
    node.addEventListener('dragover', onOver);
    node.addEventListener('dragleave', onLeave);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragenter', onEnter);
      node.removeEventListener('dragover', onOver);
      node.removeEventListener('dragleave', onLeave);
      node.removeEventListener('drop', onDrop);
    };
  };

  function onBrowse() {
    fileInput?.click();
  }

  function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files?.length) onFiles(fromFileList(input.files));
    input.value = '';
  }

  // Catch a Cmd/Ctrl+V paste of an image anywhere on the landing screen.
  function onWindowPaste(event: ClipboardEvent) {
    const file = Array.from(event.clipboardData?.files ?? []).find((f) =>
      f.type.startsWith('image/'),
    );
    if (file) {
      event.preventDefault();
      onFiles([{ file }]);
    }
  }
</script>

<svelte:window onpaste={onWindowPaste} />

<main class="intro-frame" class:dragging={dragActive} {@attach dropTarget}>
  <!-- The viewfinder: one dashed rounded rect that resizes with the viewport.
       Geometry lives in CSS (percentages) so the SVG needs no viewBox. -->
  <svg class="frame-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <rect
      class="frame-rect"
      class:dragging={dragActive}
      class:entered
      fill="none"
      stroke-width="1.5"
      stroke-dasharray="7 9"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  <!-- Soft inner glow — its own layer so the blur never touches the stroke. -->
  <div class="frame-glow" aria-hidden="true"></div>

  <!-- HUD corners: the chrome, pinned just inside the frame. -->
  <div class="hud hud-tl">
    <span class="brand">
      <svg
        class="brand-mark"
        viewBox="0 0 1650 1800"
        fill="currentColor"
        aria-hidden="true"
      >
        <path
          d="M560.9 871.3c81.05 0 146.76-65.71 146.76-146.76 0-81.06-65.7-146.76-146.76-146.76s-146.76 65.7-146.76 146.76 65.7 146.75 146.76 146.75"
        />
        <path
          d="m1487.35 1466.57-502.9 290.34c-99.33 57.35-222.78 57.45-322.2.3l-500.23-287.36C61.94 1412.26-.17 1304.68 0 1189.22l1.15-576.83c.31-114.74 62.12-221.6 161.46-278.95l502.9-290.35c99.33-57.35 222.78-57.45 322.2-.3l500.13 287.42c100.08 57.59 162.19 165.16 162.02 280.63l-1.15 576.83c-.32 114.74-62.02 221.54-161.36 278.9M1317.34 854.8l155.72 155.72.72-400.1a146.7 146.7 0 0 0-73.61-127.5L900.04 195.48a147.3 147.3 0 0 0-146.48.11l-502.9 290.35c-45.14 26.06-73.2 74.67-73.44 126.86l-1.04 576.77a146.7 146.7 0 0 0 73.61 127.51l94.48 54.29 516.6-516.7c125.97-125.86 330.73-125.86 456.59 0z"
        />
      </svg>
      <span class="brand-name">{APP_NAME}</span>
    </span>
  </div>
  <div class="hud hud-bl">
    <span class="hud-line">{formatsLine}</span>
  </div>
  <div class="hud hud-br">
    <span class="hud-line">offline · open source · private</span>
    <span class="hud-line">{APP_NAME} — images never leave your device</span>
  </div>

  <!-- Center column: the invitation, swapped in place (min-height reserved) so
       the drag state never shifts the layout. -->
  <div class="center" class:entered>
    <span class="tray" class:nudge={dragActive}>
      <svg class="tray-icon" viewBox="0 0 18 18" aria-hidden="true">
        <path
          fill-rule="evenodd"
          clip-rule="evenodd"
          d="M6.24475 9.75H1.75V13.25C1.75 14.3546 2.64543 15.25 3.75 15.25H14.25C15.3546 15.25 16.25 14.3546 16.25 13.25V9.75H11.727V10.7329C11.727 11.2852 11.2793 11.7329 10.727 11.7329H7.24475C6.69247 11.7329 6.24475 11.2852 6.24475 10.7329V9.75Z"
          fill="currentColor"
          fill-opacity="0.3"
        />
        <path
          d="M16.213 9.74999C16.19 9.62999 16.156 9.51199 16.111 9.39699L13.998 4.01799C13.697 3.25299 12.959 2.74899 12.136 2.74899H5.86301C5.04101 2.74899 4.30201 3.25199 4.00101 4.01799L1.88801 9.39699C1.84301 9.51099 1.80901 9.62899 1.78601 9.74999"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
        <path
          d="M11.75 9.75V10.75C11.75 11.302 11.302 11.75 10.75 11.75H7.25C6.698 11.75 6.25 11.302 6.25 10.75V9.75H1.787C1.763 9.875 1.75 10.001 1.75 10.129V13.25C1.75 14.354 2.645 15.25 3.75 15.25H14.25C15.355 15.25 16.25 14.354 16.25 13.25V10.129C16.25 10.002 16.237 9.875 16.213 9.75H11.75Z"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
          fill="none"
        />
      </svg>
    </span>

    <h1 class="headline">
      <!-- Stable, searchable heading name (carries the app identity, which now
           lives only in the HUD micro-copy). The visible line below is
           aria-hidden so the heading name never mutates to a drag fragment. -->
      <span class="visually-hidden"
        >{APP_NAME} — compress images in your browser</span
      >
      <span class="headline-visible" aria-hidden="true">
        {#if dragActive}
          Release to <span class="accent">add.</span>
        {:else}
          <span class="hl-pointer">Drop images anywhere.</span>
          <span class="hl-touch">Add an image.</span>
        {/if}
      </span>
    </h1>

    <p class="subline">
      Free, open-source image compression that runs entirely in your browser.
      Nothing ever uploads.
    </p>

    <button type="button" class="pill browse" onclick={onBrowse}>
      Browse files
    </button>
    <input
      bind:this={fileInput}
      class="visually-hidden"
      type="file"
      accept="image/*"
      multiple
      tabindex="-1"
      aria-hidden="true"
      onchange={onPick}
    />
  </div>
</main>

<style>
  .intro-frame {
    /* Follows the OS theme, like the rest of the landing — no manual toggle. */
    color-scheme: light dark;

    /* Token contract, ported from the intro lab (--il-*). */
    --i-page: light-dark(#f4f3f1, #111113);
    --i-surface: light-dark(#ffffff, #1c1c1f);
    --i-border: light-dark(rgba(20, 20, 15, 0.09), rgba(255, 255, 255, 0.09));
    --i-border-strong: light-dark(
      rgba(20, 20, 15, 0.16),
      rgba(255, 255, 255, 0.18)
    );
    --i-text-1: light-dark(#1a1a1e, #f5f5f7);
    /* Contrast-tuned for WCAG AA (>= 4.5:1) on --i-page in BOTH themes. The HUD
       micro-copy (--i-text-3) is 11.5px, so it needs the full 4.5:1 body-text
       ratio, not the relaxed large-text one. Measured: text-2 ~6:1;
       text-3 ~5:1 light / ~7:1 dark. */
    --i-text-2: light-dark(rgba(26, 26, 30, 0.7), rgba(245, 245, 247, 0.74));
    --i-text-3: light-dark(rgba(26, 26, 30, 0.64), rgba(245, 245, 247, 0.66));
    --i-accent: light-dark(#e4602f, #ff8a5e);
    --i-shadow-control: light-dark(
      0 1px 2px rgba(30, 25, 20, 0.08),
      0 1px 2px rgba(0, 0, 0, 0.5)
    );

    position: relative;
    height: 100dvh;
    box-sizing: border-box;
    overflow: hidden;
    background: var(--i-page);
    color: var(--i-text-1);
    /* One knob feeds both the frame inset and the HUD-corner padding. */
    --frame-inset: clamp(12px, 2vw, 26px);
    --hud-pad: 30px;
    --frame-radius: 24px;
    transition: background-color 200ms ease;
  }
  /* A whisper of accent tint fills the page while a drag hovers (≤4%). */
  .intro-frame.dragging {
    background: color-mix(in srgb, var(--i-accent) 4%, var(--i-page));
  }

  /* ── The viewfinder frame ──────────────────────────────────────────── */
  .frame-svg {
    /* SVG is a replaced element, so `inset` alone leaves it at its intrinsic
       300×150 — it needs an explicit box for the rect's % geometry to resolve
       against the viewport. */
    position: absolute;
    top: var(--frame-inset);
    left: var(--frame-inset);
    width: calc(100% - 2 * var(--frame-inset));
    height: calc(100% - 2 * var(--frame-inset));
    overflow: visible;
    pointer-events: none;
  }
  .frame-rect {
    /* Geometry via CSS percentages — inset 0.75px so the 1.5px stroke sits
       fully inside the SVG box on every side. */
    x: 0.75px;
    y: 0.75px;
    width: calc(100% - 1.5px);
    height: calc(100% - 1.5px);
    rx: var(--frame-radius);
    stroke: var(--i-border-strong);
    /* Entrance start state; .entered releases it. */
    opacity: 0;
    stroke-dashoffset: 40;
    transition:
      stroke 200ms ease,
      opacity 500ms ease,
      stroke-dashoffset 500ms ease;
  }
  .frame-rect.entered {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  .frame-rect.dragging {
    stroke: var(--i-accent);
    /* Marching dashes: one full dash+gap (7+9) per loop for a seamless cycle. */
    animation: march 700ms linear infinite;
  }
  @keyframes march {
    to {
      stroke-dashoffset: -16;
    }
  }

  .frame-glow {
    position: absolute;
    inset: var(--frame-inset);
    border-radius: var(--frame-radius);
    pointer-events: none;
    opacity: 0;
    box-shadow: inset 0 0 60px
      color-mix(in srgb, var(--i-accent) 10%, transparent);
    transition: opacity 200ms ease;
  }
  .intro-frame.dragging .frame-glow {
    opacity: 1;
  }
  @supports (corner-shape: squircle) {
    .frame-rect {
      rx: 30px;
    }
    .frame-glow {
      corner-shape: squircle;
      border-radius: 34px;
    }
  }

  /* ── HUD corners ───────────────────────────────────────────────────── */
  .hud {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 2;
  }
  .hud-tl {
    top: calc(var(--frame-inset) + 22px);
    left: calc(var(--frame-inset) + var(--hud-pad));
  }
  .hud-bl {
    bottom: calc(var(--frame-inset) + var(--hud-pad));
    left: calc(var(--frame-inset) + var(--hud-pad));
  }
  .hud-br {
    bottom: calc(var(--frame-inset) + var(--hud-pad));
    right: calc(var(--frame-inset) + var(--hud-pad));
    align-items: flex-end;
    text-align: right;
  }
  .hud-line {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--i-text-3);
  }

  /* Brand lockup: logomark badge (currentColor) + wordmark, tinted by --i-text-1
     so it reads graphite on light and near-white on dark. */
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    line-height: 1;
    color: var(--i-text-1);
  }
  .brand-mark {
    height: 20px;
    width: auto;
    display: block;
  }
  .brand-name {
    font-size: 16px;
    font-weight: 800;
    letter-spacing: -0.02em;
  }

  /* ── Center column ─────────────────────────────────────────────────── */
  .center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 18px;
    /* Fixed, centered measure so the headline wraps predictably and the drag
       swap can't reflow the column. */
    width: min(90vw, 620px);
    box-sizing: border-box;
    /* Reserve the tallest state so idle→drag never jumps. */
    min-height: 340px;
    padding: 0 24px;
    z-index: 1;
  }
  .center.entered {
    /* Center fades up once on mount. */
    animation: rise 500ms ease both;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 8px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  .tray {
    display: inline-grid;
    width: 56px;
    height: 56px;
    color: var(--i-text-2);
    transition: transform 200ms ease;
  }
  .tray.nudge {
    transform: translateY(4px);
  }
  .tray-icon {
    width: 100%;
    height: 100%;
    display: block;
  }

  .headline {
    margin: 0;
    font-size: clamp(36px, 6vw, 76px);
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1.02;
    color: var(--i-text-1);
    text-wrap: balance;
    /* Reserve two display lines: the idle line wraps to two at the widths the
       design ships at, while the drag line is one — reserving the taller state
       keeps the column from jumping on drag. */
    min-height: 2.04em;
  }
  .headline .accent {
    color: var(--i-accent);
  }
  /* Pointer vs touch headline: coarse-pointer devices can't drag or press ⌘V,
     so they get a tap-first line instead of the drop instruction. */
  .hl-touch {
    display: none;
  }
  @media (hover: none) and (pointer: coarse) {
    .hl-pointer {
      display: none;
    }
    .hl-touch {
      display: inline;
    }
  }

  .subline {
    margin: 0;
    max-width: 44ch;
    font-size: 16px;
    line-height: 1.5;
    color: var(--i-text-2);
  }

  /* Quiet pill button. */
  .pill {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    border: 1px solid var(--i-border);
    border-radius: 12px;
    background: var(--i-surface);
    box-shadow: var(--i-shadow-control);
    color: var(--i-text-1);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      transform 150ms ease;
  }
  .pill:hover {
    border-color: var(--i-border-strong);
    transform: translateY(-1px);
  }
  .pill:focus-visible {
    outline: 2px solid var(--i-accent);
    outline-offset: 2px;
  }
  .browse {
    margin-top: 4px;
  }
  @supports (corner-shape: squircle) {
    .pill {
      corner-shape: squircle;
      border-radius: 15px;
    }
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* Narrow screens: the two bottom HUD corners are both bottom-anchored and
     collide (~200px of copy each into ~290px of width). Collapse them into one
     centered, wrapping stack — formats above the privacy lines. */
  @media (max-width: 560px) {
    .intro-frame {
      --hud-pad: 16px;
    }
    .hud-tl {
      top: calc(var(--frame-inset) + 14px);
    }
    .hud-bl,
    .hud-br {
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      align-items: center;
      text-align: center;
      width: max-content;
      max-width: calc(100% - 2 * var(--frame-inset) - 2 * var(--hud-pad));
    }
    .hud-bl {
      bottom: calc(var(--frame-inset) + var(--hud-pad) + 46px);
    }
    .hud-br {
      bottom: calc(var(--frame-inset) + var(--hud-pad));
    }
    .hud-line {
      font-size: 11px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .frame-rect,
    .frame-rect.dragging {
      animation: none;
      transition:
        stroke 200ms ease,
        opacity 200ms ease;
      stroke-dashoffset: 0;
    }
    .center.entered {
      animation: none;
    }
    .tray,
    .tray.nudge,
    .pill:hover {
      transition: none;
      transform: none;
    }
  }
</style>
