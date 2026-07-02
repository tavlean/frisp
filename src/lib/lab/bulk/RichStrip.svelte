<script lang="ts">
  // Size-adjustable rich strip. The shared view-mode control sits in the strip's
  // right corner and persists (session-scoped) in the store. The chosen size
  // drives both the cell footprint and the strip-region height.
  import { labBulk } from './store.svelte';
  import StripCell from './StripCell.svelte';
  import ViewModePicker from './ViewModePicker.svelte';
  import { createStripSelectionController } from './strip-selection';

  const items = $derived(labBulk.stripItems);
  const size = $derived(labBulk.focusStripSize);
  const selection = createStripSelectionController();
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

  <ViewModePicker />
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

  @media (prefers-reduced-motion: reduce) {
    .rich-strip :global(.view-mode button:hover:not(.active)) {
      transform: none;
    }
  }
</style>
