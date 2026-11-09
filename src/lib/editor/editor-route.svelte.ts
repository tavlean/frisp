// The editor's one shallow-route history entry (`page.state.editor`).
//
// SvelteKit 3's `pushState` resolves the route before it writes `page.state`,
// so `page.state.editor` turns true a few microtasks after the push. The
// route-sync effects in +page.svelte read "image open but no editor state" as
// the user pressing Back and close the image (or tear down the batch), which in
// that gap would close every image the instant it opened. SvelteKit 2's
// `pushState` was synchronous, so the gap is new. Those effects ask
// `isEditorOpen()`, which counts a push in flight as already open.

import { pushState } from '$app/navigation';
import { page } from '$app/state';

let pushPending = $state(false);

export function isEditorOpen(): boolean {
  return pushPending || !!page.state.editor;
}

/** Push the editor entry unless it is already there or on its way. */
export function pushEditorRoute(): void {
  if (isEditorOpen()) return;
  pushPending = true;
  void pushState('', { editor: true }).finally(() => {
    pushPending = false;
  });
}
