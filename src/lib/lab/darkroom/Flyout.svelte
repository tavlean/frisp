<script lang="ts">
  // A rail-anchored flyout panel: a floating card positioned just right of the
  // left icon rail, with a title + close header and lightDismiss (Escape +
  // click-out). The `anchorTop` prop lets each opener line the flyout up near
  // its trigger. Content is a snippet.
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
  class="dr-flyout"
  style:top="{anchorTop}px"
  role="dialog"
  aria-label={title}
  {@attach dismiss}
>
  <header class="dr-flyout-head">
    <h2 class="dr-flyout-title">{title}</h2>
    <button
      type="button"
      class="dr-flyout-close"
      data-tooltip="Close"
      aria-label="Close"
      onclick={() => onClose()}
    >
      <LabIcon svg={closeIcon} />
    </button>
  </header>
  <div class="dr-flyout-body">
    {@render children()}
  </div>
</div>

<style>
  .dr-flyout {
    position: fixed;
    left: calc(12px + 40px + 10px);
    width: 280px;
    max-height: calc(100dvh - 24px);
    z-index: 25;
    display: flex;
    flex-direction: column;
    border-radius: 12px;
    border: 1px solid var(--dr-border);
    background: var(--dr-panel);
    box-shadow: var(--dr-shadow-pop);
    overflow: hidden;
  }

  .dr-flyout-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 10px 10px 14px;
    border-bottom: 1px solid var(--dr-border);
  }

  .dr-flyout-title {
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--dr-text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dr-flyout-close {
    flex: none;
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: none;
    color: var(--dr-text-2);
    cursor: pointer;
    transition:
      color 150ms ease,
      background-color 150ms ease,
      border-color 150ms ease;
  }
  .dr-flyout-close:hover {
    color: var(--dr-text-1);
    background: var(--dr-chip);
    border-color: var(--dr-border);
  }
  .dr-flyout-close:focus-visible {
    outline: 2px solid var(--dr-focus);
    outline-offset: 2px;
  }

  .dr-flyout-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 12px 14px 14px;
  }

  @media (max-width: 760px) {
    .dr-flyout {
      width: min(280px, calc(100vw - 72px));
    }
  }
</style>
