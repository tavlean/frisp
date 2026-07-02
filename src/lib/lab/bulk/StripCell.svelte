<script lang="ts">
  // One strip thumbnail cell, shared by L3's Rich strip and L4's Adaptive dock.
  // The `mode` drives how many pixels the cell earns and how rich its caption is
  // — but the affordances are identical everywhere:
  //   • azure selection RING (selection only, never "overridden");
  //   • azure corner DOT when the job carries per-image overrides;
  //   • spinner / failed overlay driven by statusGroup;
  //   • a glass hover/focus DOWNLOAD button (top-right, down-arrow) that saves
  //     THIS image's optimized output — mirrors production's save affordances.
  // Click selects. The parent keys on job id.
  //
  // Caption richness by mode:
  //   s     → size + bare delta (the L1 baseline caption)
  //   m     → name; "251 kB → 26.2 kB" + delta pill
  //   l     → two lines: name; sizes + delta pill (browsing-first)
  //   dense → just the delta pill; name + sizes live in the title tooltip
  import type { BulkStripItem } from 'client/lazy-app/bulk';
  import { labBulk } from './store.svelte';
  import DeltaPill from './DeltaPill.svelte';

  interface Props {
    item: BulkStripItem;
    /** Presentation size. `dense` = L4's two-row small-thumb mode. */
    mode: 's' | 'm' | 'l' | 'dense';
  }

  let { item, mode }: Props = $props();

  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
  // Decimal (SI, base-1000), 3 sig figs — matches Results.svelte / BatchInfoPanel
  // so every size in the app reads identically.
  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  const thumbUrl = $derived(labBulk.thumbs.get(item.id)?.url);
  const processing = $derived(item.statusGroup === 'active');
  const download = $derived(labBulk.downloadFor(item.id));
  const selected = $derived(labBulk.isSelected(item.id));
  const anchor = $derived(labBulk.selectedId === item.id);
  const hasOutput = $derived(
    item.outputSize !== undefined && item.percentChange !== undefined,
  );

  // Compact "251 kB → 26.2 kB" transform line (m / l captions).
  const transform = $derived(
    hasOutput
      ? `${prettySize(item.originalSize)} → ${prettySize(item.outputSize!)}`
      : '',
  );

  // A full one-line summary for the dense mode's tooltip (name is on the button
  // title too, but the dense caption hides sizes so the title carries them).
  const denseTitle = $derived(
    hasOutput
      ? `${item.fileName} — ${transform}`
      : processing
        ? `${item.fileName} — encoding…`
        : `${item.fileName} — queued`,
  );

  // The download anchor must not also trigger selection.
  function stopSelect(event: Event): void {
    event.stopPropagation();
  }
</script>

