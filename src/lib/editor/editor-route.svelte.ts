// The editor's one shallow-route history entry (`page.state.editor`).
//
// The entry is pushed with a shallow `goto` (SvelteKit 3 deprecated
// `pushState`). It resolves the route and runs the navigation callbacks before
// it writes `page.state`, so `page.state.editor` turns true a few microtasks
// after the call. The route-sync effects in +page.svelte read "image open but
// no editor state" as the user pressing Back and close the image (or tear down
// the batch), which in that gap would close every image the instant it opened.
// SvelteKit 2's `pushState` was synchronous, so the gap is new. Those effects
// ask `isEditorOpen()`, which counts a push in flight as already open.

import { goto } from '$app/navigation';
import { page } from '$app/state';

let pushPending = $state(false);

export function isEditorOpen(): boolean {
  return pushPending || !!page.state.editor;
}

/** Push the editor entry unless it is already there or on its way. */
export function pushEditorRoute(): void {
  if (isEditorOpen()) return;
  pushPending = true;
  void goto('', { state: { editor: true }, shallow: true }).finally(() => {
    pushPending = false;
  });
}
