<script lang="ts">
  // The top bar: darkroom's STRUCTURE (a brand+nav panel on the left, a cluster
  // of action pills on the right) wearing porcelain's CLOTHES (raised white
  // squircle surfaces, sentence-case 13px medium labels — NO uppercase tracking,
  // near-black kbd tooltips). All wiring is real: nav "Diagnostics" resolves to
  // the production route, Undo/Redo drive session history, Export downloads the
  // RIGHT side's encoded result (spinner while it's mid-encode, copied from
  // porcelain's TopBar), and "+" adds images to the session strip.
  import { resolve } from '$app/paths';
  import { APP_NAME } from 'shared/brand';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';

  interface Props {
    session: EditorSession;
    isMac: boolean;
    onAddImages: () => void;
  }

  let { session, isMac, onAddImages }: Props = $props();

  const undoKbd = $derived(isMac ? '⌘Z' : 'Ctrl+Z');
  const redoKbd = $derived(isMac ? '⇧⌘Z' : 'Ctrl+Shift+Z');

  // Export targets the RIGHT side (index 1) — the encoded output the user came
  // to produce. Unavailable while that side is mid-encode or has no result.
  const exporting = $derived(session.runtime[1].showSpinner);
  const exportUrl = $derived(session.runtime[1].result?.outputUrl);
  const exportName = $derived(session.downloadName(1));
  const exportDisabled = $derived(exporting || !exportUrl);
</script>

