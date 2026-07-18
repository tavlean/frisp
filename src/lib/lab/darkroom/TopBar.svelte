<script lang="ts">
  // The top navigation bar: a rounded panel on the left with the logo glyph +
  // nav items (EDITOR active, DIAGNOSTICS → /diagnostics), and a right cluster of
  // chips on the page background — undo/redo, EXPORT (downloads the RIGHT side's
  // result), and a circular "+" that adds images to the session gallery. Frisp
  // has no accounts, so the reference's avatar/pro chips are honestly omitted.
  import { resolve } from '$app/paths';
  import Logomark from '$lib/lab/Logomark.svelte';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import undoIcon from '$lib/lab/icons/undo.svg?raw';
  import redoIcon from '$lib/lab/icons/redo.svg?raw';
  import exportIcon from '$lib/lab/icons/export.svg?raw';
  import plusIcon from '$lib/lab/icons/plus.svg?raw';

  interface Props {
    /** The right side's download URL, or undefined while encoding / no result. */
    exportHref?: string;
    exportName: string;
    exportReady: boolean;
    canUndo: boolean;
    canRedo: boolean;
    undoTip: string;
    redoTip: string;
    onUndo: () => void;
    onRedo: () => void;
    onAddImages: () => void;
  }

  let {
    exportHref,
    exportName,
    exportReady,
    canUndo,
    canRedo,
    undoTip,
    redoTip,
    onUndo,
    onRedo,
    onAddImages,
  }: Props = $props();
</script>

<header class="dr-topbar">
  <div class="dr-topbar-panel">
    <span class="dr-logo">
      <Logomark size={22} />
    </span>
    <nav class="dr-nav" aria-label="Sections">
      <span class="dr-nav-item active" aria-current="page">Editor</span>
      <a class="dr-nav-item" href={resolve('/diagnostics')}>Diagnostics</a>
    </nav>
  </div>

  <div class="dr-topbar-right">
    <div class="dr-chip-pair">
      <button
        type="button"
        class="dr-chip-btn"
        disabled={!canUndo}
        data-tooltip={undoTip}
        aria-label={undoTip}
        onclick={() => onUndo()}
      >
        <LabIcon svg={undoIcon} />
      </button>
      <button
        type="button"
        class="dr-chip-btn"
        disabled={!canRedo}
        data-tooltip={redoTip}
        aria-label={redoTip}
        onclick={() => onRedo()}
      >
        <LabIcon svg={redoIcon} />
      </button>
    </div>

    <a
      class="dr-chip-btn dr-export"
      class:disabled={!exportReady}
      href={exportReady ? exportHref : undefined}
      download={exportReady ? exportName : undefined}
      aria-disabled={!exportReady}
      data-tooltip="Download the compared result"
    >
      <LabIcon svg={exportIcon} />
      <span class="dr-export-text">Export</span>
    </a>

    <button
      type="button"
      class="dr-chip-btn dr-add"
      data-tooltip="Add images"
      aria-label="Add images"
      onclick={() => onAddImages()}
    >
      <LabIcon svg={plusIcon} size={18} />
    </button>
  </div>
</header>

<style>
  .dr-topbar {
    position: fixed;
    top: 12px;
    left: 12px;
    right: 12px;
    z-index: 22;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    pointer-events: none;
  }
  .dr-topbar > * {
    pointer-events: auto;
  }

  .dr-topbar-panel {
    display: flex;
    align-items: center;
    gap: 14px;
    height: 44px;
    padding: 0 16px 0 12px;
    border-radius: 12px;
    border: 1px solid var(--dr-border);
    background: var(--dr-panel);
    box-shadow: var(--dr-shadow-panel);
  }

  .dr-logo {
    display: grid;
    place-items: center;
    width: 26px;
    height: 26px;
    color: var(--dr-text-1);
  }

  .dr-nav {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .dr-nav-item {
    font-size: 0.92rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--dr-text-2);
    text-decoration: none;
    transition: color 150ms ease;
  }
  .dr-nav-item:hover {
    color: var(--dr-text-1);
  }
  .dr-nav-item.active {
    color: var(--dr-text-1);
  }

  .dr-topbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dr-chip-pair {
    display: flex;
    gap: 6px;
  }
  /* Disabled undo/redo read as recessed inset chips, not 40%-opacity ghosts —
     the chrome stays fully drawn so the control reads present-but-inactive. */
  .dr-chip-pair .dr-chip-btn:disabled {
    opacity: 1;
    background: var(--dr-inset);
    border-color: var(--dr-border);
    color: var(--dr-text-3);
  }

  /* EXPORT is the bar's only primary — the raised-chip treatment it shares with
     the inspector's Save (Results .download). */
  .dr-export {
    gap: 7px;
    padding: 0 14px;
    background: var(--dr-chip-active);
    border-color: var(--dr-border-strong);
    color: var(--dr-text-1);
  }
  .dr-export:hover {
    background: var(--dr-chip-hover);
    color: var(--dr-text-1);
  }
  .dr-export-text {
    font-size: 0.92rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .dr-export.disabled {
    opacity: 0.4;
    pointer-events: none;
  }

  .dr-add {
    border-radius: 999px;
  }

  @media (max-width: 760px) {
    .dr-export-text {
      display: none;
    }
    .dr-export {
      padding: 0;
      width: 36px;
      justify-content: center;
    }
  }
</style>
