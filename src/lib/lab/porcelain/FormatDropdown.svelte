<script lang="ts">
  // The encoder picker as a raised dropdown row (leading icon, current label,
  // trailing chevron) opening a raised popover of options. Replaces the reused
  // native Select for the porcelain look; same job (choose "Original Image" or
  // one of the encoders). Light-dismiss + Escape via the shared attachment.
  import { lightDismiss } from '$lib/editor/light-dismiss';
  import { IDENTITY, type SideFormat } from '$lib/compress';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import imageIcon from '$lib/lab/icons/image.svg?raw';
  import chevronDownIcon from '$lib/lab/icons/chevron-down.svg?raw';
  import checkIcon from '$lib/lab/icons/check.svg?raw';

  interface FormatOption {
    id: string;
    label: string;
    tooltip?: string;
    ext: string;
  }

  interface Props {
    value: SideFormat;
    formats: FormatOption[];
    onchange: (format: SideFormat) => void;
  }

  let { value, formats, onchange }: Props = $props();

  let open = $state(false);
  let triggerEl = $state<HTMLButtonElement>();

  const currentLabel = $derived(
    value === IDENTITY
      ? 'Original Image'
      : (formats.find((f) => f.id === value)?.label ?? String(value)),
  );

  const dismiss = lightDismiss({
    isOpen: () => open,
    close: () => (open = false),
    focusOnEscape: () => triggerEl,
  });

  function choose(id: SideFormat) {
    open = false;
    triggerEl?.focus();
    onchange(id);
  }

  function onTriggerKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' && !open) {
      event.preventDefault();
      open = true;
    }
  }
</script>

<div class="dropdown" {@attach dismiss}>
  <button
    type="button"
    class="trigger"
    bind:this={triggerEl}
    onclick={() => (open = !open)}
    onkeydown={onTriggerKeydown}
    aria-haspopup="listbox"
    aria-expanded={open}
  >
    <span class="lead"><LabIcon svg={imageIcon} size={18} /></span>
    <span class="label">{currentLabel}</span>
    <span class="chev"><LabIcon svg={chevronDownIcon} size={16} /></span>
  </button>

  {#if open}
    <div class="popover" role="listbox" aria-label="Output format">
      <button
        type="button"
        role="option"
        class="option"
        class:selected={value === IDENTITY}
        aria-selected={value === IDENTITY}
        onclick={() => choose(IDENTITY)}
      >
        <span class="opt-label">Original Image</span>
        {#if value === IDENTITY}
          <span class="check"><LabIcon svg={checkIcon} size={16} /></span>
        {/if}
      </button>
      {#each formats as format (format.id)}
        <button
          type="button"
          role="option"
          class="option"
          class:selected={value === format.id}
          aria-selected={value === format.id}
          title={format.tooltip}
          onclick={() => choose(format.id as SideFormat)}
        >
          <span class="opt-label">{format.label}</span>
          <span class="ext">{format.ext.toUpperCase()}</span>
          {#if value === format.id}
            <span class="check"><LabIcon svg={checkIcon} size={16} /></span>
          {/if}
        </button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .dropdown {
    position: relative;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    height: 44px;
    padding: 0 12px;
    border: 1px solid var(--pc-border);
    border-radius: 12px;
    background: var(--pc-raise);
    color: var(--pc-text-1);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--pc-shadow-control);
    transition:
      background-color 150ms ease,
      border-color 150ms ease;
  }
  @supports (corner-shape: squircle) {
    .trigger {
      corner-shape: squircle;
      border-radius: 14px;
    }
  }

  .trigger:hover {
    border-color: var(--pc-border-strong);
  }

  .trigger:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .lead {
    display: inline-flex;
    flex: none;
    color: var(--pc-text-2);
  }

  .label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }

  .chev {
    display: inline-flex;
    flex: none;
    color: var(--pc-text-3);
  }

  .popover {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 6px;
    background: var(--pc-surface);
    border: 1px solid var(--pc-border);
    border-radius: 14px;
    box-shadow: var(--pc-shadow-popover);
  }
  @supports (corner-shape: squircle) {
    .popover {
      corner-shape: squircle;
      border-radius: 16px;
    }
  }

  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--pc-text-1);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    text-align: left;
    transition: background-color 130ms ease;
  }
  @supports (corner-shape: squircle) {
    .option {
      corner-shape: squircle;
      border-radius: 11px;
    }
  }

  .option:hover {
    background: var(--pc-inset);
  }

  .option.selected {
    background: var(--pc-inset);
    font-weight: 600;
  }

  .option:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: -2px;
  }

  .opt-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ext {
    flex: none;
    font-size: 11px;
    font-weight: 600;
    color: var(--pc-text-3);
    letter-spacing: 0.04em;
  }

  .check {
    display: inline-flex;
    flex: none;
    color: var(--pc-text-1);
  }
</style>
