<script lang="ts">
  // Horizontal strip of job thumbnails. Selection is delegated at the container
  // level so click, range, and drag-select stay identical to the richer strip.
  import { bulkStore } from './store.svelte';
  import StripCell from './StripCell.svelte';
  import { createStripSelectionController } from './strip-selection';
  import { scrollFades } from './scroll-fades';

  const items = $derived(bulkStore.stripItems);
  const selection = createStripSelectionController();
  const thumbCount = $derived(bulkStore.thumbs.size);

  let fadeLeft = $state(false);
  let fadeRight = $state(false);
  const fades = scrollFades(
    ({ left, right }) => {
      fadeLeft = left;
      fadeRight = right;
    },
    () => [items.length, thumbCount],
  );
</script>

<div
  {@attach fades}
  class="filmstrip"
  class:fade-left={fadeLeft}
  class:fade-right={fadeRight}
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
    --strip-fade-size: 32px;
    display: flex;
    align-items: center;
    /* Safe centering: the row is centered while the thumbs fit, but the moment
       they overflow it left-aligns for scrolling with no clipped first item.
       `safe center` is the modern one-liner; the `auto` margins on the content
       wrapper below are the fallback for engines without `safe`. */
    justify-content: safe center;
    gap: 8px;
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    overflow-x: auto;
    padding: 6px 12px;
    scrollbar-width: none;
    scroll-snap-type: x proximity;
    user-select: none;
    -webkit-user-select: none;
  }
  .filmstrip.fade-left {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      #000 var(--strip-fade-size),
      #000 100%
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 var(--strip-fade-size),
      #000 100%
    );
  }
  .filmstrip.fade-right {
    -webkit-mask-image: linear-gradient(
      to right,
      #000 0,
      #000 calc(100% - var(--strip-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      #000 0,
      #000 calc(100% - var(--strip-fade-size)),
      transparent
    );
  }
  .filmstrip.fade-left.fade-right {
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      #000 var(--strip-fade-size),
      #000 calc(100% - var(--strip-fade-size)),
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      #000 var(--strip-fade-size),
      #000 calc(100% - var(--strip-fade-size)),
      transparent
    );
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
