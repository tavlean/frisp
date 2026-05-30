<script lang="ts">
  // Ported from src/client/lazy-app/Compress/Options/Range + its <range-input>
  // custom element. A native range input (transparent) drives a styled track,
  // thumb, and a value bubble that appears while dragging; a number input mirrors
  // the value. `value` is bindable; label text comes from children.
  import type { Snippet } from 'svelte';

  interface Props {
    value: number;
    min: number | string;
    max: number | string;
    step?: number | string;
    name?: string;
    disabled?: boolean;
    /** Forces decimal places in the bubble; otherwise derived from `step`. */
    labelPrecision?: string;
    /** Fires with the committed numeric value (for derived/inverted fields). */
    oninput?: (value: number) => void;
    children?: Snippet;
  }

  let {
    value = $bindable(),
    min,
    max,
    step = 1,
    name,
    disabled = false,
    labelPrecision = '',
    oninput,
    children,
  }: Props = $props();

  let active = $state(false);

  function precisionOf(s: string): number {
    const afterDecimal = s.split('.')[1];
    return afterDecimal ? afterDecimal.length : 0;
  }

  const percent = $derived(
    ((value - Number(min)) / (Number(max) - Number(min))) * 100,
  );

  const displayValue = $derived.by(() => {
    if (value >= 10000) return (value / 1000).toFixed(1) + 'k';
    const precision = Number(labelPrecision) || precisionOf(String(step)) || 0;
    return precision ? value.toFixed(precision) : Math.round(value).toString();
  });

  function commit(raw: string) {
    if (!raw.trim()) return;
    const next = Number(raw);
    if (Number.isNaN(next)) return;
    value = next;
    oninput?.(next);
  }

  function onPointerDown() {
    active = true;
    const up = () => {
      active = false;
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  }
</script>

<label class="range">
  <span class="label-text">{@render children?.()}</span>
  <div class="range-wc-container">
    <div
      class="range-input"
      class:active
      class:disabled
      style="--value-percent: {percent}%; --value-width: {displayValue.length}"
    >
      <input
        class="input"
        type="range"
        {name}
        {min}
        {max}
        {step}
        {disabled}
        {value}
        oninput={(e) => commit(e.currentTarget.value)}
        onpointerdown={onPointerDown}
      />
      <div class="thumb-wrapper">
        <div class="thumb"></div>
        <div class="value-display">
          <svg width="32" height="62" aria-hidden="true">
            <path
              d="M27.3 27.3C25 29.6 17 35.8 17 43v3c0 3 2.5 5 3.2 5.8a6 6 0 1 1-8.5 0C12.6 51 15 49 15 46v-3c0-7.2-8-13.4-10.3-15.7A16 16 0 0 1 16 0a16 16 0 0 1 11.3 27.3z"
            />
          </svg>
          <span>{displayValue}</span>
        </div>
      </div>
    </div>
  </div>
  <input
    class="text-input"
    type="number"
    {min}
    {max}
    {step}
    {disabled}
    {value}
    oninput={(e) => commit(e.currentTarget.value)}
  />
</label>

<style>
  .range {
    position: relative;
    z-index: 0;
    display: grid;
    grid-template-columns: 1fr auto;
  }

  .label-text {
    color: #fff;
  }

  .range-wc-container {
    position: relative;
    z-index: 1;
    grid-row: 2 / 3;
    grid-column: 1 / 3;
  }

  .range-input {
    position: relative;
    display: flex;
    height: 18px;
    width: 100%;
    margin: 2px 0;
    font: inherit;
    line-height: 16px;
    overflow: visible;
  }

  .range-input::before {
    content: '';
    display: block;
    position: absolute;
    top: 8px;
    left: 0;
    width: 100%;
    height: 2px;
    border-radius: 1px;
    background: linear-gradient(
        var(--main-theme-color),
        var(--main-theme-color)
      )
      0 / var(--value-percent, 0%) 100% no-repeat var(--medium-light-gray);
  }

  .input {
    position: relative;
    width: 100%;
    padding: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
  }

  .thumb {
    pointer-events: none;
    position: absolute;
    bottom: 3px;
    left: 0;
    margin-left: -6px;
    background: var(--main-theme-color);
    border-radius: 50%;
    width: 12px;
    height: 12px;
  }

  .range-input:focus-within .thumb {
    outline: white solid 2px;
  }

  .thumb-wrapper {
    position: absolute;
    left: 6px;
    right: 6px;
    bottom: 0;
    height: 0;
    overflow: visible;
    transform: translate(var(--value-percent, 0%), 0);
    pointer-events: none;
  }

  .value-display {
    position: absolute;
    box-sizing: border-box;
    left: 0;
    bottom: 3px;
    width: 32px;
    height: 62px;
    text-align: center;
    padding: 8px 3px 0;
    margin: 0 0 0 -16px;
    transform-origin: 50% 90%;
    opacity: 0.0001;
    transform: scale(0.2);
    color: #fff;
    font: inherit;
    font-size: calc(100% - var(--value-width, 3) / 5 * 0.2em);
    text-overflow: clip;
    text-shadow: 0 -0.5px 0 rgba(0, 0, 0, 0.4);
    transition: all 200ms ease;
    transition-property: opacity, transform;
    will-change: transform;
    pointer-events: none;
    overflow: hidden;
  }

  .value-display > svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    fill: var(--main-theme-color);
  }

  .value-display > span {
    position: relative;
  }

  .range-input.active .value-display {
    opacity: 1;
    transform: scale(1);
  }

  .range-input.active .thumb {
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
  }

  .range-input.disabled {
    filter: grayscale(1);
    cursor: default;
  }

  .text-input {
    grid-row: 1 / 2;
    grid-column: 2 / 3;
    text-align: right;
    background: transparent;
    color: inherit;
    font: inherit;
    border: none;
    padding: 2px 5px;
    box-sizing: border-box;
    text-decoration: underline;
    text-decoration-style: dotted;
    text-decoration-color: var(--main-theme-color);
    text-underline-position: under;
    width: 54px;
    position: relative;
    left: 5px;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  .text-input:focus {
    background: #fff;
    color: #000;
  }

  .text-input::-webkit-outer-spin-button,
  .text-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
