<script lang="ts">
  import type { EditorSession } from '#lib/editor/editor-session.svelte.ts';
  import FocusView from './FocusView.svelte';
  import RichStrip from './RichStrip.svelte';
  import { bulkStore, type StripSize } from './store.svelte';

  interface Props {
    focusSession: EditorSession;
    onReseed: () => void;
  }

  let { focusSession, onReseed }: Props = $props();

  const STRIP_HEIGHT: Record<StripSize, number> = {
    s: 104,
    m: 148,
    l: 210,
  };
  const stripHeight = $derived(STRIP_HEIGHT[bulkStore.stripSize]);
</script>

<FocusView {focusSession} {onReseed} {stripHeight} strip={richStrip} />

{#snippet richStrip()}
  <RichStrip />
{/snippet}
