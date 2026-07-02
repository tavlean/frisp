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

  const summary = $derived(labBulk.summary);
  const output = $derived(summary.output);
  const firstJobId = $derived(labBulk.session.jobs[0]?.id);
  const firstThumb = $derived(
    firstJobId ? labBulk.thumbs.get(firstJobId) : undefined,
  );
  const naturalWidth = $derived(firstThumb?.w ?? 0);
  const naturalHeight = $derived(firstThumb?.h ?? 0);

  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  const delta = $derived.by(() => {
    if (output.optimized === 0) return null;
    const rounded = Math.round(output.percentChange);
    if (rounded < 0) return { text: `▼${Math.abs(rounded)}%`, up: false };
    if (rounded > 0) return { text: `▲${rounded}%`, up: true };
    return { text: '0%', up: false };
  });

  function applyFormat(format: string): void {
    if (format === 'identity') return;
    labBulk.setGlobalFormat(format as typeof labBulk.globalSide.format);
  }
</script>

<!-- The global scope has no single-image download, so the production Results
     footer ("… WEBP · Save") is inert here. We hide it (scoped to THIS wrapper
     only) and render a compact batch-totals footer in its place. -->
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

  <div class="lab-footer">
    <span class="totals">
      {prettySize(output.totalOriginalSize)}
      <span class="arrow" aria-hidden="true">→</span>
      {#if output.optimized > 0}
        {prettySize(output.totalOutputSize)}
      {:else}
        …
      {/if}
    </span>
    {#if delta}
      <span class="pill" class:up={delta.up} class:down={!delta.up}>
        {delta.text}
      </span>
    {/if}
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
    gap: 8px;
    padding: 10px 16px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    background: rgba(0, 0, 0, 0.18);
    font-variant-numeric: tabular-nums;
  }

  .totals {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-weight: 650;
  }

  .arrow {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    margin: 0 2px;
  }

  .pill {
    margin-left: auto;
    padding: 1px 8px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.85rem;
    white-space: nowrap;
  }
  .pill.down {
    background: rgba(61, 220, 151, 0.14);
    color: var(--good, #3ddc97);
  }
  .pill.up {
    background: rgba(255, 176, 32, 0.14);
    color: var(--warn, #ffb020);
  }
</style>
