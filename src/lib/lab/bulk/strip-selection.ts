import { labBulk } from './store.svelte';

const CELL_SELECTOR = '[data-bulk-cell-id]';
const DRAG_THRESHOLD = 4;

interface DragState {
  pointerId: number;
  startId: string;
  lastId: string;
  x: number;
  y: number;
  dragging: boolean;
}

interface ClickModifiers {
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
}

function cellIdFromTarget(target: EventTarget | null): string | undefined {
  if (!(target instanceof Element)) return undefined;
  return (
    target.closest(CELL_SELECTOR)?.getAttribute('data-bulk-cell-id') ??
    undefined
  );
}

function cellIdAtPoint(x: number, y: number): string | undefined {
  return cellIdFromTarget(document.elementFromPoint(x, y));
}

export function createStripSelectionController(): {
  onClick: (event: MouseEvent) => void;
  onKeydown: (event: KeyboardEvent) => void;
  onPointerdown: (event: PointerEvent) => void;
  onPointermove: (event: PointerEvent) => void;
  onPointerup: (event: PointerEvent) => void;
  onPointercancel: (event: PointerEvent) => void;
} {
  let drag: DragState | null = null;
  let suppressClick = false;
  let pendingClickId: string | undefined;
  let pendingClickModifiers: ClickModifiers | undefined;

  function finishPointer(event: PointerEvent): void {
    if (!drag || event.pointerId !== drag.pointerId) return;
    const wasDragging = drag.dragging;
    const target = event.currentTarget as HTMLElement | null;
    if (target?.hasPointerCapture(event.pointerId)) {
      target.releasePointerCapture(event.pointerId);
    }
    drag = null;
    if (wasDragging) {
      suppressClick = true;
      setTimeout(() => {
        suppressClick = false;
      }, 0);
    }
    event.stopPropagation();
  }

  return {
    onClick(event: MouseEvent): void {
      const id = cellIdFromTarget(event.target) ?? pendingClickId;
      const modifiers = pendingClickModifiers;
      pendingClickId = undefined;
      pendingClickModifiers = undefined;
      if (!id) return;

      event.preventDefault();
      event.stopPropagation();

      if (suppressClick) {
        suppressClick = false;
        return;
      }

      const shiftKey = event.shiftKey || modifiers?.shiftKey;
      const metaKey = event.metaKey || modifiers?.metaKey;
      const ctrlKey = event.ctrlKey || modifiers?.ctrlKey;

      if (shiftKey) labBulk.selectRangeTo(id);
      else if (metaKey || ctrlKey) labBulk.toggleSelection(id);
      else labBulk.select(id);
    },

    onKeydown(event: KeyboardEvent): void {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      const id = cellIdFromTarget(event.target);
      if (!id) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) labBulk.selectRangeTo(id);
      else if (event.metaKey || event.ctrlKey) labBulk.toggleSelection(id);
      else labBulk.select(id);
    },

    onPointerdown(event: PointerEvent): void {
      if (!event.isPrimary || event.button !== 0) return;
      const id = cellIdFromTarget(event.target);
      if (!id) return;

      drag = {
        pointerId: event.pointerId,
        startId: id,
        lastId: id,
        x: event.clientX,
        y: event.clientY,
        dragging: false,
      };
      pendingClickId = id;
      pendingClickModifiers = {
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
      };
      (event.currentTarget as HTMLElement | null)?.setPointerCapture(
        event.pointerId,
      );
      event.stopPropagation();
    },

    onPointermove(event: PointerEvent): void {
      if (!drag || event.pointerId !== drag.pointerId) return;

      if (!drag.dragging) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        drag.dragging = true;
        labBulk.selectDragRange(drag.startId, drag.startId);
      }

      const id = cellIdAtPoint(event.clientX, event.clientY) ?? drag.lastId;
      if (id !== drag.lastId) {
        drag.lastId = id;
        labBulk.selectDragRange(drag.startId, id);
      }
      event.preventDefault();
      event.stopPropagation();
    },

    onPointerup: finishPointer,
    onPointercancel: finishPointer,
  };
}
