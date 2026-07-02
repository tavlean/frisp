<script lang="ts">
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import FocusView from './FocusView.svelte';
  import GridView from './GridView.svelte';
  import RichStrip from './RichStrip.svelte';
  import { labBulk, type FocusStripSize } from './store.svelte';

  interface Props {
    focusSession: EditorSession;
    onReseed: () => void;
  }

  let { focusSession, onReseed }: Props = $props();

  const STRIP_HEIGHT: Record<FocusStripSize, number> = {
    s: 104,
    m: 148,
    l: 210,
  };
  const stripHeight = $derived(STRIP_HEIGHT[labBulk.focusStripSize]);
</script>

{#if labBulk.stripSize === 'grid'}
  <GridView {focusSession} {onReseed} />
{:else}
  <FocusView {focusSession} {onReseed} {stripHeight} strip={richStrip} />
{/if}

{#snippet richStrip()}
  <RichStrip />
{/snippet}
