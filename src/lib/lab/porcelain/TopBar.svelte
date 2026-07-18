<script lang="ts" module>
  export type ThemeMode = 'system' | 'light' | 'dark';
</script>

<script lang="ts">
  // The one floating porcelain toolbar: a single raised pill spanning the top.
  // LEFT holds the brand mark and the history/edit actions (back, undo, redo,
  // crop); the CENTRE reserves a slot the production Output docks its
  // zoom/fit/rotate/view-options cluster into (see porcelain.css) so the whole
  // row reads as one pill; RIGHT holds the theme-cycle button and the dark
  // primary Export. All wiring is real — Back clears the file, Undo/Redo drive
  // session history, Export downloads the right side's encoded result. Tooltips
  // are pure CSS (no `title`) so they can carry a right-aligned kbd shortcut.
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import Logomark from '$lib/lab/Logomark.svelte';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import backIcon from '$lib/lab/icons/back.svg?raw';
  import undoIcon from '$lib/lab/icons/undo.svg?raw';
  import redoIcon from '$lib/lab/icons/redo.svg?raw';
  import cropIcon from '$lib/lab/icons/crop.svg?raw';
  import sunMoonIcon from '$lib/lab/icons/sun-moon.svg?raw';
  import sunIcon from '$lib/lab/icons/sun.svg?raw';
  import moonIcon from '$lib/lab/icons/moon.svg?raw';
  import exportIcon from '$lib/lab/icons/export.svg?raw';

  interface Props {
    session: EditorSession;
    isMac: boolean;
    /** Enter crop mode (lab crop tool). Absent → no crop button. */
    oncrop?: () => void;
    cropDisabled?: boolean;
    /** Current forced color scheme; drives the theme button's label. */
    theme: ThemeMode;
    /** Advance the theme one step (system → light → dark → system). */
    onCycleTheme: () => void;
  }

  let {
    session,
    isMac,
    oncrop,
    cropDisabled = false,
    theme,
    onCycleTheme,
  }: Props = $props();

  const undoKbd = $derived(isMac ? '⌘Z' : 'Ctrl+Z');
  const redoKbd = $derived(isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z');
  const themeLabel = $derived(
    theme === 'light' ? 'Light' : theme === 'dark' ? 'Dark' : 'System',
  );
  // The button shows the CURRENT mode's glyph (not a fixed cycle icon).
  const themeGlyph = $derived(
    theme === 'light' ? sunIcon : theme === 'dark' ? moonIcon : sunMoonIcon,
  );

  // Export targets the RIGHT side (index 1) — the encoded output the user came
  // to produce. It's unavailable while that side is mid-encode or has no result.
  const exporting = $derived(session.runtime[1].showSpinner);
  const exportUrl = $derived(session.runtime[1].result?.outputUrl);
  const exportName = $derived(session.downloadName(1));
  const exportDisabled = $derived(exporting || !exportUrl);
</script>

<div class="toolbar">
  <div class="cluster left">
    <span class="logo"><Logomark size={20} /></span>

    <span class="divider" aria-hidden="true"></span>

    <div class="tip-wrap">
      <button
        type="button"
        class="icon-btn"
        onclick={() => session.clearFile()}
        aria-label="Back"
      >
        <LabIcon svg={backIcon} size={18} />
      </button>
      <span class="tooltip" role="tooltip"
        ><span class="tip-label">Back</span></span
      >
    </div>

    <div class="tip-wrap">
      <button
        type="button"
        class="icon-btn"
        onclick={() => session.undo()}
        disabled={!session.history.canUndo}
        aria-label="Undo"
      >
        <LabIcon svg={undoIcon} size={18} />
      </button>
      <span class="tooltip" role="tooltip">
        <span class="tip-label">Undo</span><span class="tip-kbd">{undoKbd}</span
        >
      </span>
    </div>

    <div class="tip-wrap">
      <button
        type="button"
        class="icon-btn"
        onclick={() => session.redo()}
        disabled={!session.history.canRedo}
        aria-label="Redo"
      >
        <LabIcon svg={redoIcon} size={18} />
      </button>
      <span class="tooltip" role="tooltip">
        <span class="tip-label">Redo</span><span class="tip-kbd">{redoKbd}</span
        >
      </span>
    </div>

    {#if oncrop}
      <span class="divider" aria-hidden="true"></span>

      <div class="tip-wrap">
        <button
          type="button"
          class="icon-btn"
          onclick={() => oncrop()}
          disabled={cropDisabled}
          aria-label="Crop"
        >
          <LabIcon svg={cropIcon} size={18} />
        </button>
        <span class="tooltip" role="tooltip"
          ><span class="tip-label">Crop</span></span
        >
      </div>
    {/if}
  </div>

  <!-- Reserved centre: Output's zoom/fit/rotate/view-options cluster is docked
       here from porcelain.css (centred over the viewport, which is this slot's
       centre), so it reads as the toolbar's middle section. -->
  <div class="canvas-slot" aria-hidden="true"></div>

  <div class="cluster right">
    <div class="tip-wrap">
      <button
        type="button"
        class="icon-btn"
        onclick={() => onCycleTheme()}
        aria-label={`Theme: ${themeLabel}`}
      >
        <LabIcon svg={themeGlyph} size={18} />
      </button>
      <span class="tooltip" role="tooltip"
        ><span class="tip-label">Theme: {themeLabel}</span></span
      >
    </div>

    <a
      class="export"
      class:disabled={exportDisabled}
      href={exportDisabled ? undefined : exportUrl}
      download={exportDisabled ? undefined : exportName}
      aria-disabled={exportDisabled}
    >
      {#if exporting}
        <span class="spinner" aria-hidden="true"></span>
      {:else}
        <LabIcon svg={exportIcon} size={17} />
      {/if}
      <span class="export-text">Export</span>
    </a>
  </div>
</div>

<style>
  .toolbar {
    /* One centred pill. flex:1 clusters flank a fixed-width centre slot, so the
       slot is centred on the viewport — exactly where Output docks its control
       cluster (porcelain.css). Width stays modest and shrinks with the
       viewport so it clears the side panels. */
    position: absolute;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    width: min(720px, calc(100vw - 32px));
    z-index: 11;
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 10px;
    background: var(--pc-surface);
    border: 1px solid var(--pc-border);
    border-radius: 16px;
    box-shadow: var(--pc-shadow-panel);
  }
  @supports (corner-shape: squircle) {
    .toolbar {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .cluster {
    display: flex;
    align-items: center;
    gap: 2px;
    flex: 1 1 0;
    min-width: 0;
  }

  .cluster.right {
    justify-content: flex-end;
    gap: 8px;
  }

  /* Holds the docked Output cluster; its edges divide the pill's sections. */
  .canvas-slot {
    flex: 0 0 268px;
    align-self: stretch;
    margin: 0 4px;
    border-left: 1px solid var(--pc-border);
    border-right: 1px solid var(--pc-border);
  }

  .logo {
    display: inline-flex;
    align-items: center;
    padding: 0 6px;
    color: var(--pc-text-1);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--pc-text-1);
    cursor: pointer;
    padding: 0;
    transition:
      background-color 140ms ease,
      opacity 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .icon-btn {
      corner-shape: squircle;
      border-radius: 12px;
    }
  }

  .icon-btn:hover:not(:disabled) {
    background: var(--pc-inset);
  }

  .icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .divider {
    width: 1px;
    height: 24px;
    margin: 0 4px;
    background: var(--pc-border);
  }

  /* Pure-CSS tooltip: a near-black pill below the control, revealed on hover /
     keyboard focus. `title` is avoided so the kbd shortcut can sit right-aligned
     in its own lighter span. */
  .tip-wrap {
    position: relative;
    display: inline-flex;
  }

  .tooltip {
    position: absolute;
    top: calc(100% + 10px);
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    z-index: 40;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 5px 9px;
    border-radius: 8px;
    background: var(--pc-tooltip-bg);
    color: var(--pc-tooltip-text);
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    transition:
      opacity 130ms ease,
      transform 130ms ease;
  }

  .tip-wrap:hover .tooltip,
  .icon-btn:focus-visible + .tooltip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  .tip-kbd {
    color: var(--pc-tooltip-kbd);
    font-variant-numeric: tabular-nums;
  }

  /* Export + the Results download are the skin's only primary buttons: a dark
     charcoal fill (near-white in dark), matching porcelain.css's
     `.results .download`. */
  .export {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 38px;
    padding: 0 16px;
    border-radius: 11px;
    background: light-dark(#1b1b1f, #f5f5f7);
    color: light-dark(#ffffff, #16161c);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
    box-shadow: var(--pc-shadow-control);
    transition:
      background-color 140ms ease,
      opacity 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .export {
      corner-shape: squircle;
      border-radius: 13px;
    }
  }

  .export:hover:not(.disabled) {
    background: light-dark(#000000, #ffffff);
  }

  .export.disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .export:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid
      light-dark(rgba(255, 255, 255, 0.35), rgba(20, 20, 15, 0.25));
    border-top-color: light-dark(#ffffff, #16161c);
    border-radius: 50%;
    animation: pc-spin 0.8s linear infinite;
  }

  @keyframes pc-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .tooltip,
    .export,
    .icon-btn {
      transition-duration: 0ms;
    }
    .spinner {
      animation-duration: 0ms;
    }
  }

  /* Compact below 760px: the docked cluster becomes its own row beneath the bar
     (porcelain.css), so the slot collapses and the pill sizes to content. */
  @media (max-width: 760px) {
    .toolbar {
      top: 10px;
      width: auto;
      max-width: calc(100vw - 20px);
      height: 46px;
    }
    .cluster {
      flex: 0 0 auto;
    }
    .canvas-slot {
      display: none;
    }
    .icon-btn {
      width: 32px;
      height: 32px;
    }
    .export {
      height: 34px;
      padding: 0 11px;
    }
    .export-text {
      display: none;
    }
  }
</style>