<div class="cell {mode}" data-bulk-cell-id={item.id}>
  <div class="thumb-wrap">
    <button
      type="button"
      class="thumb"
      class:selected
      class:anchor
      role="option"
      aria-selected={selected}
      title={mode === 'dense' ? denseTitle : item.fileName}
    >
      {#if thumbUrl}
        <img src={thumbUrl} alt="" draggable="false" />
      {:else}
        <span class="placeholder" aria-hidden="true"></span>
      {/if}

      {#if item.hasOverrides}
        <span class="override-dot" aria-label="Custom settings"></span>
      {/if}

      {#if processing}
        <span class="spinner-overlay" aria-hidden="true">
          <span class="spinner"></span>
        </span>
      {:else if item.statusGroup === 'failed'}
        <span class="badge failed" aria-label="Failed">!</span>
      {/if}
    </button>

    {#if download}
      <!-- Glass circle + down-arrow, top-right, as a SIBLING of the select
           button (an interactive anchor can't nest inside a button). Appears on
           cell hover / thumb focus; a click saves the file. -->
      <a
        class="download"
        href={download.url}
        download={download.fileName}
        title={`Download ${download.fileName}`}
        aria-label={`Download ${download.fileName}`}
        onclick={stopSelect}
        onpointerdown={stopSelect}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4v11m0 0l-4.2-4.2M12 15l4.2-4.2M5 19h14"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </a>
    {/if}
  </div>

  {#if mode !== 'dense'}
    <div class="caption">
      {#if mode === 'l'}
        <span class="name" title={item.fileName}>{item.fileName}</span>
      {/if}

      {#if hasOutput}
        {#if mode === 's'}
          <span class="size">{prettySize(item.outputSize!)}</span>
          <DeltaPill percent={item.percentChange!} variant="bare" />
        {:else}
          <span class="line">
            <span class="transform">{transform}</span>
            <DeltaPill percent={item.percentChange!} variant="pill" />
          </span>
        {/if}
      {:else if processing}
        <span class="pending">Encoding…</span>
      {:else}
        <span class="pending">Queued</span>
      {/if}
    </div>
  {:else if hasOutput}
    <!-- Dense: only the delta pill under the thumb; name + sizes on hover. -->
    <div class="caption dense-caption">
      <DeltaPill percent={item.percentChange!} variant="pill" />
    </div>
  {:else}
    <div class="caption dense-caption">
      <span class="pending">{processing ? '…' : '–'}</span>
    </div>
  {/if}
</div>

<style>
  .cell {
    flex: none;
    display: grid;
    gap: 6px;
    scroll-snap-align: start;
  }

  /* ── Cell footprint by mode ─────────────────────────────────────────────── */
  .cell.s {
    width: 104px;
    gap: 4px;
  }
  .cell.m {
    width: 172px;
  }
  .cell.l {
    width: 240px;
    gap: 8px;
  }
  .cell.dense {
    width: 92px;
    gap: 4px;
  }

  .thumb-wrap {
    position: relative;
  }

  .thumb {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 16 / 10;
    padding: 0;
    border: 1.5px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 8px;
    background: var(--surface-solid, #16161c);
    overflow: hidden;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease;
  }
  .cell.l .thumb {
    border-radius: 10px;
  }

  .thumb:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
  }

  /* Selection ring is AZURE — "this is the image being inspected", the same hue
     the right panel wears while editing a single image. */
  .thumb.selected {
    border-color: var(--accent-2, #53b2ff);
    box-shadow: 0 0 0 1px var(--accent-2, #53b2ff);
  }
  .thumb.anchor {
    box-shadow:
      0 0 0 1px var(--accent-2, #53b2ff),
      0 0 18px var(--accent-2-glow, rgba(74, 163, 255, 0.32));
  }

  .thumb img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      var(--surface-raise, rgba(255, 255, 255, 0.06)),
      transparent
    );
  }

  /* Custom-settings dot is AZURE — a per-image deviation is a single-image
     concept, matching the strip ring + left panel. */
  .override-dot {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-2, #53b2ff);
    box-shadow: 0 0 0 2px var(--surface-solid, #16161c);
  }

  .spinner-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(12, 12, 15, 0.55);
    backdrop-filter: blur(1px);
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255, 255, 255, 0.25);
    border-top-color: var(--accent-1, #ff8a5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .badge.failed {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(12, 12, 15, 0.55);
    color: var(--bad, #ff7d92);
    font-weight: 700;
    font-size: 1.2rem;
  }

  /* ── Hover / focus download button ──────────────────────────────────────── */
  /* A glass circle in the thumb's top-right, matching production's save
     affordance. Hidden until the cell is hovered or the thumb is focused,
     so the resting strip stays clean. */
  .download {
    position: absolute;
    top: 6px;
    right: 6px;
    width: 30px;
    height: 30px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    color: var(--text-1, #f5f5f7);
    background: rgba(12, 12, 15, 0.62);
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.16));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
    opacity: 0;
    transform: scale(0.85);
    pointer-events: none;
    transition:
      opacity 150ms ease,
      transform 150ms ease,
      color 150ms ease,
      border-color 150ms ease;
    text-decoration: none;
  }
  .cell.dense .download {
    width: 26px;
    height: 26px;
    top: 4px;
    right: 4px;
  }
  .cell:hover .download,
  .thumb-wrap:focus-within .download,
  .download:focus-visible {
    opacity: 1;
    transform: scale(1);
    pointer-events: auto;
  }
  .download:hover {
    color: var(--accent-2, #53b2ff);
    border-color: var(--accent-2, #53b2ff);
  }
  .download:focus-visible {
    outline: 2px solid var(--accent-2, #53b2ff);
    outline-offset: 2px;
  }
  .download svg {
    width: 15px;
    height: 15px;
    display: block;
  }
  .cell.dense .download svg {
    width: 13px;
    height: 13px;
  }

  /* ── Captions ───────────────────────────────────────────────────────────── */
  .caption {
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 0 1px;
    font-variant-numeric: tabular-nums;
    line-height: 1.25;
    min-width: 0;
  }
  .cell.l .caption {
    flex-direction: column;
    align-items: stretch;
    gap: 4px;
  }
  .dense-caption {
    justify-content: center;
  }

  .name {
    color: var(--text-1, #f5f5f7);
    font-size: 0.9rem;
    font-weight: 650;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .size {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.88rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .line {
    display: flex;
    align-items: center;
    gap: 7px;
    min-width: 0;
  }

  .transform {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.84rem;
    font-weight: 550;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .caption :global(.delta.bare) {
    flex: none;
    font-size: 0.8rem;
  }
  .caption :global(.delta.pill) {
    flex: none;
    font-size: 0.78rem;
    padding: 1px 7px 1px 5px;
  }

  .pending {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.82rem;
    font-weight: 500;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .download {
      transition: opacity 100ms ease;
      transform: none;
    }
    .cell:hover .download,
    .thumb-wrap:focus-within .download,
    .download:focus-visible {
      transform: none;
    }
    .spinner {
      animation: none;
    }
  }
</style>
