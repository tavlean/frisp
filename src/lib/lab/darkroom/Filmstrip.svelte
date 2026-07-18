<script lang="ts">
  // The bottom strip: the lab's SESSION GALLERY (a real stepping-stone toward
  // bulk mode). The page owns the gallery array and object-URL lifecycle; this
  // component renders the count chip, a scrollable thumbnail row (active thumb
  // ringed, close on hover removes) and a trailing "+" add chip. Its right end
  // reserves --dr-dock-w for the zoom/rotate controls docked over it (Output's
  // .controls, positioned in darkroom.css).
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

<div class="dr-filmstrip">
  <span class="dr-count">{countLabel}</span>

  <div class="dr-thumbs">
    {#each entries as entry (entry.id)}
      <div class="dr-thumb-wrap" class:active={entry.active}>
        <button
          type="button"
          class="dr-thumb"
          aria-label={`Open ${entry.name}`}
          aria-current={entry.active}
          onclick={() => onPick(entry.id)}
        >
          <img src={entry.url} alt="" draggable="false" />
        </button>
        <button
          type="button"
          class="dr-thumb-remove"
          data-tooltip="Remove"
          aria-label={`Remove ${entry.name}`}
          onclick={() => onRemove(entry.id)}
        >
          <LabIcon svg={closeIcon} size={12} />
        </button>
      </div>
    {/each}

    <button
      type="button"
      class="dr-thumb-add"
      data-tooltip="Add images"
      aria-label="Add images"
      onclick={() => onAdd()}
    >
      <LabIcon svg={plusIcon} size={18} />
    </button>
  </div>
</div>

<style>
  .dr-filmstrip {
    position: fixed;
    left: 12px;
    right: 12px;
    bottom: 12px;
    z-index: 21;
    display: flex;
    align-items: center;
    gap: 12px;
    height: 64px;
    /* Right reserve = room for the zoom/rotate controls docked over the bar's
       right end (Output's .controls, positioned in darkroom.css). */
    padding: 0 var(--dr-dock-w) 0 12px;
    box-sizing: border-box;
    border-radius: 12px;
    border: 1px solid var(--dr-border);
    background: var(--dr-panel);
    box-shadow: var(--dr-shadow-panel);
  }

  .dr-count {
    flex: none;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--dr-chip);
    border: 1px solid var(--dr-border);
    color: var(--dr-text-2);
    font-size: 0.85rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .dr-thumbs {
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

  .dr-thumb-wrap {
    position: relative;
    flex: none;
    height: 48px;
    border-radius: 8px;
  }

  .dr-thumb {
    display: block;
    height: 48px;
    padding: 0;
    border: none;
    border-radius: 8px;
    overflow: hidden;
    background: var(--dr-inset);
    cursor: pointer;
    box-shadow: 0 0 0 0 var(--dr-ring);
    transition: box-shadow 150ms ease;
  }
  .dr-thumb img {
    display: block;
    height: 48px;
    width: auto;
    max-width: 84px;
    min-width: 40px;
    object-fit: cover;
  }
  .dr-thumb-wrap.active .dr-thumb {
    box-shadow: 0 0 0 2px var(--dr-ring);
  }
  .dr-thumb:focus-visible {
    outline: 2px solid var(--dr-focus);
    outline-offset: 2px;
  }

  .dr-thumb-remove {
    position: absolute;
    top: -6px;
    right: -6px;
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
    border-radius: 999px;
    border: 1px solid var(--dr-border);
    background: var(--dr-panel);
    color: var(--dr-text-2);
    cursor: pointer;
    opacity: 0;
    transition:
      opacity 150ms ease,
      color 150ms ease;
  }
  .dr-thumb-wrap:hover .dr-thumb-remove,
  .dr-thumb-remove:focus-visible {
    opacity: 1;
  }
  .dr-thumb-remove:hover {
    color: var(--dr-text-1);
  }
  .dr-thumb-add {
    flex: none;
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border-radius: 8px;
    border: 1px dashed var(--dr-border-strong);
    background: none;
    color: var(--dr-text-2);
    cursor: pointer;
    transition:
      color 150ms ease,
      border-color 150ms ease,
      background-color 150ms ease;
  }
  .dr-thumb-add:hover {
    color: var(--dr-text-1);
    border-color: var(--dr-text-3);
    background: var(--dr-chip);
  }

  @media (max-width: 900px) {
    .dr-count {
      display: none;
    }
  }
</style>
