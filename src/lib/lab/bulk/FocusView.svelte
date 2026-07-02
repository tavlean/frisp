<script lang="ts">
  // The SHARED focus layout (matches bulk-focus-mode.webp). Both lab variants
  // render this; they differ only in what they inject into the `left` snippet
  // (L1 = global/batch section, L2 = same, reached from the grid) and whether
  // they pass `onBack` (L2 shows a "← All images" affordance; L1 passes null).
  //
  //  - LEFT column: the variant's `left` snippet, then InfoPanel for the
  //    selected image (always).
  //  - CENTER: SplitCompare (before/after).
  //  - RIGHT: header (filename + "This image only") + PanelControls scope=image.
  //  - BOTTOM: FilmStrip.
  //
  // ←/→ switch the selected job (engine selectPrevious/selectNext helpers),
  // ignoring typeable targets so it never steals arrow keys from an input.
  import type { Snippet } from 'svelte';
  import { labBulk } from './store.svelte';
  import InfoPanel from './InfoPanel.svelte';
  import SplitCompare from './SplitCompare.svelte';
  import PanelControls from './PanelControls.svelte';
  import FilmStrip from './FilmStrip.svelte';

  interface Props {
    /** Variant-injected left content (batch card / global section). */
    left: Snippet;
    /** When provided, render a "← All images" back affordance (L2). */
    onBack?: (() => void) | null;
  }

  let { left, onBack = null }: Props = $props();

  const file = $derived(labBulk.selectedFile);
  const thumb = $derived(labBulk.selectedThumb);

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      const typeable =
        tag === 'TEXTAREA' ||
        target.isContentEditable ||
        (tag === 'INPUT' &&
          !['range', 'checkbox', 'radio', 'button'].includes(
            (target as HTMLInputElement).type,
          ));
      // The SplitCompare divider is a role="slider" button that owns ←/→ for
      // nudging; don't hijack those while it's focused.
      if (typeable || target.getAttribute('role') === 'slider') return;
    }
    if (event.key === 'ArrowLeft') labBulk.selectPrevious();
    else labBulk.selectNext();
    event.preventDefault();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="focus">
  <aside class="left">
    {@render left()}
    <InfoPanel {file} width={thumb?.w ?? 0} height={thumb?.h ?? 0} />
  </aside>

  <main class="center">
    {#if onBack}
      <button type="button" class="back" onclick={onBack}>
        <span aria-hidden="true">←</span> All images
      </button>
    {/if}
    <div class="stage-wrap">
      <SplitCompare />
    </div>
  </main>

  <aside class="right">
    <header class="panel-head">
      <h2 title={file?.name}>{file?.name ?? 'No image'}</h2>
      <p class="subtitle">This image only</p>
    </header>
    <PanelControls scope="image" />
  </aside>

  <footer class="strip">
    <FilmStrip />
  </footer>
</div>

<style>
  .focus {
    display: grid;
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr) minmax(
        260px,
        320px
      );
    grid-template-rows: minmax(0, 1fr) auto;
    grid-template-areas:
      'left center right'
      'strip strip strip';
    gap: 16px;
    height: 100%;
    min-height: 0;
  }

  .left {
    grid-area: left;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    overflow-y: auto;
  }

  .center {
    grid-area: center;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
  }

  .stage-wrap {
    flex: 1;
    min-height: 0;
  }

  .back {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 13px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    color: var(--text-1, #f5f5f7);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background-color 150ms ease;
  }

  .back:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    background: var(--surface-raise-2, rgba(255, 255, 255, 0.09));
  }

  .right {
    grid-area: right;
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 16px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--options-radius, 16px);
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
    min-height: 0;
    overflow-y: auto;
  }

  .panel-head h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .subtitle {
    margin: 3px 0 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.9rem;
    letter-spacing: 0.03em;
  }

  .strip {
    grid-area: strip;
  }

  @media (max-width: 900px) {
    .focus {
      grid-template-columns: 1fr;
      grid-template-rows: auto minmax(0, 1fr) auto auto;
      grid-template-areas:
        'left'
        'center'
        'right'
        'strip';
    }

    .left,
    .right {
      overflow-y: visible;
    }
  }
</style>
