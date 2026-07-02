<script lang="ts">
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import { labBulk } from './store.svelte';

  interface Props {
    focusSession: EditorSession;
  }

  let { focusSession }: Props = $props();

  const formats = $derived(
    focusSession.availableFormats.filter(
      (format) => (format.id as string) !== 'identity',
    ),
  );

  const firstJobId = $derived(labBulk.session.jobs[0]?.id);
  const firstThumb = $derived(
    firstJobId ? labBulk.thumbs.get(firstJobId) : undefined,
  );
  const naturalWidth = $derived(firstThumb?.w ?? 0);
  const naturalHeight = $derived(firstThumb?.h ?? 0);

  const totalJobs = $derived(labBulk.summary.totalJobs);

  function applyFormat(format: string): void {
    if (format === 'identity') return;
    labBulk.setGlobalFormat(format as typeof labBulk.globalSide.format);
  }
</script>

<!-- The global scope has no single-image download, so the production Results
     footer ("… WEBP · Save") is inert here. We hide it (scoped to THIS wrapper
     only) and render a quiet scope caption in its place; the batch result total
     lives once, in the LEFT panel footer. -->
<div class="global-panel">
  <OptionsPanel
    side="left"
    format={labBulk.globalSide.format}
    {formats}
    options={labBulk.globalSide.optionsByFormat[labBulk.globalSide.format] ??
      {}}
    processorState={labBulk.globalSide.processorState}
    {naturalWidth}
    {naturalHeight}
    sourceName={labBulk.selectedFile?.name}
    isVector={labBulk.selectedFile?.type === 'image/svg+xml'}
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
  <div class="lab-footer">
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

  .lab-footer {
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
