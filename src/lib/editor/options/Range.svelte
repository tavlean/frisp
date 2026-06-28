<script lang="ts">
  // A native range input (transparent) drives a styled track, thumb, and a
  // floating value chip that appears while dragging; a number input mirrors
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
    /** Magnetic snapping to round numbers; auto-on for wide ranges. */
    snap?: boolean;
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
    snap,
    oninput,
    children,
  }: Props = $props();

  let active = $state(false);
  let dragging = false;
  let inputEl: HTMLInputElement;

  // Half the visual thumb width; the thumb centre travels inset by this much, so
  // pointer-to-value mapping must use the same inset to stay aligned with it.
  const THUMB_HALF = 7;
  // Catch radii (value units) for the cubic magnet. Multiples of 10 pull harder
  // than the in-between multiples of 5; outside the radius the mapping is linear.
  const MAGNET_R10 = 1.8;
  const MAGNET_R5 = 0.9;

  // Auto-enable on wide ranges (quality, filter strength, …); narrow knobs
  // (effort, sharpness) keep the plain native drag. `snap={false}` forces off.
  const magnetic = $derived(snap ?? Number(max) - Number(min) >= 50);

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

  function emit(next: number) {
    if (Number.isNaN(next)) return;
    value = next;
    oninput?.(next);
  }

  function commit(raw: string) {
    if (!raw.trim()) return;
    emit(Number(raw));
  }

  // Warp a raw value toward the nearest multiple of 5/10: flat near the magnet
  // (round numbers occupy more travel) but still monotonic, so every value in
  // between stays reachable — just over fewer pixels.
  function magnetize(raw: number): number {
    const m = Math.round(raw / 5) * 5;
    const r = m % 10 === 0 ? MAGNET_R10 : MAGNET_R5;
    const d = raw - m;
    if (Math.abs(d) >= r) return raw;
    return m + (d * d * d) / (r * r);
  }

  function valueFromClientX(clientX: number): number {
    const lo = Number(min);
    const hi = Number(max);
    const stepSize = Number(step) || 1;
    const rect = inputEl.getBoundingClientRect();
    const travel = rect.width - THUMB_HALF * 2;
    const frac = Math.min(
      1,
      Math.max(0, (clientX - rect.left - THUMB_HALF) / travel),
    );
    let v = lo + frac * (hi - lo);
    if (magnetic) v = magnetize(v);
    v = lo + Math.round((v - lo) / stepSize) * stepSize;
    return Math.min(hi, Math.max(lo, v));
  }

  function onPointerDown(e: PointerEvent) {
    if (disabled) return;
    active = true;
    const up = () => {
      active = false;
      dragging = false;
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);

    // Take over the drag so the pointer can warp toward round numbers; the
    // native input still owns keyboard stepping and a11y semantics.
    if (!magnetic) return;
    e.preventDefault();
    dragging = true;
    inputEl.focus();
    try {
      inputEl.setPointerCapture(e.pointerId);
    } catch {
      // Odd pointer states can reject capture; the drag still works via move.
    }
    emit(valueFromClientX(e.clientX));
  }

  function onPointerMove(e: PointerEvent) {
    if (dragging) emit(valueFromClientX(e.clientX));
  }
</script>

<label class="range">
  <span class="label-text">{@render children?.()}</span>
  <div class="range-wc-container">
    <div
      class="range-input"
      class:active
      class:disabled
      style="--value-percent: {percent}%"
    >
      <input
        bind:this={inputEl}
        class="input"
        type="range"
        {name}
        {min}
        {max}
        {step}
        {disabled}
        {value}
        style:touch-action={magnetic ? 'none' : null}
        oninput={(e) => commit(e.currentTarget.value)}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
      />
      <div class="thumb-wrapper">
        <div class="thumb"></div>
        <div class="value-display">{displayValue}</div>
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
    align-items: center;
  }

  .label-text {
    color: var(--text-2, #aaa);
    transition: color 150ms ease;
  }

  .range:hover .label-text,
  .range:focus-within .label-text {
    color: var(--text-1, #fff);
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
    height: 22px;
    width: 100%;
    margin: 2px 0;
    font: inherit;
    align-items: center;
    overflow: visible;
  }

  /* Track: a slim rail with an accent-gradient fill up to the value. */
  .range-input::before {
    content: '';
    display: block;
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    left: 0;
    width: 100%;
    height: 4px;
    border-radius: 2px;
    background:
      linear-gradient(
          90deg,
          var(--hot-theme-color, #888),
          var(--main-theme-color, #aaa)
        )
        0 / var(--value-percent, 0%) 100% no-repeat,
      var(--medium-light-gray, rgba(255, 255, 255, 0.18));
  }

  .input {
    position: relative;
    width: 100%;
    padding: 0;
    margin: 0;
    opacity: 0;
    cursor: pointer;
    height: 100%;
  }

  .thumb {
    pointer-events: none;
    position: absolute;
    top: 50%;
    left: 0;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    transform: translateY(-50%);
    background: var(--main-theme-color, #fff);
    border: 2.5px solid #fff;
    box-sizing: border-box;
    border-radius: 50%;
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.45),
      0 0 0 0 var(--main-theme-glow, transparent);
    transition:
      box-shadow 200ms ease,
      transform 150ms ease;
  }

  .range-input:hover .thumb {
    transform: translateY(-50%) scale(1.12);
  }

  .range-input:focus-within .thumb,
  .range-input.active .thumb {
    box-shadow:
      0 1px 4px rgba(0, 0, 0, 0.45),
      0 0 0 5px var(--main-theme-glow, rgba(255, 255, 255, 0.2));
  }

  .thumb-wrapper {
    /* Spans the thumb's travel range; translateX(%) is relative to this
       element's own width, so the thumb lands exactly under the native input's
       thumb position. */
    position: absolute;
    left: 7px;
    right: 7px;
    top: 0;
    bottom: 0;
    overflow: visible;
    transform: translateX(var(--value-percent, 0%));
    pointer-events: none;
  }

  /* Floating value chip, shown while dragging. */
  .value-display {
    position: absolute;
    bottom: calc(100% - 2px);
    left: 0;
    transform: translateX(-50%) translateY(4px) scale(0.8);
    transform-origin: 50% 100%;
    opacity: 0;
    padding: 3px 8px;
    border-radius: 7px;
    background: var(--main-theme-color, #444);
    color: #16161c;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
    transition:
      opacity 180ms ease,
      transform 180ms cubic-bezier(0.34, 1.4, 0.64, 1);
    pointer-events: none;
  }

  .range-input.active .value-display {
    opacity: 1;
    transform: translateX(-50%) translateY(0) scale(1);
  }

  .range-input.disabled {
    filter: grayscale(1);
    opacity: 0.5;
    cursor: default;
  }

  .text-input {
    grid-row: 1 / 2;
    grid-column: 2 / 3;
    text-align: right;
    background: transparent;
    color: var(--text-1, #fff);
    font: inherit;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    border: none;
    border-radius: 6px;
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
    transition: background-color 150ms ease;
  }

  .text-input:focus {
    outline: none;
    background: rgba(0, 0, 0, 0.45);
    text-decoration-color: transparent;
    box-shadow: inset 0 0 0 1px var(--main-theme-color);
  }

  .text-input::-webkit-outer-spin-button,
  .text-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
