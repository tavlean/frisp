<script lang="ts">
  // VARIANT L2 — "Grid home" (bulk-grid-dashboard.webp).
  //
  // Dropping N images lands on a CARD GRID with the batch/global panel on the
  // left. Clicking a card opens the SAME focus view as L1 (shared FocusView)
  // with "← All images" / Esc returning to the grid. Scope is geographic:
  // grid = everyone, focus = this one image.
  //
  // Signaling per design doc §5: coral RING = selected (only), corner DOT =
  // has overrides, spinner ring = encoding, amber ▲ pill = output larger.
  import { fade } from 'svelte/transition';
  import FocusView from './FocusView.svelte';
  import PanelControls from './PanelControls.svelte';
  import { labBulk } from './store.svelte';

  let mode = $state<'grid' | 'focus'>('grid');

  const items = $derived(labBulk.stripItems);
  const summary = $derived(labBulk.summary);
  const output = $derived(summary.output);
  const progress = $derived(summary.progress);
  const busy = $derived(progress.active + progress.queued > 0);

  function openCard(id: string) {
    labBulk.select(id);
    mode = 'focus';
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && mode === 'focus') {
      event.preventDefault();
      mode = 'grid';
    }
  }

  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  function deltaFor(percent: number | undefined) {
    if (percent === undefined) return null;
    const rounded = Math.round(percent);
    if (rounded < 0) return { text: `▼ ${Math.abs(rounded)}%`, up: false };
    if (rounded > 0) return { text: `▲ ${rounded}%`, up: true };
    return { text: '0%', up: false };
  }

  const batchDelta = $derived.by(() =>
    output.optimized > 0 ? deltaFor(output.percentChange) : null,
  );
</script>

<svelte:window onkeydown={onKeydown} />

