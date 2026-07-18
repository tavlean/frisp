<script lang="ts">
  // Generic inset segmented control: a recessed warm-gray track holding equal
  // segments, the active one lifted into a raised white pill. Used for the
  // panel tabs (Image|Compare, Edit|Compress). Purely presentational — the
  // parent owns `value` and reacts to `onchange`.
  interface Option {
    id: string;
    label: string;
  }

  interface Props {
    options: Option[];
    value: string;
    onchange: (id: string) => void;
    ariaLabel?: string;
  }

  let { options, value, onchange, ariaLabel }: Props = $props();
</script>

<div class="segmented" role="tablist" aria-label={ariaLabel}>
  {#each options as option (option.id)}
    <button
      type="button"
      role="tab"
      class="segment"
      class:active={option.id === value}
      aria-selected={option.id === value}
      onclick={() => onchange(option.id)}
    >
      {option.label}
    </button>
  {/each}
</div>

<style>
  .segmented {
    display: flex;
    gap: 2px;
    padding: 3px;
    border-radius: 12px;
    background: var(--pc-inset);
    box-shadow: var(--pc-inset-shadow);
  }
  @supports (corner-shape: squircle) {
    .segmented {
      corner-shape: squircle;
      border-radius: 14px;
    }
  }

  .segment {
    flex: 1 1 0;
    min-width: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 30px;
    padding: 0 12px;
    border: 1px solid transparent;
    border-radius: 9px;
    background: transparent;
    color: var(--pc-text-2);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition:
      color 150ms ease,
      background-color 150ms ease,
      box-shadow 150ms ease;
  }
  @supports (corner-shape: squircle) {
    .segment {
      corner-shape: squircle;
      border-radius: 11px;
    }
  }

  .segment:hover:not(.active) {
    color: var(--pc-text-1);
  }

  .segment.active {
    background: var(--pc-raise);
    border-color: var(--pc-border);
    color: var(--pc-text-1);
    font-weight: 600;
    box-shadow: var(--pc-shadow-control);
  }

  .segment:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }
</style>
