// Shared drop/pick state for the intro-lab variants.
//
// Honest on the outside: drops and picker selections run through the REAL
// production import path (`fromDataTransfer` walks folders recursively, skips
// dot-files, keeps relative paths), so dragging a nested folder of photos
// behaves exactly like production. Only the last step is stubbed — instead of
// opening the editor, the variant shows what WOULD open (count, names, total
// size). Each variant page owns one instance.
//
// Usage:
//   const demo = new IntroDropDemo();
//   <main {@attach demo.dropTarget()}>          — whole-page drop target
//   <input type="file" multiple onchange={demo.onPick} />
//   demo.dragActive   — true while a files-drag hovers the target
//   demo.files        — accepted files (empty until a drop/pick lands)
//   demo.summary      — "3 images · 12.4 MB" for the stub confirmation
//   demo.reset()      — back to the empty landing state

import type { Attachment } from 'svelte/attachments';
import {
  fromDataTransfer,
  fromFileList,
  type ImportedFile,
} from '$lib/bulk/import-sources';
import { prettySize } from '$lib/editor/pretty-size';

/** True when the drag actually carries files (not text, links, etc.). */
function dragHasFiles(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return !!types && Array.prototype.includes.call(types, 'Files');
}

export class IntroDropDemo {
  // Raw: File objects are host objects; the array is reassigned, never mutated.
  files = $state.raw<ImportedFile[]>([]);
  // Enter/leave depth counter, so nested children never flicker the state.
  #dragDepth = $state(0);

  readonly dragActive = $derived(this.#dragDepth > 0);
  readonly hasFiles = $derived(this.files.length > 0);
  readonly summary = $derived.by(() => {
    if (this.files.length === 0) return '';
    const total = this.files.reduce((sum, item) => sum + item.file.size, 0);
    const noun = this.files.length === 1 ? 'image' : 'images';
    return `${this.files.length} ${noun} · ${prettySize(total)}`;
  });

  accept(files: ImportedFile[]): void {
    if (files.length === 0) return;
    this.files = files;
  }

  reset(): void {
    this.files = [];
    this.#dragDepth = 0;
  }

  /** Handler for a hidden `<input type="file" multiple>` change event. */
  onPick = (event: Event): void => {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files) this.accept(fromFileList(input.files));
    input.value = '';
  };

  /**
   * Attachment for the drop target (usually the whole page root). Mirrors the
   * production fileDrop attachment, but exposes reactive `dragActive` instead
   * of toggling a class, so variants can animate anything they like.
   */
  dropTarget(): Attachment<HTMLElement> {
    return (node) => {
      const onDragEnter = (event: DragEvent) => {
        if (!dragHasFiles(event)) return;
        event.preventDefault();
        this.#dragDepth += 1;
      };
      const onDragOver = (event: DragEvent) => {
        if (!dragHasFiles(event)) return;
        // preventDefault on every dragover is what allows the drop to fire.
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
      };
      const onDragLeave = (event: DragEvent) => {
        if (!dragHasFiles(event)) return;
        this.#dragDepth = Math.max(0, this.#dragDepth - 1);
      };
      const onDrop = (event: DragEvent) => {
        event.preventDefault();
        this.#dragDepth = 0;
        if (!event.dataTransfer) return;
        void fromDataTransfer(event.dataTransfer).then((files) =>
          this.accept(files),
        );
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
}
