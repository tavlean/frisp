<script lang="ts">
  // A rail-anchored flyout panel (darkroom's Flyout logic): a floating card just
  // right of the left rail, with a title + close (✕) header and lightDismiss
  // (Escape + click-out). `anchorTop` lines it up near its rail trigger. Content
  // is a snippet. Porcelain card styling: white surface, big soft shadow, ~18px
  // squircle corners.
  import type { Snippet } from 'svelte';
  import { lightDismiss } from '$lib/editor/light-dismiss';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import closeIcon from '$lib/lab/icons/close.svg?raw';

  interface Props {
    title: string;
    /** Distance from the top of the viewport to align the flyout near its rail
     *  trigger, in px. */
    anchorTop?: number;
    onClose: () => void;
    /** Element to restore focus to on Escape (the rail trigger button). */
    focusOnClose?: () => HTMLElement | undefined | null;
    children: Snippet;
  }

  let {
    title,
    anchorTop = 96,
    onClose,
    focusOnClose,
    children,
  }: Props = $props();

  // Wrap the callbacks in closures so the attachment reads their LIVE values,
  // not the ones captured when lightDismiss() first ran (avoids
  // state_referenced_locally).
  const dismiss = lightDismiss({
    isOpen: () => true,
    close: () => onClose(),
    focusOnEscape: () => focusOnClose?.(),
  });
</script>

<div
  class="hy-flyout"
  style:top="{anchorTop}px"
  role="dialog"
  aria-label={title}
  {@attach dismiss}
>
  <header class="hy-flyout-head">
    <h2 class="hy-flyout-title">{title}</h2>
    <button
      type="button"
      class="hy-flyout-close"
      aria-label="Close"
      onclick={() => onClose()}
    >
      <LabIcon svg={closeIcon} size={16} />
    </button>
  </header>
  <div class="hy-flyout-body">
    {@render children()}
  </div>
</div>

<style>
  .hy-flyout {
    position: fixed;
    left: calc(var(--hy-margin) + var(--hy-rail-w) + 10px);
    width: 288px;
    max-height: calc(100dvh - 24px);
    z-index: 25;
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    border: 1px solid var(--pc-border);
    background: var(--pc-panel);
    box-shadow: var(--pc-shadow-panel);
    overflow: hidden;
  }
  @supports (corner-shape: squircle) {
    .hy-flyout {
      corner-shape: squircle;
      border-radius: 22px;
    }
  }

  .hy-flyout-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 13px 10px 10px 16px;
    border-bottom: 1px solid var(--pc-border);
  }

  .hy-flyout-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--pc-text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hy-flyout-close {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--pc-text-3);
    cursor: pointer;
    transition:
      color 140ms ease,
      background-color 140ms ease;
  }
  .hy-flyout-close:hover {
    color: var(--pc-text-1);
    background: var(--pc-inset);
  }
  .hy-flyout-close:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }
  .hy-flyout-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 14px 16px 16px;
  }

  @media (max-width: 760px) {
    .hy-flyout {
      width: min(288px, calc(100vw - 84px));
    }
  }
</style>
