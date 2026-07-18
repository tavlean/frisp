<script lang="ts">
  // A chip-style dropdown: a full-width inset chip showing the current option's
  // label with a trailing chevron, opening a small panel-bg popover card of
  // option rows (hover raised fill; selected = active fill + check). Closed with
  // lightDismiss (Escape + click-out). Used for the Inspector's format picker;
  // kept generic (value/options/onchange) so it can be reused.
  import { lightDismiss } from '$lib/editor/light-dismiss';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import chevronDownIcon from '$lib/lab/icons/chevron-down.svg?raw';
  import checkIcon from '$lib/lab/icons/check.svg?raw';

  interface Option {
    value: string;
    label: string;
    /** Optional small trailing hint (e.g. encoder/engine name). */
    hint?: string;
  }

  interface Props {
    value: string;
    options: Option[];
    onchange: (value: string) => void;
    ariaLabel?: string;
  }

  let { value, options, onchange, ariaLabel = 'Select' }: Props = $props();

  let open = $state(false);
  let triggerEl = $state<HTMLButtonElement>();

  const current = $derived(
    options.find((option) => option.value === value) ?? options[0],
  );

  const dismiss = lightDismiss({
    isOpen: () => open,
    close: () => (open = false),
    focusOnEscape: () => triggerEl,
  });

  function select(next: string): void {
    open = false;
    if (next !== value) onchange(next);
  }
</script>

<div class="dr-dropdown" {@attach dismiss}>
  <button
    type="button"
    class="dr-dropdown-trigger"
    class:open
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-label={ariaLabel}
    bind:this={triggerEl}
    onclick={() => (open = !open)}
  >
    <span class="dr-dropdown-current">{current?.label ?? ''}</span>
    <span class="dr-dropdown-chevron">
      <LabIcon svg={chevronDownIcon} size={12} />
    </span>
  </button>

  {#if open}
    <div class="dr-dropdown-card" role="listbox" aria-label={ariaLabel}>
      {#each options as option (option.value)}
        <button
          type="button"
          role="option"
          aria-selected={option.value === value}
          class="dr-dropdown-option"
          class:selected={option.value === value}
          onclick={() => select(option.value)}
        >
          <span class="dr-option-check">
            {#if option.value === value}
              <LabIcon svg={checkIcon} size={12} />
            {/if}
          </span>
          <span class="dr-option-label">{option.label}</span>
          {#if option.hint}
            <span class="dr-option-hint">{option.hint}</span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dr-dropdown {
    position: relative;
    width: 100%;
  }

  .dr-dropdown-trigger {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 34px;
    padding: 0 10px 0 12px;
    box-sizing: border-box;
    border-radius: 8px;
    border: 1px solid var(--dr-border);
    background: var(--dr-inset);
    color: var(--dr-text-1);
    font: inherit;
    font-size: 1rem;
    font-weight: 500;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background-color 150ms ease;
  }
  .dr-dropdown-trigger:hover,
  .dr-dropdown-trigger.open {
    border-color: var(--dr-border-strong);
  }
  .dr-dropdown-trigger:focus-visible {
    outline: 2px solid var(--dr-focus);
    outline-offset: 2px;
  }

  .dr-dropdown-current {
    flex: 1;
    min-width: 0;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dr-dropdown-chevron {
    flex: none;
    display: grid;
    place-items: center;
    width: 12px;
    height: 12px;
    color: var(--dr-text-2);
  }

  .dr-dropdown-card {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid var(--dr-border);
    background: var(--dr-panel);
    box-shadow: var(--dr-shadow-pop);
    max-height: 280px;
    overflow-y: auto;
  }

  .dr-dropdown-option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 30px;
    padding: 0 8px;
    border: none;
    border-radius: 7px;
    background: none;
    color: var(--dr-text-2);
    font: inherit;
    font-size: 1rem;
    cursor: pointer;
    text-align: left;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }
  .dr-dropdown-option:hover {
    background: var(--dr-chip-hover);
    color: var(--dr-text-1);
  }
  .dr-dropdown-option.selected {
    background: var(--dr-chip-active);
    color: var(--dr-text-1);
  }

  .dr-option-check {
    flex: none;
    display: grid;
    place-items: center;
    width: 12px;
    height: 12px;
    color: var(--dr-text-1);
  }

  .dr-option-label {
    flex: 1;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .dr-option-hint {
    flex: none;
    font-size: 0.85rem;
    color: var(--dr-text-3);
    text-transform: lowercase;
  }
</style>
