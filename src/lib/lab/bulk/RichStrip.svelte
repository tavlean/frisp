<script lang="ts">
  // L3 "Rich strip": the L1 filmstrip, but size-adjustable. A quiet S/M/L
  // control sits in the strip's right corner and persists (session-scoped) in
  // the store. The chosen size drives both the cell footprint (via StripCell)
  // and the strip-region height (via the CSS var FocusView reads back).
  import { labBulk, type StripSize } from './store.svelte';
  import StripCell from './StripCell.svelte';
  import { createStripSelectionController } from './strip-selection';

  const items = $derived(labBulk.stripItems);
  const size = $derived(labBulk.stripSize);
  const selection = createStripSelectionController();

  const SIZES: { id: StripSize; label: string; title: string }[] = [
    { id: 's', label: 'S', title: 'Small thumbnails' },
    { id: 'm', label: 'M', title: 'Medium thumbnails' },
    { id: 'l', label: 'L', title: 'Large thumbnails' },
  ];

  function setSize(next: StripSize): void {
    labBulk.stripSize = next;
  }
</script>

<div class="rich-strip size-{size}">
  <div
    class="scroller"
    role="listbox"
    aria-label="Images"
    tabindex="-1"
    onclick={selection.onClick}
    onkeydown={selection.onKeydown}
    onpointerdown={selection.onPointerdown}
    onpointermove={selection.onPointermove}
    onpointerup={selection.onPointerup}
    onpointercancel={selection.onPointercancel}
  >
    {#each items as item (item.id)}
      <StripCell {item} mode={size} />
    {/each}
  </div>

  <div class="size-control" role="radiogroup" aria-label="Thumbnail size">
    {#each SIZES as option (option.id)}
      <button
        type="button"
        class:active={size === option.id}
        role="radio"
        aria-checked={size === option.id}
        title={option.title}
        onclick={() => setSize(option.id)}
      >
        {option.label}
      </button>
    {/each}
  </div>
</div>

<style>
  .rich-strip {
    display: flex;
    align-items: stretch;
    gap: 10px;
    width: 100%;
    height: 100%;
    min-height: 0;
  }

  /* Horizontal scroller: centered while the thumbs fit, left-aligned the moment
     they overflow (safe center), scrollbar chrome only on hover. */
  .scroller {
    display: flex;
    align-items: center;
    justify-content: safe center;
    gap: 10px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    padding: 8px 2px;
    scrollbar-width: none;
    scroll-snap-type: x proximity;
  }
  .scroller::-webkit-scrollbar {
    height: 6px;
  }
  .scroller::-webkit-scrollbar-thumb {
    background: transparent;
    border-radius: 999px;
  }
  .scroller:hover {
    scrollbar-width: thin;
  }
  .scroller:hover::-webkit-scrollbar-thumb {
    background: var(--border-strong, rgba(255, 255, 255, 0.16));
  }

  /* Quiet segmented S/M/L control pinned to the strip's right corner. Vertically
     centered, icon-like weight, azure active pip (the single-image scope hue —
     the strip is about picking one image to inspect). */
  .size-control {
    flex: none;
    align-self: center;
    display: inline-flex;
    padding: 2px;
    border-radius: 999px;
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  }
  .size-control button {
    width: 26px;
    height: 24px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font: inherit;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }
  .size-control button:hover:not(.active) {
    color: var(--text-1, #f5f5f7);
  }
  .size-control button.active {
    background: var(--accent-2, #53b2ff);
    color: #16161c;
  }
  .size-control button:focus-visible {
    outline: 2px solid var(--accent-2, #53b2ff);
    outline-offset: 2px;
  }
</style>
