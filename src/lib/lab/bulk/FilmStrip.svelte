<script lang="ts">
  // Horizontal strip of job thumbnails (design doc §5).
  //  - coral RING on the selected item (selection ONLY, never "overridden");
  //  - small coral corner DOT when the job has overrides;
  //  - spinner overlay while the job is processing;
  //  - caption under each: new size + a DeltaPill (shared arrow) once done.
  // Click selects. Keyed on job id.
  import { labBulk } from './store.svelte';
  import type { BulkStripItem } from 'client/lazy-app/bulk';
  import DeltaPill from './DeltaPill.svelte';

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
        {#if item.outputSize !== undefined && item.percentChange !== undefined}
          <span class="size">{prettySize(item.outputSize)}</span>
          <DeltaPill percent={item.percentChange} variant="bare" />
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
    /* Safe centering: the row is centered while the thumbs fit, but the moment
       they overflow it left-aligns for scrolling with no clipped first item.
       `safe center` is the modern one-liner; the `auto` margins on the content
       wrapper below are the fallback for engines without `safe`. */
    justify-content: safe center;
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

  /* Selection ring is BLUE — it marks "this is the image being inspected",
     the same azure the right panel wears while editing a single image. */
  .thumb.selected {
    border-color: var(--accent-2, #53b2ff);
    box-shadow: 0 0 0 1px var(--accent-2, #53b2ff);
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

  /* Custom-settings dot is BLUE — it marks a per-image deviation, which is
     inherently a single-image (azure) concept, not a batch (coral) one. */
  .override-dot {
    position: absolute;
    top: 5px;
    right: 5px;
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

  /* One compact line: readable size + a slightly smaller delta. The size gets
     the biggest bump (it was near-illegible); the delta stays a touch smaller
     but still readable at arm's length. */
  .caption {
    display: flex;
    align-items: baseline;
    gap: 5px;
    padding: 0 1px;
    font-variant-numeric: tabular-nums;
    line-height: 1.25;
  }

  .size {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.88rem;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .caption :global(.delta) {
    flex: none;
    font-size: 0.8rem;
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
</style>
