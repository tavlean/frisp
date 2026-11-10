<script lang="ts">
  // The landing screen — the "frame" design promoted from the intro lab
  // (docs/lab-intro-page.md). The whole viewport is the drop zone, ringed by a
  // dashed viewfinder, with the chrome reduced to HUD micro-copy inside the
  // frame (brand top-left, the format list centered along the bottom). It themes
  // off the OS (color-scheme: light dark), like
  // the rest of the landing. Real drops/picks/pastes route up through onFiles.
  //
  // The app wraps everything in a global fileDrop (see +page.svelte). This
  // component attaches its OWN drop target and calls stopPropagation, so a drop
  // over the intro routes exactly once (here, not the global) and never triggers
  // the global pink overlay — the viewfinder is our drag feedback instead.
  import { onMount } from 'svelte';
  import { dev } from '$app/env';
  import { resolve } from '$app/paths';
  import { fromFileList, type ImportedFile } from '$lib/bulk/import-sources';
  import { fileDrop } from '$lib/editor/file-drop';
  import { APP_NAME } from 'shared/brand';
  // The canonical logomark (currentColor); shared with the lab's Logomark so the
  // mark has ONE source of truth instead of a hand-copied path per consumer.
  import logomark from '$lib/brand/logomark.svg?raw';

  interface Props {
    /** Hand chosen files (from drop/picker/paste) up to the page. */
    onFiles: (files: ImportedFile[]) => void;
    /** Reused for paste feedback (no image / clipboard read failed). */
    onMessage?: (text: string) => void;
  }
  let { onFiles, onMessage }: Props = $props();

  const formats = ['WebP', 'SVG', 'AVIF', 'JPEG XL', 'PNG', 'JPEG'];

  // Backs the quiet "paste" action; keyboard ⌘V is handled separately by
  // onWindowPaste (synchronous clipboardData, no permission prompt).
  const supportsClipboardRead =
    typeof navigator !== 'undefined' &&
    !!navigator.clipboard &&
    'read' in navigator.clipboard;

  let fileInput = $state<HTMLInputElement>();

  // Entrance reveal — released next frame so the transition plays from the
  // start state on mount.
  let entered = $state(false);
  let dragActive = $state(false);

  onMount(() => {
    requestAnimationFrame(() => (entered = true));
  });

  // Our own drop target, isolated so the app-wide fileDrop never sees these
  // drags: the drop routes once and the global overlay stays hidden.
  const dropTarget = fileDrop((files) => onFiles(files), {
    isolate: true,
    onActiveChange: (active) => (dragActive = active),
  });

  function onBrowse() {
    fileInput?.click();
  }

  // fromFileList carries each file's webkitRelativePath, so a multi-select keeps
  // any folder structure the OS reports for bulk import.
  function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files?.length) onFiles(fromFileList(input.files));
    input.value = '';
  }

  // Explicit paste action for pointer users without a keyboard: reads the async
  // clipboard, delivers the first image, and reports a miss through onMessage.
  async function onPasteClick() {
    if (!supportsClipboardRead) return;
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const type = item.types.find((t) => t.startsWith('image/'));
        if (type) {
          const blob = await item.getType(type);
          onFiles([
            { file: new File([blob], 'pasted-image', { type: blob.type }) },
          ]);
          return;
        }
      }
      onMessage?.('No image found on the clipboard.');
    } catch {
      onMessage?.("Couldn't read the clipboard.");
    }
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

