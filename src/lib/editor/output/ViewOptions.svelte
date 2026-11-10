<script lang="ts">
  // The view-options pill: one trigger that opens a small popover with the two
  // preview-only display toggles, smoothing and background. They change what
  // you see, not the saved file, and matter only some of the time (smoothing is
  // a no-op until you zoom past 1:1), so they sit behind one affordance instead
  // of permanently on the bar. Shared by the editor's Output bar and the bulk
  // stack toolbar in FocusView; the parent owns both values through bind:.
  //
  // The smoothing toggle is omitted on Safari, where image-rendering:pixelated
  // is a no-op, so there the popover shows one item.
  //
  // `leading` renders inside the same pill group, before the trigger (Output
  // puts Rotate there). It stays inside the light-dismiss boundary, so clicking
  // it leaves an open popover open, and the trigger loses its rounded left end.
  // Snippet content keeps its parent's scoped styles.
  //
  // The group sets its own pointer-events: both parents disable them on their
  // bar and re-enable them for direct children through a scoped `> *` rule,
  // which does not reach a child component's root.
  import type { Snippet } from 'svelte';
  import { isSafari } from 'client/lazy-app/util';
  import { lightDismiss } from '$lib/editor/light-dismiss';

  interface Props {
    /** Smoothing off: the preview uses image-rendering:pixelated. */
    pixelated: boolean;
    /** The light stage background in place of the dark one. */
    altBackground: boolean;
    /** Extra pill segment(s) rendered before the trigger. */
    leading?: Snippet;
  }

  let {
    pixelated = $bindable(),
    altBackground = $bindable(),
    leading,
  }: Props = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement>();
  // Either toggle in its non-default state. Drives a dot on the trigger so a
  // changed setting stays discoverable while the popover is closed.
  const dirty = $derived(pixelated || altBackground);

  const dismiss = lightDismiss({
    isOpen: () => open,
    close: () => (open = false),
    focusOnEscape: () => trigger,
  });
</script>

<div class="button-group" {@attach dismiss}>
  {@render leading?.()}
  <button
    class={[
      'button last-button view-options-trigger',
      { 'first-button': !leading, active: open, dirty },
    ]}
    onclick={() => (open = !open)}
    title="View options: preview smoothing and background"
    aria-label="View options"
    aria-haspopup="true"
    aria-expanded={open}
    bind:this={trigger}
  >
    <svg class="icon" viewBox="0 0 24 24"
      ><path
        d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
      /></svg
    >
  </button>

  {#if open}
    <div class="view-options" role="group" aria-label="View options">
      {#if !isSafari}
        <button
          class={['view-option', { active: pixelated }]}
          onclick={() => (pixelated = !pixelated)}
          aria-pressed={pixelated}
        >
          {#if pixelated}
            <svg class="icon" viewBox="0 0 24 24"
              ><path
                d="M12 3h5v2h2v2h2v5h-2V9h-2V7h-2V5h-3V3M21 12v5h-2v2h-2v2h-5v-2h3v-2h2v-2h2v-3h2M12 21H7v-2H5v-2H3v-5h2v3h2v2h2v2h3v2M3 12V7h2V5h2V3h5v2H9v2H7v2H5v3H3"
              /></svg
            >
          {:else}
            <svg class="icon" viewBox="0 0 24 24"
              ><circle
                cx="12"
                cy="12"
                r="8"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              /></svg
            >
          {/if}
          <span class="view-option-label">Smoothing</span>
          <span class="view-option-state">{pixelated ? 'Pixelated' : 'On'}</span
          >
        </button>
      {/if}
      <button
        class={['view-option', { active: altBackground }]}
        onclick={() => (altBackground = !altBackground)}
        aria-pressed={altBackground}
      >
        {#if altBackground}
          <svg class="icon" viewBox="0 0 24 24"
            ><path
              d="M9 7H7v2h2V7zm0 4H7v2h2v-2zm0-8a2 2 0 0 0-2 2h2V3zm4 12h-2v2h2v-2zm6-12v2h2a2 2 0 0 0-2-2zm-6 0h-2v2h2V3zM9 17v-2H7c0 1.1.9 2 2 2zm10-4h2v-2h-2v2zm0-4h2V7h-2v2zm0 8a2 2 0 0 0 2-2h-2v2zM5 7H3v12c0 1.1.9 2 2 2h12v-2H5V7zm10-2h2V3h-2v2zm0 12h2v-2h-2v2z"
            /></svg
          >
        {:else}
          <svg class="icon" viewBox="0 0 24 24"
            ><path
              d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm2 4v-2H3c0 1.1.9 2 2 2zM3 9h2V7H3v2zm12 12h2v-2h-2v2zm4-18H9a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12H9V5h10v10zm-8 6h2v-2h-2v2zm-4 0h2v-2H7v2z"
            /></svg
          >
        {/if}
        <span class="view-option-label">Background</span>
        <span class="view-option-state">{altBackground ? 'Light' : 'Dark'}</span
        >
      </button>
    </div>
  {/if}
</div>

<style>
  /* The trigger's pill segment matches the bar it sits in (Output.svelte
     `.button`), so a parent's own segments and this one read as one group. */
  .button-group {
    display: flex;
    position: relative;
    border-radius: 999px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    pointer-events: auto;
  }

  .button {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    min-width: 40px;
    height: 38px;
    padding: 0 7px;
    background-color: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-width: 1px 0 1px 1px;
    line-height: 1.1;
    white-space: nowrap;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-2, #bbb);
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .button:hover {
    background: rgba(45, 45, 54, 0.92);
    color: var(--text-1, #fff);
  }

  .button.active {
    background: rgba(62, 62, 74, 0.95);
    color: var(--text-1, #fff);
  }

  .first-button {
    border-radius: 999px 0 0 999px;
    padding-left: 11px;
  }

  .last-button {
    border-radius: 0 999px 999px 0;
    border-right-width: 1px;
    padding-right: 11px;
  }

  .first-button.last-button {
    border-radius: 999px;
  }

  .icon {
    display: block;
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  /* A small dot in the corner while a toggle is in its non-default state, so a
     changed setting stays visible while the popover is shut. */
  .view-options-trigger {
    position: relative;
  }

  .view-options-trigger.dirty::after {
    content: '';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-1, #ff8a5e);
  }

  /* The popover floats above the trigger (both bars sit at the bottom),
     right-aligned to the group. Out of flow so it never reflows the bar. */
  .view-options {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    min-width: 196px;
    background-color: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }

  .view-option {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--text-2, #bbb);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    text-align: left;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .view-option:hover {
    background: rgba(45, 45, 54, 0.92);
    color: var(--text-1, #fff);
  }

  .view-option.active {
    color: var(--text-1, #fff);
  }

  .view-option-label {
    flex: 1;
  }

  /* Trailing current-value text ("On" / "Pixelated", "Dark" / "Light"). */
  .view-option-state {
    color: var(--text-3, #939393);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }

  .view-option.active .view-option-state {
    color: var(--accent-1, #ff8a5e);
  }
</style>
