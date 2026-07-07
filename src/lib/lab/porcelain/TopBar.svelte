<script lang="ts">
  // The floating top toolbar: a raised white pill of icon actions (Back, Undo,
  // Redo) and a SEPARATE adjacent pill holding the primary Export button. All
  // wiring is real — Back clears the file, Undo/Redo drive the session history,
  // Export downloads the right side's encoded result. Tooltips are pure CSS
  // (no `title`) so they can carry a right-aligned kbd shortcut.
  import type { EditorSession } from '$lib/editor/editor-session.svelte';

  interface Props {
    session: EditorSession;
    isMac: boolean;
  }

  let { session, isMac }: Props = $props();

  const undoKbd = $derived(isMac ? '⌘Z' : 'Ctrl+Z');
  const redoKbd = $derived(isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z');

  // Export targets the RIGHT side (index 1) — the encoded output the user came
  // to produce. It's unavailable while that side is mid-encode or has no result.
  const exporting = $derived(session.runtime[1].showSpinner);
  const exportUrl = $derived(session.runtime[1].result?.outputUrl);
  const exportName = $derived(session.downloadName(1));
  const exportDisabled = $derived(exporting || !exportUrl);
</script>

<div class="topbar">
  <div class="pill actions">
    <div class="tip-wrap">
      <button
        type="button"
        class="icon-btn"
        onclick={() => session.clearFile()}
        aria-label="Back"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M14.5 6l-6 6 6 6"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="tooltip" role="tooltip"
        ><span class="tip-label">Back</span></span
      >
    </div>

    <span class="divider" aria-hidden="true"></span>

    <div class="tip-wrap">
      <button
        type="button"
        class="icon-btn"
        onclick={() => session.undo()}
        disabled={!session.history.canUndo}
        aria-label="Undo"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H9"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
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
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H15"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </button>
      <span class="tooltip" role="tooltip">
        <span class="tip-label">Redo</span><span class="tip-kbd">{redoKbd}</span
        >
      </span>
    </div>
  </div>

  <div class="pill export-pill">
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
        <svg class="export-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 3v10.5m0 0l4-4M12 13.5l-4-4M5 16v3h14v-3"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      {/if}
      <span class="export-text">Export</span>
    </a>
  </div>
</div>

<style>
  .topbar {
    /* Right-aligned to the viewport centre: Output's zoom cluster is CSS-docked
       just right of centre (see porcelain.css), so the two halves read as one
       centred toolbar — the reference keeps zoom in the top bar. */
    position: absolute;
    top: 16px;
    right: calc(50% + 4px);
    z-index: 12;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .pill {
    display: flex;
    align-items: center;
    height: 52px;
    padding: 0 8px;
    background: var(--pc-surface);
    border: 1px solid var(--pc-border);
    border-radius: 16px;
    box-shadow: var(--pc-shadow-panel);
  }
  @supports (corner-shape: squircle) {
    .pill {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .actions {
    gap: 4px;
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

  .icon-btn svg {
    width: 20px;
    height: 20px;
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

  .export-pill {
    padding: 0 7px;
  }

  .export {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 38px;
    padding: 0 16px;
    border-radius: 11px;
    background: var(--pc-inset);
    color: var(--pc-text-1);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    text-decoration: none;
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
    background: var(--pc-inset-strong);
  }

  .export.disabled {
    opacity: 0.45;
    pointer-events: none;
  }

  .export:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .export-icon {
    width: 17px;
    height: 17px;
  }

  .spinner {
    width: 14px;
    height: 14px;
    border: 2px solid var(--pc-spinner-track);
    border-top-color: var(--pc-spinner-head);
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

  /* Compact below 760px: hide the Export text (icon-only) and tighten gaps. */
  @media (max-width: 760px) {
    .topbar {
      top: 10px;
      gap: 6px;
    }
    .pill {
      height: 46px;
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
