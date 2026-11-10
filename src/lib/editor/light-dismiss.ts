import type { Attachment } from 'svelte/attachments';

interface LightDismissOptions {
  isOpen: () => boolean;
  close: () => void;
  focusOnEscape?: () => HTMLElement | undefined | null;
}

export function lightDismiss({
  isOpen,
  close,
  focusOnEscape,
}: LightDismissOptions): Attachment<HTMLElement> {
  return (node) => {
    const onPointerDown = (event: PointerEvent) => {
      if (!isOpen() || node.contains(event.target as Node)) return;
      close();
    };
    // One Escape closes one layer. The open popover is the top layer, so it
    // takes the key in the capture phase and stops it there; otherwise the
    // bulk view's own Escape handler would also deselect the image under it.
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isOpen() || event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      close();
      focusOnEscape?.()?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown, true);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown, true);
    };
  };
}
