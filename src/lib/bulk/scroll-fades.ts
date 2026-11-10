import type { Attachment } from 'svelte/attachments';

// Edge fades for the horizontally scrolling strips (FilmStrip, RichStrip): a
// side fades only while there is more content to scroll toward it. Both strips
// share this so the threshold and the measuring triggers live in one place.
//
// The fades are reported through `set` rather than toggled on the node, so the
// strips keep their `class:` directives: a class added only from script would
// leave Svelte's scoped `.fade-left` / `.fade-right` selectors looking unused,
// and they would be pruned.
//
// Triggers: a ResizeObserver for the scroller's own box (window resizes reach
// it through its width), scroll events, and the strip's content. A content
// change alters scrollWidth without resizing the box, which no observer
// reports, so `contentKey` is read here to re-run the attachment, and the
// re-measure waits a microtask for the new cells to lay out.

const EDGE_THRESHOLD = 2;

export type ScrollFades = { left: boolean; right: boolean };

export function scrollFades(
  set: (fades: ScrollFades) => void,
  contentKey: () => unknown,
): Attachment<HTMLElement> {
  return (node) => {
    contentKey();

    const update = (): void => {
      const max = Math.max(0, node.scrollWidth - node.clientWidth);
      set({
        left: max > EDGE_THRESHOLD && node.scrollLeft > EDGE_THRESHOLD,
        right: max > EDGE_THRESHOLD && node.scrollLeft < max - EDGE_THRESHOLD,
      });
    };

    const observer = new ResizeObserver(update);
    observer.observe(node);
    node.addEventListener('scroll', update);
    update();
    queueMicrotask(update);
    return () => {
      observer.disconnect();
      node.removeEventListener('scroll', update);
    };
  };
}
