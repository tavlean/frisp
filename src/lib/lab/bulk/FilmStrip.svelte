<script lang="ts">
  // Horizontal strip of job thumbnails (design doc §5).
  //  - coral RING on the selected item (selection ONLY, never "overridden");
  //  - small coral corner DOT when the job has overrides;
  //  - spinner overlay while the job is processing;
  //  - tiny caption under each: new size + green ▼% once done.
  // Click selects. Keyed on job id.
  import { labBulk } from './store.svelte';
  import type { BulkStripItem } from 'client/lazy-app/bulk';

  const items = $derived(labBulk.stripItems);

  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  function thumbUrl(id: string): string | undefined {
    return labBulk.thumbs.get(id)?.url;
  }

  function isProcessing(item: BulkStripItem): boolean {
    return item.statusGroup === 'active';
  }

  function percentText(item: BulkStripItem): string | null {
    if (item.percentChange === undefined) return null;
    const rounded = Math.round(item.percentChange);
    if (rounded < 0) return `▼ ${Math.abs(rounded)}%`;
    if (rounded > 0) return `▲ ${rounded}%`;
    return '0%';
  }
</script>

<div class="filmstrip" role="listbox" aria-label="Images">
  {#each items as item (item.id)}
    <div class="cell">
      <button
        type="button"
        class="thumb"
        class:selected={item.selected}
        role="option"
        aria-selected={item.selected}
        title={item.fileName}
        onclick={() => labBulk.select(item.id)}
      >
        {#if thumbUrl(item.id)}
          <img src={thumbUrl(item.id)} alt="" draggable="false" />
        {:else}
          <span class="placeholder" aria-hidden="true"></span>
        {/if}

        {#if item.hasOverrides}
          <span class="override-dot" aria-label="Custom settings"></span>
        {/if}

        {#if isProcessing(item)}
          <span class="spinner-overlay" aria-hidden="true">
            <span class="spinner"></span>
          </span>
        {:else if item.statusGroup === 'failed'}
          <span class="badge failed" aria-label="Failed">!</span>
        {/if}
      </button>

      <div class="caption">
        {#if item.outputSize !== undefined && percentText(item)}
          <span class="size">{prettySize(item.outputSize)}</span>
          <span
            class="delta"
            class:down={(item.percentChange ?? 0) < 0}
            class:up={(item.percentChange ?? 0) > 0}
          >
            {percentText(item)}
          </span>
        {:else if isProcessing(item)}
          <span class="pending">Encoding…</span>
        {:else}
          <span class="pending">Queued</span>
        {/if}
      </div>
    </div>
  {/each}
</div>

<style>
  /* Quiet dock: sits inside the strip-region the layout reserves for it.
     Horizontal scroll with no scrollbar chrome until the strip is hovered. */
  .filmstrip {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    overflow-x: auto;
    padding: 6px 0;
    scrollbar-width: none;
    scroll-snap-type: x proximity;
  }
  .filmstrip::-webkit-scrollbar {
    height: 6px;
  }
  .filmstrip::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
  }
  .filmstrip:hover {
    scrollbar-width: thin;
  }
  .filmstrip:hover::-webkit-scrollbar-thumb {
    background: var(--border-strong, rgba(255, 255, 255, 0.16));
  }

  .cell {
    flex: none;
    width: 104px;
    display: grid;
    gap: 4px;
    scroll-snap-align: start;
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

  .thumb:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
  }

  .thumb.selected {
    border-color: var(--accent-1, #ff8a5e);
    box-shadow: 0 0 0 1px var(--accent-1, #ff8a5e);
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

  .override-dot {
    position: absolute;
    top: 5px;
    right: 5px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--accent-1, #ff8a5e);
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

  /* One compact line: dim size + smaller delta pill. */
  .caption {
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 0 1px;
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    line-height: 1.2;
  }

  .size {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .delta {
    flex: none;
    font-weight: 700;
  }

  .delta.down {
    color: var(--good, #3ddc97);
  }

  .delta.up {
    color: var(--warn, #ffb020);
  }

  .pending {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-weight: 500;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
