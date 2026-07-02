// Drag-and-drop file handling, the Svelte 5 way.
//
// The original Squoosh wraps its whole app in a <file-drop> custom element
// (the `file-drop-element` npm package) so that dropping an image anywhere —
// including over the open editor — replaces the current file instead of letting
// the browser navigate to it. This is the idiomatic Svelte equivalent: an
// attachment (the modern replacement for actions) that you spread onto any
// element with `{@attach fileDrop(onFiles)}`.
//
// It intercepts the drag/drop events (calling preventDefault so the browser
// does not open the file), tracks enter/leave with a depth counter so nested
// children don't flicker the state, and toggles a `drop-valid` class on the
// element for purely-CSS visual feedback — matching Squoosh's `.drop-valid`
// overlay.

import type { Attachment } from 'svelte/attachments';
import { fromDataTransfer, type ImportedFile } from '$lib/bulk/import-sources';

/** True when the drag actually carries files (not text, links, etc.). */
function dragHasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.prototype.includes.call(types, 'Files');
}

/**
 * @param onFiles Called with dropped files plus optional folder-relative paths.
 */
export function fileDrop(
  onFiles: (files: ImportedFile[]) => void,
): Attachment<HTMLElement> {
  return (node) => {
    let depth = 0;

    const setActive = (active: boolean) => {
      node.classList.toggle('drop-valid', active);
    };

    const onDragEnter = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setActive(true);
    };

    const onDragOver = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      // preventDefault on every dragover is what allows the drop to fire.
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    };

    const onDragLeave = (event: DragEvent) => {
      if (!dragHasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setActive(false);
    };

    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      depth = 0;
      setActive(false);
      if (!event.dataTransfer) return;

      void fromDataTransfer(event.dataTransfer).then((files) => {
        if (files.length) onFiles(files);
      });
    };

    node.addEventListener('dragenter', onDragEnter);
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);

    return () => {
      node.removeEventListener('dragenter', onDragEnter);
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
  };
}
