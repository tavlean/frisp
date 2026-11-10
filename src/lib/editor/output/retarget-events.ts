// Pointer/wheel event retargeting for the two-up output view, the Svelte 5 way.
//
// The before/after view stacks two <pinch-zoom> elements; only the left one is
// driven and the right mirrors its transform (see Output.svelte's onLeftChange).
// To keep them in sync, all view gestures on the <two-up> container are
// redirected to the left pinch-zoom. Drags over the divider handle pass through
// (so the two-up slider still works); the wheel always retargets so it zooms
// even over the handle.
//
// This is the attachment form (matching file-drop.ts) of the original
// imperative output-retargeting setup — `{@attach retargetViewEvents(() => …)}`.

import type { Attachment } from 'svelte/attachments';
import { isSafari } from '#client/lazy-app/util/index.ts';
import type PinchZoom from './pinch-zoom';

/**
 * @param getTarget Getter for the pinch-zoom that should receive the events.
 *   Passed as a getter (not the value) so the attachment re-runs once the left
 *   pinch-zoom is bound.
 */
export function retargetViewEvents(
  getTarget: () => PinchZoom | undefined,
): Attachment<HTMLElement> {
  return (node) => {
    const pz = getTarget();
    if (!pz) return;
    const retargeted = new WeakSet<Event>();
    const handler = (event: Event) => {
      if (retargeted.has(event)) return;
      const target = event.target as HTMLElement | null;
      const isHandle = !!target?.closest?.('.two-up-handle');
      if (!(event.type === 'wheel' || !isHandle)) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const Ctor = event.constructor as typeof Event;
      const cloned = new Ctor(event.type, event as EventInit);
      retargeted.add(cloned);
      pz.dispatchEvent(cloned);
      // On touchend, unfocus any active element so Android Chrome doesn't
      // re-show the software keyboard after interacting with the output.
      // Ported from the original shouldBlurActiveElementAfterOutputRetarget.
      if (
        event.type === 'touchend' &&
        document.activeElement instanceof HTMLElement
      ) {
        document.activeElement.blur();
      }
    };
    const types = ['touchstart', 'touchend', 'touchmove', 'mousedown', 'wheel'];
    if (!isSafari) types.push('pointerdown');
    for (const type of types) {
      node.addEventListener(type, handler, { capture: true, passive: false });
    }
    return () => {
      for (const type of types) {
        node.removeEventListener(type, handler, { capture: true });
      }
    };
  };
}
