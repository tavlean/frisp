<script lang="ts">
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import { bulkStore } from './store.svelte';

  interface Props {
    focusSession: EditorSession;
  }

  let { focusSession }: Props = $props();

  const formats = $derived(
    focusSession.availableFormats.filter(
      (format) => (format.id as string) !== 'identity',
    ),
  );

  const firstJobId = $derived(bulkStore.session.jobs[0]?.id);
  const firstThumb = $derived(
    firstJobId ? bulkStore.thumbs.get(firstJobId) : undefined,
  );
  const naturalWidth = $derived(firstThumb?.w ?? 0);
  const naturalHeight = $derived(firstThumb?.h ?? 0);

  const totalJobs = $derived(bulkStore.summary.totalJobs);

  $effect(() => {
    const width = naturalWidth;
    const height = naturalHeight;
    const resize = bulkStore.globalSide.processorState.resize;
    resize.enabled;
    resize.width;
    resize.height;
    bulkStore.seedGlobalResizeDimensions(width, height);
  });

  function applyFormat(format: string): void {
    if (format === 'identity') return;
    bulkStore.setGlobalFormat(format as typeof bulkStore.globalSide.format);
  }
</script>

<!-- The global scope has no single-image download, so the production Results
     footer ("… WEBP · Save") is inert here. We hide it (scoped to THIS wrapper
     only) and render a quiet scope caption in its place; the batch result total
     lives once, in the LEFT panel footer. -->
<div class="global-panel">
  <OptionsPanel
    side="left"
    format={bulkStore.globalSide.format}
    {formats}
    options={bulkStore.globalSide.optionsByFormat[
      bulkStore.globalSide.format
    ] ?? {}}
    processorState={bulkStore.globalSide.processorState}
    {naturalWidth}
    {naturalHeight}
    isVector={bulkStore.selectedFile?.type === 'image/svg+xml'}
    result={null}
    working={false}
    canImport={false}
    downloadName=""
    onFormatChange={applyFormat}
    onCopy={() => {}}
    onSave={() => {}}
    onImport={() => {}}
  />

  <!-- The batch result total lives once, in the LEFT panel footer. Here we just
       remind the user what these controls touch. -->
  <div class="scope-footer">
    <span class="scope-caption">
      Applies to all {totalJobs}
      {totalJobs === 1 ? 'image' : 'images'}
    </span>
  </div>
</div>

<style>
  .global-panel {
    display: contents;
  }

  /* Suppress the inert per-image download footer for the global scope only. */
  .global-panel :global(.results) {
    display: none;
  }

  .scope-footer {
    display: flex;
    align-items: baseline;
    padding: 11px 16px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    background: rgba(0, 0, 0, 0.18);
  }

  .scope-caption {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.85rem;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
  }
</style>
