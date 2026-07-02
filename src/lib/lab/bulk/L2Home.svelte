<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import BatchInfoPanel from './BatchInfoPanel.svelte';
  import FocusView from './FocusView.svelte';
  import GlobalOptionsPanel from './GlobalOptionsPanel.svelte';
  import DeltaPill from './DeltaPill.svelte';
  import { labBulk } from './store.svelte';

  interface Props {
    focusSession: EditorSession;
    onReseed: () => void;
  }

  let { focusSession, onReseed }: Props = $props();
  let mode = $state<'grid' | 'focus'>('grid');

  const items = $derived(labBulk.stripItems);
  const file = $derived(labBulk.selectedFile);
  const thumb = $derived(labBulk.selectedThumb);

  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];

  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  function openCard(id: string): void {
    labBulk.select(id);
    mode = 'focus';
    onReseed();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && mode === 'focus') {
      event.preventDefault();
      mode = 'grid';
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if mode === 'grid'}
  <div class="grid-home sqush-editor">
    <main class="cards" aria-label="Images">
      {#each items as item (item.id)}
        {@const itemThumb = labBulk.thumbs.get(item.id)}
        <button
          type="button"
          class="card"
          class:selected={item.selected}
          in:fade={{ duration: 150 }}
          title={item.fileName}
          onclick={() => openCard(item.id)}
        >
          <span class="thumb-wrap">
            {#if itemThumb}
              <img src={itemThumb.url} alt="" draggable="false" />
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
              {#if item.percentChange !== undefined}
                <DeltaPill percent={item.percentChange} />
              {/if}
            </span>
          </span>
        </button>
      {/each}
    </main>

    <aside class="options options-1">
      <BatchInfoPanel {file} width={thumb?.w ?? 0} height={thumb?.h ?? 0} />
    </aside>

    <aside class="options options-2">
      <GlobalOptionsPanel {focusSession} />
    </aside>
  </div>
{:else}
  <FocusView {focusSession} onBack={() => (mode = 'grid')} {onReseed} />
{/if}

<style>
  .grid-home {
    --mobile-options-height: min(44dvh, 360px);
    --panel-width: 312px;
    --panel-inset: 14px;
    --fit-inset-left: calc(var(--panel-width) + var(--panel-inset) * 2);
    --fit-inset-right: calc(var(--panel-width) + var(--panel-inset) * 2);
    position: relative;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
    background: var(--bg-0, #0c0c0f);
  }

  .cards {
    position: absolute;
    top: 72px;
    left: var(--fit-inset-left);
    right: var(--fit-inset-right);
    bottom: var(--panel-inset);
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
    gap: 14px;
    align-content: start;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 2px 12px;
  }

  .options {
    position: absolute;
    bottom: var(--panel-inset);
    width: var(--panel-width);
    max-height: calc(100% - 76px);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    color: var(--text-1, #fff);
    font-size: 1.2rem;
    z-index: 5;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(20px) saturate(1.3);
    -webkit-backdrop-filter: blur(20px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--options-radius, 16px);
    box-shadow: var(--panel-shadow, 0 24px 48px -16px rgba(0, 0, 0, 0.55));
    overflow: hidden;
  }
  .options-1 {
    left: var(--panel-inset);
  }
  .options-2 {
    right: var(--panel-inset);
  }
  /* The grid's right panel only ever edits GLOBAL batch settings, so it wears
     the coral scope colour. Scoped under .grid-home to out-specify theme.css's
     `.sqush-editor .options-2` azure default. */
  .grid-home .options-2 {
    --main-theme-color: var(--accent-1, #ff8a5e);
    --hot-theme-color: var(--accent-1-hot, #ff6a3c);
    --main-theme-glow: var(--accent-1-glow, rgba(255, 122, 80, 0.32));
    --accent-color: var(--accent-1, #ff8a5e);
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

  /* Selection ring is BLUE — matches the strip + single-image scope. */
  .card.selected {
    border-color: var(--accent-2, #53b2ff);
    box-shadow: 0 0 0 1px var(--accent-2, #53b2ff);
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

  /* Custom-settings dot is BLUE — marks a per-image deviation. */
  .override-dot {
    position: absolute;
    top: 8px;
    right: 8px;
    width: 10px;
    height: 10px;
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

  .arrow {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-weight: 400;
    margin: 0 2px;
  }

  .meta :global(.delta) {
    font-size: 0.85rem;
  }

  @media (max-width: 760px) {
    .grid-home {
      --panel-inset: 6px;
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
    }

    .cards {
      top: 64px;
      left: var(--panel-inset);
      right: var(--panel-inset);
      bottom: calc(var(--mobile-options-height) + var(--panel-inset) * 2);
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    }

    .options {
      width: calc(50vw - var(--panel-inset) * 1.5);
      height: var(--mobile-options-height);
      max-height: var(--mobile-options-height);
      font-size: 0.95rem;
    }
  }

  @media (max-width: 420px) {
    .grid-home {
      --mobile-options-height: 48dvh;
    }

    .cards {
      grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
