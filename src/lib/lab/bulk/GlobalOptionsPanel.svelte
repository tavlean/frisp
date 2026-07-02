<script lang="ts">
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import { labBulk, type LabThumb } from './store.svelte';

  interface Props {
    focusSession: EditorSession;
    thumb?: LabThumb;
  }

  let { focusSession, thumb }: Props = $props();

  const formats = $derived(
    focusSession.availableFormats.filter(
      (format) => (format.id as string) !== 'identity',
    ),
  );

  function applyFormat(format: string): void {
    if (format === 'identity') return;
    labBulk.setGlobalFormat(format as typeof labBulk.globalSide.format);
  }
</script>

<OptionsPanel
  side="left"
  format={labBulk.globalSide.format}
  {formats}
  options={labBulk.globalSide.optionsByFormat[labBulk.globalSide.format] ?? {}}
  processorState={labBulk.globalSide.processorState}
  naturalWidth={thumb?.w ?? focusSession.naturalWidth}
  naturalHeight={thumb?.h ?? focusSession.naturalHeight}
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