<main class={['intro-frame', { dragging: dragActive }]} {@attach dropTarget}>
  <!-- The viewfinder: one dashed rounded rect that resizes with the viewport.
       Geometry lives in CSS (percentages) so the SVG needs no viewBox. -->
  <svg class="frame-svg" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
    <rect
      class={['frame-rect', { dragging: dragActive, entered }]}
      fill="none"
      stroke-width="1.5"
      stroke-dasharray="7 9"
      vector-effect="non-scaling-stroke"
    />
  </svg>
  <!-- Soft inner glow — its own layer so the blur never touches the stroke. -->
  <div class="frame-glow" aria-hidden="true"></div>

  <!-- HUD chrome: brand pinned top-left, formats centered along the bottom. -->
  <div class="hud hud-tl">
    <span class="brand">
      <!-- eslint-disable-next-line svelte/no-at-html-tags — build-time SVG string from our own repo -->
      <span class="brand-mark" aria-hidden="true">{@html logomark}</span>
      <span class="brand-name">{APP_NAME}</span>
    </span>
  </div>
  <div class="hud hud-bc">
    <ul class="hud-line formats" aria-label="Supported image formats">
      {#each formats as format (format)}
        <li>{format}</li>
      {/each}
    </ul>
  </div>
  {#if dev}
    <!-- Dev-only door to the experiments; never rendered in production. -->
    <a class="hud hud-tr lab-link" href={resolve('/lab')}>lab ↗</a>
  {/if}

  <!-- Center column: the invitation, swapped in place (min-height reserved) so
       the drag state never shifts the layout. -->
  <div class={['center', { entered }]}>
    <span class={['tray', { nudge: dragActive }]}>
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
          <span class="hl-verb">Drop</span><span class="hl-verb-touch">Add</span
          > images to optimize.
        {/if}
      </span>
    </h1>

    <p class="subline">
      Free, open-source image compression that runs offline in your browser.
      Nothing uploads.
    </p>

    <div class="cta">
      <button type="button" class="pill browse" onclick={onBrowse}>
        Browse files
      </button>
      {#if supportsClipboardRead}
        <span class="cta-or">or</span>
        <button
          type="button"
          class="paste"
          onclick={onPasteClick}
          title="Paste an image from your clipboard"
        >
          <!-- Nucleo "clipboard-arrow-in" (duotone), matching the tray icon. -->
          <svg
            class="paste-icon"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="m6.25 2.75v.5c0 .5523.4477 1 1 1h3.5c.5523 0 1-.4477 1-1v-.5h1c1.105 0 2 .895 2 2v9.5c0 1.105-.895 2-2 2h-7.5c-1.105 0-2-.895-2-2V4.75c0-1.105.895-2 2-2h1Z"
              fill="currentColor"
              fill-rule="evenodd"
              opacity="0.3"
            />
            <rect
              x="6.25"
              y="1.25"
              width="5.5"
              height="3"
              rx="1"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
            <polyline
              points="11 7.5 8.25 10.25 11 13"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
            <path
              d="m6.25 2.75h-1c-1.105 0-2 .895-2 2v9.5c0 1.105.895 2 2 2h7.5c1.105 0 2-.895 2-2v-1"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
            <path
              d="m14.75 7.25v-2.5c0-1.105-.895-2-2-2h-1"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
            <line
              x1="8.5"
              y1="10.25"
              x2="14.75"
              y2="10.25"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
            />
          </svg>
          paste
        </button>
      {/if}
    </div>
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
  .hud-bc {
    bottom: calc(var(--frame-inset) + var(--hud-pad));
    left: 50%;
    transform: translateX(-50%);
    align-items: center;
    text-align: center;
  }
  .hud-tr {
    top: calc(var(--frame-inset) + 22px);
    right: calc(var(--frame-inset) + var(--hud-pad));
  }
  .lab-link {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    text-decoration: none;
    color: var(--i-text-3);
  }
  .lab-link:hover {
    color: var(--i-text-1);
  }
  .lab-link:focus-visible {
    outline: 2px solid var(--i-accent, currentColor);
    outline-offset: 3px;
    border-radius: 4px;
  }
  .hud-line {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--i-text-3);
  }
  /* The format list: separate items with generous breathing room, wrapping
     centered on narrow screens. */
  .formats {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 20px;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Brand lockup: logomark badge (currentColor) + wordmark, tinted by --i-text-1
     so it reads graphite on light and near-white on dark. */
  .brand {
    display: inline-flex;
    align-items: center;
    /* Optical gap, not metric: the hexagon mark meets the wordmark at a single
       right vertex with the edges receding above/below, so it reads looser than
       the number implies. 8px (~0.4x the wordmark cap height at the vertex)
       lands the perceived gap where a unified lockup wants it. */
    gap: 8px;
    line-height: 1;
    color: var(--i-text-1);
  }
  .brand-mark {
    display: inline-grid;
    height: 27.5px;
    /* Pin the width from the mark's aspect ratio (viewBox 1650×1800) rather than
       leaving it to the inline SVG's intrinsic sizing. iOS Safari can drop an
       auto-width, viewBox-only SVG to zero width after a relayout (e.g. the
       Satoshi web-font swapping in once cached), which slides the wordmark back
       over the mark — and it sticks across refreshes because the font stays
       cached. A CSS-computed box width never depends on that. */
    aspect-ratio: 1650 / 1800;
  }
  .brand-mark :global(svg) {
    height: 100%;
    width: 100%;
    display: block;
  }
  .brand-name {
    /* Scaled with the mark (27.5 : 22 keeps the original 1.25 mark:text ratio). */
    font-size: 22px;
    font-weight: 850;
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
    /* Tight display leading, but not so tight the two wrapped lines kiss —
       1.05 keeps the impact while giving the descenders room over line two. */
    line-height: 1.05;
    color: var(--i-text-1);
    text-wrap: balance;
    /* Reserve two display lines: the idle line wraps to two at the widths the
       design ships at, while the drag line is one — reserving the taller state
       keeps the column from jumping on drag. (2 × line-height.) */
    min-height: 2.1em;
  }
  .headline .accent {
    color: var(--i-accent);
  }
  /* Coarse-pointer devices can't drag, so the headline verb swaps Drop -> Add
     ("images to optimize." is shared). */
  .hl-verb-touch {
    display: none;
  }
  @media (hover: none) and (pointer: coarse) {
    .hl-verb {
      display: none;
    }
    .hl-verb-touch {
      display: inline;
    }
  }

  .subline {
    margin: 0;
    max-width: 46ch;
    font-size: 18px;
    line-height: 1.5;
    color: var(--i-text-2);
    text-wrap: balance;
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
  /* Browse + the quiet paste action sit on one row. */
  .cta {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 12px;
    /* Extra separation (30px total, atop the column's 18px) so the button row
       reads as its own action group, distinct from the heading+subheading. */
    margin-top: 12px;
  }
  .cta-or {
    font-size: 14px;
    color: var(--i-text-3);
  }

  /* Ghost button: a quiet icon+label at rest that fills in on hover/focus, so
     it reads as clickable without competing with the primary Browse pill. */
  .paste {
    appearance: none;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 10px 14px;
    /* A faint resting outline gives it a defined footprint next to the filled
       Browse pill (an outline vs. filled pair reads balanced); it fills in on
       hover/focus. */
    border: 1px solid var(--i-border);
    border-radius: 12px;
    background: none;
    color: var(--i-text-2);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      color 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .paste:hover {
    color: var(--i-text-1);
    background: var(--i-surface);
    border-color: var(--i-border-strong);
    box-shadow: var(--i-shadow-control);
  }
  .paste:focus-visible {
    outline: 2px solid var(--i-accent);
    outline-offset: 2px;
  }
  .paste-icon {
    width: 16px;
    height: 16px;
    flex: none;
    display: block;
  }
  @supports (corner-shape: squircle) {
    .pill,
    .paste {
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

  /* Narrow screens: tuck the HUD in closer to the frame and cap the format
     list's width so it wraps inside the viewfinder instead of touching it. */
  @media (max-width: 560px) {
    .intro-frame {
      --hud-pad: 16px;
    }
    .hud-tl {
      top: calc(var(--frame-inset) + 14px);
    }
    .hud-bc {
      max-width: calc(100% - 2 * var(--frame-inset) - 2 * var(--hud-pad));
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
