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
    const onKeyDown = (event: KeyboardEvent) => {
      if (!isOpen() || event.key !== 'Escape') return;
      close();
      focusOnEscape?.()?.focus();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  };
}
