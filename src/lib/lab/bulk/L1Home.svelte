<script lang="ts">
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import FocusView from './FocusView.svelte';

  interface Props {
    focusSession: EditorSession;
    onReseed: () => void;
  }

  let { focusSession, onReseed }: Props = $props();
</script>

<FocusView {focusSession} {onReseed} />
