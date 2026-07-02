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

  // Vertical order reads "up = bigger": Large on top, Small at the bottom. The
  // same thumbnail-outline glyph is drawn at three box sizes rather than letters,
  // so the control is iconic at strip scale. `glyph` is the outline's [w, h] in
  // the 24×24 button viewBox.
  const SIZES: {
    id: StripSize;
    title: string;
    glyph: { w: number; h: number };
  }[] = [
    { id: 'l', title: 'Large thumbnails', glyph: { w: 16, h: 12 } },
    { id: 'm', title: 'Medium thumbnails', glyph: { w: 12, h: 9 } },
    { id: 's', title: 'Small thumbnails', glyph: { w: 8, h: 6 } },
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
        aria-label={option.title}
        onclick={() => setSize(option.id)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <rect
            x={(24 - option.glyph.w) / 2}
            y={(24 - option.glyph.h) / 2}
            width={option.glyph.w}
            height={option.glyph.h}
            rx="2"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
        </svg>
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

  /* VERTICAL thumbnail-size control pinned to the strip's right edge, vertically
     centered in the strip region. Large on top → Small at the bottom ("up =
     bigger"). Icons over letters: the same rounded-rect thumbnail outline at
     three sizes. Active glyph is azure (the single-image scope hue — the strip
     is about picking one image to inspect); inactive is --text-3; hover lifts. */
  .size-control {
    flex: none;
    align-self: center;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 3px;
    border-radius: 999px;
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  }
  .size-control button {
    display: grid;
    place-items: center;
    /* Equal square hit box so every glyph shares one vertical axis and the
       active pill is concentric with its icon. padding:0 is explicit — the UA
       button padding was pushing the SVG ~2px off the button's own centre. */
    width: 30px;
    height: 30px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease,
      transform 150ms ease;
  }
  .size-control button svg {
    width: 22px;
    height: 22px;
    display: block;
  }
  .size-control button:hover:not(.active) {
    color: var(--text-1, #f5f5f7);
    transform: translateY(-1px);
  }
  .size-control button.active {
    background: var(--accent-2, #53b2ff);
    color: #16161c;
  }
  .size-control button:focus-visible {
    outline: 2px solid var(--accent-2, #53b2ff);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .size-control button:hover:not(.active) {
      transform: none;
    }
  }
</style>