{#if mode === 'grid'}
  <div class="grid-home">
    <aside class="batch-panel" aria-label="Batch settings">
      <header class="head">
        <h2>All images</h2>
        <p class="count">{summary.totalJobs} images</p>
      </header>

      <PanelControls scope="global" />

      <div class="totals">
        <span class="sizes">
          {prettySize(output.totalOriginalSize)}
          <span class="arrow" aria-hidden="true">→</span>
          {#if output.optimized > 0}
            {prettySize(output.totalOutputSize)}
          {:else}
            …
          {/if}
        </span>
        {#if batchDelta}
          <span
            class="pill"
            class:up={batchDelta.up}
            class:down={!batchDelta.up}
          >
            {batchDelta.text}
          </span>
        {/if}
      </div>

      {#if busy}
        <p class="progress">
          <span class="mini-spinner" aria-hidden="true"></span>
          Encoding {progress.completed} of {progress.total}…
        </p>
      {:else if progress.failed > 0}
        <p class="failed">{progress.failed} failed</p>
      {/if}

      <button
        type="button"
        class="save-all"
        onclick={() => labBulk.saveAllStub()}
      >
        Save all · ZIP
      </button>
    </aside>

    <main class="cards" aria-label="Images">
      {#each items as item (item.id)}
        {@const thumb = labBulk.thumbs.get(item.id)}
        {@const delta = deltaFor(item.percentChange)}
        <button
          type="button"
          class="card"
          class:selected={item.selected}
          in:fade={{ duration: 150 }}
          title={item.fileName}
          onclick={() => openCard(item.id)}
        >
          <span class="thumb-wrap">
            {#if thumb}
              <img src={thumb.url} alt="" draggable="false" />
            {:else}
              <span class="shimmer" aria-hidden="true"></span>
            {/if}

            {#if item.hasOverrides}
              <span class="override-dot" aria-label="Custom settings"></span>
            {/if}

            {#if item.statusGroup === 'active'}
              <span class="spinner-overlay" aria-hidden="true">
                <span class="spinner"></span>
              </span>
            {:else if item.statusGroup === 'failed'}
              <span class="failed-overlay" aria-label="Failed">!</span>
            {/if}
          </span>

          <span class="card-body">
            <span class="name">{item.fileName}</span>
            <span class="meta">
              <span class="card-sizes">
                {prettySize(item.originalSize)}
                <span class="arrow" aria-hidden="true">→</span>
                {#if item.outputSize !== undefined}
                  {prettySize(item.outputSize)}
                {:else if item.statusGroup === 'active'}
                  …
                {:else}
                  queued
                {/if}
              </span>
              {#if delta}
                <span class="pill" class:up={delta.up} class:down={!delta.up}>
                  {delta.text}
                </span>
              {/if}
            </span>
          </span>
        </button>
      {/each}
    </main>
  </div>
{:else}
  <FocusView onBack={() => (mode = 'grid')}>
    {#snippet left()}
      <section class="focus-batch-card" aria-label="Batch">
        <div class="totals">
          <span class="sizes">
            {summary.totalJobs} images ·
            {prettySize(output.totalOriginalSize)}
            <span class="arrow" aria-hidden="true">→</span>
            {#if output.optimized > 0}
              {prettySize(output.totalOutputSize)}
            {:else}
              …
            {/if}
          </span>
          {#if batchDelta}
            <span
              class="pill"
              class:up={batchDelta.up}
              class:down={!batchDelta.up}
            >
              {batchDelta.text}
            </span>
          {/if}
        </div>
        <button
          type="button"
          class="save-all"
          onclick={() => labBulk.saveAllStub()}
        >
          Save all · ZIP
        </button>
      </section>
    {/snippet}
  </FocusView>
{/if}

<style>
  .grid-home {
    display: grid;
    grid-template-columns: minmax(260px, 320px) minmax(0, 1fr);
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  .batch-panel {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--options-radius, 16px);
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    min-height: 0;
    overflow-y: auto;
    align-self: start;
    max-height: 100%;
  }

  .head h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
  }

  .count {
    margin: 2px 0 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.9rem;
  }

  .totals {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }

  .sizes {
    color: var(--text-1, #f5f5f7);
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .arrow {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-weight: 400;
    margin: 0 2px;
  }

  .pill {
    padding: 1px 9px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .pill.down {
    background: rgba(61, 220, 151, 0.14);
    color: var(--good, #3ddc97);
  }

  .pill.up {
    background: rgba(255, 176, 32, 0.14);
    color: var(--warn, #ffb020);
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  .mini-spinner {
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.22);
    border-top-color: var(--accent-1, #ff8a5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    flex: none;
  }

  .failed {
    margin: 0;
    color: var(--bad, #ff7d92);
    font-size: 0.9rem;
    font-weight: 600;
  }

  .save-all {
    padding: 11px 16px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(
      135deg,
      var(--accent-1, #ff8a5e),
      var(--accent-1-hot, #ff6a3c)
    );
    color: #16161c;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
    transition: filter 150ms ease;
  }

  .save-all:hover {
    filter: brightness(1.08);
  }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 14px;
    align-content: start;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 2px 12px;
  }

  .card {
    display: flex;
    flex-direction: column;
    padding: 0;
    border: 2px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    overflow: hidden;
    cursor: pointer;
    text-align: left;
    font: inherit;
    transition:
      border-color 150ms ease,
      box-shadow 150ms ease,
      transform 150ms ease;
  }

  .card:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    transform: translateY(-1px);
  }

  .card.selected {
    border-color: var(--accent-1, #ff8a5e);
    box-shadow: 0 0 0 1px var(--accent-1, #ff8a5e);
  }

  .thumb-wrap {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: var(--surface-solid, #16161c);
  }

  .thumb-wrap img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .shimmer {
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
    top: 8px;
    right: 8px;
    width: 10px;
    height: 10px;
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
    width: 26px;
    height: 26px;
    border: 3px solid rgba(255, 255, 255, 0.25);
    border-top-color: var(--accent-1, #ff8a5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .failed-overlay {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    background: rgba(12, 12, 15, 0.55);
    color: var(--bad, #ff7d92);
    font-weight: 700;
    font-size: 1.5rem;
  }

  .card-body {
    display: grid;
    gap: 4px;
    padding: 10px 12px 12px;
  }

  .name {
    color: var(--text-1, #f5f5f7);
    font-weight: 600;
    font-size: 0.95rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .meta {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px;
  }

  .card-sizes {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.85rem;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .focus-batch-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--options-radius, 16px);
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
  }

  @media (max-width: 900px) {
    .grid-home {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr);
    }

    .batch-panel {
      max-height: none;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
