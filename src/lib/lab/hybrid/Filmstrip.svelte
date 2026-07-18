<script lang="ts">
  // The SINGLE bottom bar (maintainer directive: one bar, no stray floating
  // clusters). A raised white porcelain squircle spanning the bottom, holding —
  // left → right — a count chip, a scrollable thumbnail row (the lab's real
  // SESSION GALLERY: active thumb ringed, ✕ on hover removes, trailing "+" add
  // chip, "batch coming" hint while a single image is loaded), and a reserved
  // right-end well into which the canvas zoom cluster (Output's `.controls`) is
  // docked by hybrid.css. The page owns the gallery array + object-URL lifecycle;
  // this component only renders it. The trailing padding (--hy-dock-reserve) keeps
  // long thumbnail rows scrolling UNDER the docked cluster instead of colliding.
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import closeIcon from '$lib/lab/icons/close.svg?raw';
  import plusIcon from '$lib/lab/icons/plus.svg?raw';

  interface Entry {
    id: string;
    name: string;
    url: string;
    active: boolean;
  }

  interface Props {
    entries: Entry[];
    onPick: (id: string) => void;
    onRemove: (id: string) => void;
    onAdd: () => void;
  }

  let { entries, onPick, onRemove, onAdd }: Props = $props();

  const countLabel = $derived(
    `${entries.length} ${entries.length === 1 ? 'image' : 'images'}`,
  );
</script>

<div class="hy-bottombar">
  <span class="hy-count">{countLabel}</span>

  <div class="hy-thumbs">
    {#each entries as entry (entry.id)}
      <div class="hy-thumb-wrap" class:active={entry.active}>
        <button
          type="button"
          class="hy-thumb"
          aria-label={`Open ${entry.name}`}
          aria-current={entry.active}
          onclick={() => onPick(entry.id)}
        >
          <img src={entry.url} alt="" draggable="false" />
        </button>
        <button
          type="button"
          class="hy-thumb-remove"
          aria-label={`Remove ${entry.name}`}
          onclick={() => onRemove(entry.id)}
        >
          <LabIcon svg={closeIcon} size={12} />
        </button>
      </div>
    {/each}

    <button
      type="button"
      class="hy-thumb-add"
      aria-label="Add images"
      onclick={() => onAdd()}
    >
      <LabIcon svg={plusIcon} size={18} />
    </button>

    {#if entries.length === 1}
      <span class="hy-hint">Drop more images — batch editing is coming.</span>
    {/if}
  </div>
</div>

<style>
  .hy-bottombar {
    position: fixed;
    left: var(--hy-margin);
    right: var(--hy-margin);
    bottom: var(--hy-margin);
    z-index: 21;
    display: flex;
    align-items: center;
    gap: 12px;
    height: var(--hy-bar-h);
    /* Reserve the right end for the docked zoom cluster (positioned by
       hybrid.css). Long thumbnail rows scroll under it, not into it. */
    padding: 0 var(--hy-dock-reserve) 0 12px;
    box-sizing: border-box;
    border-radius: 16px;
    border: 1px solid var(--pc-border);
    background: var(--pc-panel);
    box-shadow: var(--pc-shadow-panel);
  }
  @supports (corner-shape: squircle) {
    .hy-bottombar {
      corner-shape: squircle;
      border-radius: 20px;
    }
  }

  .hy-count {
    flex: none;
    padding: 4px 11px;
    border-radius: 999px;
    background: var(--pc-inset);
    border: 1px solid var(--pc-border);
    color: var(--pc-text-2);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .hy-thumbs {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 8px;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 8px 2px;
    scrollbar-width: thin;
  }

  .hy-thumb-wrap {
    position: relative;
    flex: none;
    height: 48px;
    border-radius: 10px;
  }

  .hy-thumb {
    display: block;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: 10px;
    overflow: hidden;
    background: var(--pc-inset);
    cursor: pointer;
    box-shadow: 0 0 0 0 var(--pc-text-1);
    transition: box-shadow 150ms ease;
  }
  @supports (corner-shape: squircle) {
    .hy-thumb,
    .hy-thumb-wrap {
      corner-shape: squircle;
      border-radius: 12px;
    }
  }
  .hy-thumb img {
    display: block;
    height: 48px;
    width: auto;
    max-width: 84px;
    min-width: 40px;
    object-fit: cover;
  }
  .hy-thumb-wrap.active .hy-thumb {
    box-shadow: 0 0 0 2px var(--pc-text-1);
  }
  .hy-thumb:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .hy-thumb-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 1px solid var(--pc-border);
    background: var(--pc-surface);
    color: var(--pc-text-2);
    cursor: pointer;
    opacity: 0;
    box-shadow: var(--pc-shadow-control);
    transition:
      opacity 150ms ease,
      color 150ms ease;
  }
  .hy-thumb-wrap:hover .hy-thumb-remove,
  .hy-thumb-remove:focus-visible {
    opacity: 1;
  }
  .hy-thumb-remove:hover {
    color: var(--pc-text-1);
  }
  .hy-thumb-add {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 10px;
    border: 1px dashed var(--pc-border-strong);
    background: none;
    color: var(--pc-text-2);
    cursor: pointer;
    transition:
      color 150ms ease,
      border-color 150ms ease,
      background-color 150ms ease;
  }
  @supports (corner-shape: squircle) {
    .hy-thumb-add {
      corner-shape: squircle;
      border-radius: 12px;
    }
  }
  .hy-thumb-add:hover {
    color: var(--pc-text-1);
    border-color: var(--pc-text-3);
    background: var(--pc-inset);
  }
  .hy-thumb-add:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .hy-hint {
    flex: none;
    align-self: center;
    color: var(--pc-text-3);
    font-size: 13px;
    white-space: nowrap;
  }

  @media (max-width: 900px) {
    .hy-count,
    .hy-hint {
      display: none;
    }
  }
</style>
