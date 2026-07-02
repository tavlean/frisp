<script lang="ts">
  // L3 "flush left": behaves like L1 (focus-first, no grid) but with no left
  // panel — the image and strip run to the left edge and the batch/info surface
  // stacks under the right options panel. Just FocusView in its l3 layout.
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import FocusView from './FocusView.svelte';

  interface Props {
    focusSession: EditorSession;
    onReseed: () => void;
  }

  let { focusSession, onReseed }: Props = $props();
</script>

<FocusView {focusSession} {onReseed} layout="l3" />