<header class="hy-topbar">
  <div class="hy-brand-panel">
    <span class="hy-logo" aria-hidden="true">
      <svg viewBox="0 0 24 24">
        <rect
          x="4"
          y="4"
          width="16"
          height="16"
          rx="5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
        />
        <path
          d="M9 15V9h5M9 12h4"
          fill="none"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span class="hy-wordmark">{APP_NAME}</span>
    <nav class="hy-nav" aria-label="Sections">
      <span class="hy-nav-item active" aria-current="page">Editor</span>
      <a class="hy-nav-item" href={resolve('/diagnostics')}>Diagnostics</a>
    </nav>
  </div>

  <div class="hy-actions">
    <div class="hy-pill hy-icon-pair">
      <div class="hy-tip-wrap">
        <button
          type="button"
          class="hy-icon-btn"
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
        <span class="hy-tooltip" role="tooltip">
          <span class="hy-tip-label">Undo</span><span class="hy-tip-kbd"
            >{undoKbd}</span
          >
        </span>
      </div>

      <div class="hy-tip-wrap">
        <button
          type="button"
          class="hy-icon-btn"
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
        <span class="hy-tooltip" role="tooltip">
          <span class="hy-tip-label">Redo</span><span class="hy-tip-kbd"
            >{redoKbd}</span
          >
        </span>
      </div>
    </div>

    <div class="hy-pill hy-export-pill">
      <a
        class="hy-export"
        class:disabled={exportDisabled}
        href={exportDisabled ? undefined : exportUrl}
        download={exportDisabled ? undefined : exportName}
        aria-disabled={exportDisabled}
      >
        {#if exporting}
          <span class="hy-spinner" aria-hidden="true"></span>
        {:else}
          <svg class="hy-export-icon" viewBox="0 0 24 24" aria-hidden="true">
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
        <span class="hy-export-text">Export</span>
      </a>
    </div>

    <div class="hy-pill hy-add-pill">
      <div class="hy-tip-wrap">
        <button
          type="button"
          class="hy-icon-btn hy-add"
          aria-label="Add images"
          onclick={() => onAddImages()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M12 5.5v13M5.5 12h13"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
            />
          </svg>
        </button>
        <span class="hy-tooltip" role="tooltip">
          <span class="hy-tip-label">Add images</span>
        </span>
      </div>
    </div>
  </div>
</header>

<style>
  .hy-topbar {
    position: fixed;
    top: var(--hy-margin);
    left: var(--hy-margin);
    right: var(--hy-margin);
    z-index: 22;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    pointer-events: none;
  }
  .hy-topbar > * {
    pointer-events: auto;
  }

  /* ── Left: brand + nav panel ─────────────────────────────────────────── */
  .hy-brand-panel {
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--hy-topbar-h);
    padding: 0 18px 0 14px;
    background: var(--pc-surface);
    border: 1px solid var(--pc-border);
    border-radius: 16px;
    box-shadow: var(--pc-shadow-panel);
  }
  @supports (corner-shape: squircle) {
    .hy-brand-panel {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .hy-logo {
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    color: var(--pc-text-1);
  }
  .hy-logo svg {
    width: 22px;
    height: 22px;
    display: block;
  }

  .hy-wordmark {
    font-size: 15px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--pc-text-1);
  }

  .hy-nav {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-left: 6px;
    padding-left: 12px;
    border-left: 1px solid var(--pc-border);
  }

  /* Sentence-case, 13px medium — porcelain has NO uppercase tracking. */
  .hy-nav-item {
    font-size: 13px;
    font-weight: 500;
    color: var(--pc-text-2);
    text-decoration: none;
    transition: color 140ms ease;
  }
  .hy-nav-item:hover {
    color: var(--pc-text-1);
  }
  .hy-nav-item.active {
    color: var(--pc-text-1);
    font-weight: 600;
  }
  .hy-nav-item:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 3px;
    border-radius: 4px;
  }

  /* ── Right: action pills ─────────────────────────────────────────────── */
  .hy-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .hy-pill {
    display: flex;
    align-items: center;
    height: var(--hy-topbar-h);
    padding: 0 7px;
    background: var(--pc-surface);
    border: 1px solid var(--pc-border);
    border-radius: 16px;
    box-shadow: var(--pc-shadow-panel);
  }
  @supports (corner-shape: squircle) {
    .hy-pill {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .hy-icon-pair {
    gap: 4px;
  }

  .hy-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border: none;
    border-radius: 12px;
    background: transparent;
    color: var(--pc-text-1);
    cursor: pointer;
    padding: 0;
    transition:
      background-color 140ms ease,
      opacity 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .hy-icon-btn {
      corner-shape: squircle;
      border-radius: 13px;
    }
  }
  .hy-icon-btn svg {
    width: 20px;
    height: 20px;
  }
  .hy-icon-btn:hover:not(:disabled) {
    background: var(--pc-inset);
  }
  .hy-icon-btn:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .hy-icon-btn:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .hy-add svg {
    width: 22px;
    height: 22px;
  }

  /* Pure-CSS near-black tooltip below the control (kbd right-aligned). */
  .hy-tip-wrap {
    position: relative;
    display: inline-flex;
  }
  .hy-tooltip {
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
  .hy-tip-wrap:hover .hy-tooltip,
  .hy-icon-btn:focus-visible + .hy-tooltip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }
  .hy-tip-kbd {
    color: var(--pc-tooltip-kbd);
    font-variant-numeric: tabular-nums;
  }

  /* ── Export: porcelain neutral primary ───────────────────────────────── */
  .hy-export-pill {
    padding: 0 7px;
  }
  .hy-export {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    height: 40px;
    padding: 0 16px;
    border-radius: 12px;
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
    .hy-export {
      corner-shape: squircle;
      border-radius: 13px;
    }
  }
  .hy-export:hover:not(.disabled) {
    background: light-dark(#000000, #ffffff);
  }
  .hy-export.disabled {
    opacity: 0.45;
    pointer-events: none;
  }
  .hy-export:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }
  .hy-export-icon {
    width: 17px;
    height: 17px;
  }

  .hy-spinner {
    width: 14px;
    height: 14px;
    border: 2px solid
      light-dark(rgba(255, 255, 255, 0.35), rgba(20, 20, 15, 0.3));
    border-top-color: light-dark(#ffffff, #16161c);
    border-radius: 50%;
    animation: hy-spin 0.8s linear infinite;
  }
  @keyframes hy-spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .hy-tooltip,
    .hy-export,
    .hy-icon-btn {
      transition-duration: 0ms;
    }
    .hy-spinner {
      animation-duration: 0ms;
    }
  }

  /* Compact below 760px: hide Export text + nav shrinks. */
  @media (max-width: 760px) {
    .hy-export-text {
      display: none;
    }
    .hy-export {
      padding: 0 12px;
    }
  }
</style>
