<script lang="ts">
  // L4 "Adaptive dock": the strip picks its own shape from the image count.
  //   ≤6   → large rich cells (few images deserve big presence)     [layout=big]
  //   7–18 → medium cells, single row, horizontal scroll            [layout=row]
  //   >18  → DENSE: small thumbs wrapping into two rows, vertically  [layout=dense]
  //          capped, captions collapse to the delta pill (name +
  //          sizes on hover), internal vertical scroll if it overflows.
  // The parent (FocusView, via L4Home) reads the layout back to size the strip
  // region; the wrapper cross-fades on the layout so count changes don't jank.
  import { labBulk } from './store.svelte';
  import StripCell from './StripCell.svelte';
  import { createStripSelectionController } from './strip-selection';

  const items = $derived(labBulk.stripItems);
  const count = $derived(items.length);
  const selection = createStripSelectionController();

  type AdaptiveLayout = 'big' | 'row' | 'dense';
  const layout = $derived<AdaptiveLayout>(
    count <= 6 ? 'big' : count <= 18 ? 'row' : 'dense',
  );
  const cellMode = $derived(
    layout === 'big' ? 'l' : layout === 'row' ? 'm' : ('dense' as const),
  );
</script>

<div class="adaptive layout-{layout}">
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
      <StripCell {item} mode={cellMode} />
    {/each}
  </div>
</div>

<style>
  .adaptive {
    width: 100%;
    height: 100%;
    min-height: 0;
    /* The layout change is the visible transition: the scroller retimes its
       flow while the region height eases in FocusView. */
    transition: opacity 200ms ease;
  }

  .scroller {
    display: flex;
    height: 100%;
    min-height: 0;
    box-sizing: border-box;
    scrollbar-width: none;
  }
  .scroller::-webkit-scrollbar {
    width: 6px;
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

  /* big / row: a single horizontal row, centered while it fits then
     left-aligned for scrolling (safe center). */
  .layout-big .scroller,
  .layout-row .scroller {
    align-items: center;
    justify-content: safe center;
    gap: 12px;
    overflow-x: auto;
    padding: 8px 2px;
    scroll-snap-type: x proximity;
  }
  .layout-row .scroller {
    gap: 10px;
  }

  /* dense: wrap into (up to) two rows, cap the height, scroll vertically if the
     two rows still overflow. Content-start so the grid packs from the top-left
     and never leaves a lonely centered row. */
  .layout-dense .scroller {
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: safe center;
    gap: 8px 10px;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 8px 4px;
  }
</style>
