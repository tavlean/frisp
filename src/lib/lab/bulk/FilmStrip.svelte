<script lang="ts">
  // Horizontal strip of job thumbnails (design doc §5). Selection is delegated
  // at the container level so click, range, and drag-select stay identical to
  // the richer L3/L4 strips.
  import { labBulk } from './store.svelte';
  import StripCell from './StripCell.svelte';
  import { createStripSelectionController } from './strip-selection';

  const items = $derived(labBulk.stripItems);
  const selection = createStripSelectionController();
</script>

<div
  class="filmstrip"
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
    <StripCell {item} mode="s" />
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
</style>
