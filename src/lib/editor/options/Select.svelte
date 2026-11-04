<script lang="ts">
  // A styled native select with a custom chevron. `value` is bindable;
  // children supply <option>s. `large` is the prominent format picker.
  // `action` marks a select that runs a one-shot command on choose (Auto
  // quality) rather than holding a setting: it drops the `builtin-select`
  // class, which hosts and e2e specs use to find a panel's setting selects
  // (the format picker first among them).
  import type { Snippet } from 'svelte';

  interface Props {
    value?: string | number;
    name?: string;
    /** Hover tooltip on the collapsed control (e.g. the active encoder). */
    title?: string;
    large?: boolean;
    action?: boolean;
    disabled?: boolean;
    onchange?: (value: string) => void;
    children: Snippet;
  }

  let {
    value = $bindable(),
    name,
    title,
    large = false,
    action = false,
    disabled = false,
    onchange,
    children,
  }: Props = $props();
</script>

<div class="select">
  <select
    class={{ 'builtin-select': !action, large }}
    {name}
    {title}
    {disabled}
    bind:value
    onchange={(e) => onchange?.(e.currentTarget.value)}
  >
    {@render children()}
  </select>
  <div class="arrow">
    <svg viewBox="0 -1.95 9.8 9.8" aria-hidden="true">
      <path
        d="M8.2.2a1 1 0 011.4 1.4l-4 4a1 1 0 01-1.4 0l-4-4A1 1 0 011.6.2l3.3 3.3L8.2.2z"
      />
    </svg>
  </div>
</div>

<style>
  .select {
    position: relative;
  }

  select {
    background: rgba(0, 0, 0, 0.35);
    border-radius: 8px;
    font: inherit;
    padding: 7px 0;
    padding-right: 25px;
    padding-left: 10px;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    color: var(--text-1, #fff);
    width: 100%;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      background-color 150ms ease;
  }

  select:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    background: rgba(0, 0, 0, 0.45);
  }

  select:focus-visible {
    outline: none;
    border-color: var(--main-theme-color);
  }

  .arrow {
    position: absolute;
    right: 9px;
    top: 50%;
    transform: translateY(-50%);
    fill: var(--text-2, #aaa);
    width: 10px;
    pointer-events: none;
    transition: fill 150ms ease;
  }

  .select:hover .arrow {
    fill: var(--text-1, #fff);
  }

  .arrow svg {
    display: block;
    width: 100%;
  }

  /* The format picker: bolder, accent-edged. */
  .large {
    padding: 10px 35px 10px 12px;
    font-weight: 600;
    background:
      linear-gradient(rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03))
        padding-box,
      rgba(0, 0, 0, 0.3);
    border-radius: 10px;
  }

  .large:focus-visible,
  .large:hover {
    box-shadow: 0 0 14px var(--main-theme-glow, transparent);
  }

  .large + .arrow {
    right: 13px;
  }
</style>
