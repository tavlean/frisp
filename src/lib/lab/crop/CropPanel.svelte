<script lang="ts">
  // Porcelain right-panel UI for the lab crop tool — a Pixelmator-Pro-style
  // control stack (Constrain menu, W/H fields, transform buttons, Straighten
  // slider, Background fill, Overlay menu) plus a Reset / Cancel | Apply footer.
  // It is a THIN view over a shared `CropTool` runes instance: it never talks to
  // the stage directly — every action calls a `tool` method or sets a `tool`
  // field, and every readout reflects a `tool` `$state`/`$derived`. Styling is
  // pure porcelain (--pc-* tokens); no studio-dark colors, correct in light and
  // dark. Contract: docs/specs/2026-07-07-porcelain-crop-tool.md ("Panel").
  import { CropTool } from './crop-tool.svelte';
  import type { OverlayKind, OverlayShowMode } from './crop-types';
  import { lightDismiss } from '$lib/editor/light-dismiss';

  interface Props {
    tool: CropTool;
    onapply: () => void;
    oncancel: () => void;
  }

  let { tool, onapply, oncancel }: Props = $props();

  // ── Constrain presets (Pixelmator's list) ──────────────────────────────────
  interface RatioPreset {
    label: string;
    rw: number;
    rh: number;
  }
  const RATIO_PRESETS: RatioPreset[] = [
    { label: '16:9', rw: 16, rh: 9 },
    { label: '5:3', rw: 5, rh: 3 },
    { label: '3:2', rw: 3, rh: 2 },
    { label: '7:5', rw: 7, rh: 5 },
    { label: '4:3', rw: 4, rh: 3 },
    { label: '5:4', rw: 5, rh: 4 },
    { label: 'Square', rw: 1, rh: 1 },
    { label: '4:5', rw: 4, rh: 5 },
    { label: '3:4', rw: 3, rh: 4 },
    { label: '5:7', rw: 5, rh: 7 },
    { label: '2:3', rw: 2, rh: 3 },
    { label: '3:5', rw: 3, rh: 5 },
    { label: '9:16', rw: 9, rh: 16 },
  ];

  interface SizePreset {
    label: string;
    w: number;
    h: number;
  }
  const SIZE_PRESETS: SizePreset[] = [
    { label: '1920 × 1080 px', w: 1920, h: 1080 },
    { label: '1024 × 768 px', w: 1024, h: 768 },
  ];

  // ── Constrain dropdown ──────────────────────────────────────────────────────
  let constrainOpen = $state(false);
  let constrainTrigger = $state<HTMLButtonElement>();
  const constrainDismiss = lightDismiss({
    isOpen: () => constrainOpen,
    close: () => (constrainOpen = false),
    focusOnEscape: () => constrainTrigger,
  });

  const constrainLabel = $derived.by(() => {
    const c = tool.constrain;
    if (c.kind === 'original') return 'Original';
    if (c.kind === 'ratio') {
      if (c.custom) return 'Custom Aspect Ratio';
      const p = RATIO_PRESETS.find((r) => r.rw === c.rw && r.rh === c.rh);
      return p ? p.label : `${c.rw}:${c.rh}`;
    }
    const s = SIZE_PRESETS.find(
      (sp) => sp.w === tool.outputWidth && sp.h === tool.outputHeight,
    );
    return s ? s.label : 'Custom Size';
  });

  const isFreeCustomSize = $derived(
    tool.constrain.kind === 'free' &&
      !SIZE_PRESETS.some(
        (s) => s.w === tool.outputWidth && s.h === tool.outputHeight,
      ),
  );
  const isOriginalActive = $derived(tool.constrain.kind === 'original');
  const isCustomRatioActive = $derived(
    tool.constrain.kind === 'ratio' && tool.constrain.custom === true,
  );
  const customRatio = $derived.by(() => {
    const c = tool.constrain;
    return c.kind === 'ratio' && c.custom ? { rw: c.rw, rh: c.rh } : null;
  });

  function ratioActive(r: RatioPreset): boolean {
    const c = tool.constrain;
    return c.kind === 'ratio' && !c.custom && c.rw === r.rw && c.rh === r.rh;
  }
  function sizeActive(s: SizePreset): boolean {
    return (
      tool.constrain.kind === 'free' &&
      tool.outputWidth === s.w &&
      tool.outputHeight === s.h
    );
  }

  function closeConstrain() {
    constrainOpen = false;
    constrainTrigger?.focus();
  }
  function chooseCustomSize() {
    tool.setConstrain({ kind: 'free' });
    closeConstrain();
  }
  function chooseOriginal() {
    tool.setConstrain({ kind: 'original' });
    closeConstrain();
  }
  function chooseRatio(r: RatioPreset) {
    tool.setConstrain({ kind: 'ratio', rw: r.rw, rh: r.rh });
    closeConstrain();
  }
  function chooseSize(s: SizePreset) {
    tool.setExactSize(s.w, s.h);
    closeConstrain();
  }
  function chooseCustomRatio() {
    const [rw, rh] = reduceRatio(tool.outputWidth, tool.outputHeight);
    tool.setConstrain({ kind: 'ratio', rw, rh, custom: true });
    closeConstrain();
  }

  // Reduce the current output dims to a small seed ratio for "Custom Aspect
  // Ratio": exact gcd reduction when tidy, else a best rational approximation
  // with a bounded denominator so the two fields stay small and editable.
  function gcd(a: number, b: number): number {
    a = Math.abs(a);
    b = Math.abs(b);
    while (b) {
      [a, b] = [b, a % b];
    }
    return a || 1;
  }
  function approxRatio(x: number, maxDen = 40): [number, number] {
    let ln = 0,
      ld = 1,
      un = 1,
      ud = 0;
    let bn = Math.max(1, Math.round(x)),
      bd = 1;
    for (let i = 0; i < 100; i++) {
      const mn = ln + un;
      const md = ld + ud;
      if (md > maxDen) break;
      bn = mn;
      bd = md;
      const mv = mn / md;
      if (Math.abs(mv - x) < 1e-9) break;
      if (mv < x) {
        ln = mn;
        ld = md;
      } else {
        un = mn;
        ud = md;
      }
    }
    return [bn, bd];
  }
  function reduceRatio(w: number, h: number): [number, number] {
    const iw = Math.max(1, Math.round(w));
    const ih = Math.max(1, Math.round(h));
    const g = gcd(iw, ih);
    const rw = iw / g;
    const rh = ih / g;
    if (rw <= 99 && rh <= 99) return [rw, rh];
    return approxRatio(iw / ih);
  }

  // Custom-aspect-ratio inline fields (draft state so typing isn't clobbered).
  let rwFocused = $state(false);
  let rwDraft = $state('');
  let rhFocused = $state(false);
  let rhDraft = $state('');

  function commitRw() {
    rwFocused = false;
    const c = customRatio;
    const n = Math.round(Number(rwDraft));
    if (c && Number.isFinite(n) && n >= 1)
      tool.setConstrain({ kind: 'ratio', rw: n, rh: c.rh, custom: true });
  }
  function commitRh() {
    rhFocused = false;
    const c = customRatio;
    const n = Math.round(Number(rhDraft));
    if (c && Number.isFinite(n) && n >= 1)
      tool.setConstrain({ kind: 'ratio', rw: c.rw, rh: n, custom: true });
  }
  function swapRatio() {
    const c = customRatio;
    if (c)
      tool.setConstrain({ kind: 'ratio', rw: c.rh, rh: c.rw, custom: true });
  }

  // ── W / H fields (draft state; commit on change / Enter / blur) ─────────────
  let wFocused = $state(false);
  let wDraft = $state('');
  let hFocused = $state(false);
  let hDraft = $state('');

  function commitW() {
    wFocused = false;
    const n = Math.round(Number(wDraft));
    if (Number.isFinite(n) && n >= 1) tool.setWidth(n);
  }
  function commitH() {
    hFocused = false;
    const n = Math.round(Number(hDraft));
    if (Number.isFinite(n) && n >= 1) tool.setHeight(n);
  }
  function blurOnEnter(event: KeyboardEvent) {
    if (event.key === 'Enter') (event.currentTarget as HTMLInputElement).blur();
  }

  // ── Straighten ──────────────────────────────────────────────────────────────
  function onStraighten(event: Event) {
    const v = Number((event.currentTarget as HTMLInputElement).value);
    tool.setStraighten(v);
    tool.notifyAdjust();
  }
  function resetStraighten() {
    if (tool.state.angleDeg !== 0) {
      tool.setStraighten(0);
      tool.notifyAdjust();
    }
  }
  const angleLabel = $derived.by(() => {
    const d = tool.state.angleDeg;
    if (d === 0) return '0°';
    const sign = d < 0 ? '−' : '';
    const abs = Math.abs(d).toFixed(1).replace(/\.0$/, '');
    return `${sign}${abs}°`;
  });

  // ── Background ───────────────────────────────────────────────────────────────
  interface FixedSwatch {
    key: string;
    label: string;
    css: string;
  }
  const FIXED_SWATCHES: FixedSwatch[] = [
    { key: 'white', label: 'White', css: '#ffffff' },
    { key: 'gray', label: 'Gray', css: '#808080' },
    { key: 'black', label: 'Black', css: '#000000' },
  ];
  function normHex(css: string): string {
    return css.trim().toLowerCase();
  }
  const bgTransparent = $derived(tool.background.kind === 'transparent');
  function swatchActive(css: string): boolean {
    const b = tool.background;
    return b.kind === 'color' && normHex(b.css) === normHex(css);
  }
  const customBgColor = $derived.by(() => {
    const b = tool.background;
    if (b.kind !== 'color') return null;
    const c = normHex(b.css);
    if (FIXED_SWATCHES.some((f) => normHex(f.css) === c)) return null;
    return b.css;
  });
  const customBgActive = $derived(customBgColor !== null);

  function setTransparent() {
    tool.background = { kind: 'transparent' };
  }
  function setColor(css: string) {
    tool.background = { kind: 'color', css };
  }
  function onCustomColor(event: Event) {
    setColor((event.currentTarget as HTMLInputElement).value);
  }
  function toggleSample() {
    tool.sampling = !tool.sampling;
  }

  // ── Overlay dropdown ─────────────────────────────────────────────────────────
  const OVERLAYS: { id: OverlayKind; label: string }[] = [
    { id: 'thirds', label: 'Rule of Thirds' },
    { id: 'grid', label: 'Grid' },
    { id: 'diagonal', label: 'Diagonal' },
    { id: 'triangle', label: 'Triangle' },
    { id: 'goldenRatio', label: 'Golden Ratio' },
    { id: 'goldenSpiral', label: 'Golden Spiral' },
    { id: 'center', label: 'Center' },
  ];
  const OVERLAY_MODES: { id: OverlayShowMode; label: string }[] = [
    { id: 'auto', label: 'Auto Show Overlay' },
    { id: 'always', label: 'Always Show Overlay' },
    { id: 'never', label: 'Never Show Overlay' },
  ];

  let overlayOpen = $state(false);
  let overlayTrigger = $state<HTMLButtonElement>();
  const overlayDismiss = lightDismiss({
    isOpen: () => overlayOpen,
    close: () => (overlayOpen = false),
    focusOnEscape: () => overlayTrigger,
  });

  const overlayLabel = $derived(
    OVERLAYS.find((o) => o.id === tool.overlay)?.label ?? 'Overlay',
  );
  function chooseOverlay(id: OverlayKind) {
    tool.overlay = id;
    overlayOpen = false;
    overlayTrigger?.focus();
  }
  function chooseOverlayMode(id: OverlayShowMode) {
    tool.overlayMode = id;
  }
</script>

{#snippet check(active: boolean)}
  {#if active}
    <svg class="check" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12.5l4.2 4.2L19 7"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  {/if}
{/snippet}

<div class="crop-panel">
  <header class="head">
    <h2 class="title">Crop</h2>
  </header>

  <div class="body">
    <!-- 1 · Constrain ───────────────────────────────────────────────────── -->
    <section class="sec">
      <div class="dropdown" {@attach constrainDismiss}>
        <button
          type="button"
          class="trigger"
          bind:this={constrainTrigger}
          onclick={() => (constrainOpen = !constrainOpen)}
          aria-haspopup="listbox"
          aria-expanded={constrainOpen}
        >
          <svg class="lead" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7 3v14a1 1 0 0 0 1 1h14M3 7h14a1 1 0 0 1 1 1v14"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <span class="trigger-label">{constrainLabel}</span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        {#if constrainOpen}
          <div class="popover" role="listbox" aria-label="Constrain crop">
            <button
              type="button"
              role="option"
              class="option"
              class:selected={isFreeCustomSize}
              aria-selected={isFreeCustomSize}
              onclick={chooseCustomSize}
            >
              <span class="opt-label">Custom Size</span>
              {@render check(isFreeCustomSize)}
            </button>
            <button
              type="button"
              role="option"
              class="option"
              class:selected={isCustomRatioActive}
              aria-selected={isCustomRatioActive}
              onclick={chooseCustomRatio}
            >
              <span class="opt-label">Custom Aspect Ratio</span>
              {@render check(isCustomRatioActive)}
            </button>

            <p class="cap">Aspect ratio presets</p>
            <button
              type="button"
              role="option"
              class="option"
              class:selected={isOriginalActive}
              aria-selected={isOriginalActive}
              onclick={chooseOriginal}
            >
              <span class="opt-label">Original</span>
              {@render check(isOriginalActive)}
            </button>
            {#each RATIO_PRESETS as r (r.label)}
              <button
                type="button"
                role="option"
                class="option"
                class:selected={ratioActive(r)}
                aria-selected={ratioActive(r)}
                onclick={() => chooseRatio(r)}
              >
                <span class="opt-label">{r.label}</span>
                {@render check(ratioActive(r))}
              </button>
            {/each}

            <p class="cap">Size presets</p>
            {#each SIZE_PRESETS as s (s.label)}
              <button
                type="button"
                role="option"
                class="option"
                class:selected={sizeActive(s)}
                aria-selected={sizeActive(s)}
                onclick={() => chooseSize(s)}
              >
                <span class="opt-label">{s.label}</span>
                {@render check(sizeActive(s))}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      {#if isCustomRatioActive && customRatio}
        <div class="ratio-row">
          <input
            class="ratio-input"
            type="number"
            inputmode="numeric"
            min="1"
            aria-label="Aspect ratio width"
            value={rwFocused ? rwDraft : String(customRatio.rw)}
            onfocus={() => {
              rwFocused = true;
              rwDraft = String(customRatio?.rw ?? '');
            }}
            oninput={(e) => (rwDraft = e.currentTarget.value)}
            onblur={commitRw}
            onkeydown={blurOnEnter}
          />
          <button
            type="button"
            class="swap"
            aria-label="Swap width and height"
            onclick={swapRatio}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M4 8h13m0 0l-3.5-3.5M17 8l-3.5 3.5M20 16H7m0 0l3.5-3.5M7 16l3.5 3.5"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <input
            class="ratio-input"
            type="number"
            inputmode="numeric"
            min="1"
            aria-label="Aspect ratio height"
            value={rhFocused ? rhDraft : String(customRatio.rh)}
            onfocus={() => {
              rhFocused = true;
              rhDraft = String(customRatio?.rh ?? '');
            }}
            oninput={(e) => (rhDraft = e.currentTarget.value)}
            onblur={commitRh}
            onkeydown={blurOnEnter}
          />
        </div>
      {/if}
    </section>

    <!-- 2 · W / H fields ────────────────────────────────────────────────── -->
    <section class="sec">
      <div class="wh-row">
        <div class="field">
          <span class="field-key">W</span>
          <input
            class="field-input"
            type="number"
            inputmode="numeric"
            min="1"
            aria-label="Crop width in pixels"
            value={wFocused ? wDraft : String(tool.outputWidth)}
            onfocus={() => {
              wFocused = true;
              wDraft = String(tool.outputWidth);
            }}
            oninput={(e) => (wDraft = e.currentTarget.value)}
            onblur={commitW}
            onkeydown={blurOnEnter}
          />
          <span class="field-unit">px</span>
        </div>
        <div class="field">
          <span class="field-key">H</span>
          <input
            class="field-input"
            type="number"
            inputmode="numeric"
            min="1"
            aria-label="Crop height in pixels"
            value={hFocused ? hDraft : String(tool.outputHeight)}
            onfocus={() => {
              hFocused = true;
              hDraft = String(tool.outputHeight);
            }}
            oninput={(e) => (hDraft = e.currentTarget.value)}
            onblur={commitH}
            onkeydown={blurOnEnter}
          />
          <span class="field-unit">px</span>
        </div>
      </div>
    </section>

    <!-- 3 · Transform buttons ───────────────────────────────────────────── -->
    <section class="sec">
      <div class="transform-row">
        <div class="tip-wrap">
          <button
            type="button"
            class="icon-btn"
            aria-label="Rotate left"
            onclick={() => tool.rotate90(-1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline
                points="4 5 4 10 9 10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M5.6 10a8 8 0 1 1-1.6 6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <span class="tooltip" role="tooltip">
            <span class="tip-label">Rotate left</span>
          </span>
        </div>

        <div class="tip-wrap">
          <button
            type="button"
            class="icon-btn"
            aria-label="Rotate right"
            onclick={() => tool.rotate90(1)}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <polyline
                points="20 5 20 10 15 10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <path
                d="M18.4 10a8 8 0 1 0 1.6 6"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <span class="tooltip" role="tooltip">
            <span class="tip-label">Rotate right</span>
          </span>
        </div>

        <div class="tip-wrap">
          <button
            type="button"
            class="icon-btn"
            aria-label="Flip horizontal"
            onclick={() => tool.flipHorizontal()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <line
                x1="12"
                y1="3.5"
                x2="12"
                y2="20.5"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-dasharray="0.5 3"
              />
              <path
                d="M9.5 8 5 12l4.5 4z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="M14.5 8 19 12l-4.5 4z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <span class="tooltip" role="tooltip">
            <span class="tip-label">Flip horizontal</span>
          </span>
        </div>

        <div class="tip-wrap">
          <button
            type="button"
            class="icon-btn"
            aria-label="Flip vertical"
            onclick={() => tool.flipVertical()}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <line
                x1="3.5"
                y1="12"
                x2="20.5"
                y2="12"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-dasharray="0.5 3"
              />
              <path
                d="M8 9.5 12 5l4 4.5z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="M8 14.5 12 19l4-4.5z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <span class="tooltip" role="tooltip">
            <span class="tip-label">Flip vertical</span>
          </span>
        </div>
      </div>
    </section>

    <!-- 4 · Straighten ──────────────────────────────────────────────────── -->
    <section class="sec">
      <div class="label-row">
        <span class="label">Straighten</span>
        <button
          type="button"
          class="angle-readout"
          disabled={tool.state.angleDeg === 0}
          aria-label="Reset straighten angle"
          onclick={resetStraighten}
        >
          {angleLabel}
        </button>
      </div>
      <div class="range-wrap">
        <span class="range-tick" aria-hidden="true"></span>
        <input
          class="straighten"
          type="range"
          min="-45"
          max="45"
          step="0.5"
          aria-label="Straighten angle"
          value={tool.state.angleDeg}
          oninput={onStraighten}
        />
      </div>
    </section>

    <div class="divider" aria-hidden="true"></div>

    <!-- 5 · Background ──────────────────────────────────────────────────── -->
    <section class="sec">
      <span class="label">Empty area</span>
      <div class="swatch-row">
        <button
          type="button"
          class="swatch checker"
          class:selected={bgTransparent}
          aria-pressed={bgTransparent}
          aria-label="Transparent"
          title="Transparent"
          onclick={setTransparent}
        ></button>

        {#each FIXED_SWATCHES as sw (sw.key)}
          <button
            type="button"
            class="swatch"
            class:selected={swatchActive(sw.css)}
            style:background={sw.css}
            aria-pressed={swatchActive(sw.css)}
            aria-label={sw.label}
            title={sw.label}
            onclick={() => setColor(sw.css)}
          ></button>
        {/each}

        <label
          class="swatch custom"
          class:selected={customBgActive}
          style:background={customBgColor ?? undefined}
          title="Custom color"
        >
          <span class="visually-hidden">Custom color</span>
          <input
            class="color-input"
            type="color"
            value={customBgColor ?? '#3b82f6'}
            oninput={onCustomColor}
          />
        </label>

        <div class="tip-wrap">
          <button
            type="button"
            class="sample-btn"
            class:active={tool.sampling}
            aria-pressed={tool.sampling}
            aria-label="Sample color from image"
            onclick={toggleSample}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M17 4l3 3-1.6 1.6-3-3L17 4z"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linejoin="round"
              />
              <path
                d="M15.4 6.6 6 16l-.7 3.2 3.2-.7 9.4-9.4"
                fill="none"
                stroke="currentColor"
                stroke-width="1.6"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </button>
          <span class="tooltip" role="tooltip">
            <span class="tip-label">Sample from image</span>
          </span>
        </div>
      </div>
      <p class="caption">
        Fills the area outside the image. Formats without transparency flatten
        it.
      </p>
    </section>

    <div class="divider" aria-hidden="true"></div>

    <!-- 6 · Overlay ─────────────────────────────────────────────────────── -->
    <section class="sec">
      <div class="dropdown" {@attach overlayDismiss}>
        <button
          type="button"
          class="trigger"
          bind:this={overlayTrigger}
          onclick={() => (overlayOpen = !overlayOpen)}
          aria-haspopup="listbox"
          aria-expanded={overlayOpen}
        >
          <svg class="lead" viewBox="0 0 24 24" aria-hidden="true">
            <rect
              x="4"
              y="4"
              width="16"
              height="16"
              rx="2"
              fill="none"
              stroke="currentColor"
              stroke-width="1.6"
            />
            <path
              d="M4 9.3h16M4 14.7h16M9.3 4v16M14.7 4v16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
          </svg>
          <span class="trigger-label">{overlayLabel}</span>
          <svg class="chev" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6 9l6 6 6-6"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>

        {#if overlayOpen}
          <div class="popover" role="listbox" aria-label="Overlay guide">
            {#each OVERLAYS as o (o.id)}
              <button
                type="button"
                role="option"
                class="option"
                class:selected={tool.overlay === o.id}
                aria-selected={tool.overlay === o.id}
                onclick={() => chooseOverlay(o.id)}
              >
                <span class="opt-label">{o.label}</span>
                {@render check(tool.overlay === o.id)}
              </button>
            {/each}

            <span class="menu-sep" aria-hidden="true"></span>
            {#each OVERLAY_MODES as m (m.id)}
              <button
                type="button"
                role="option"
                class="option"
                class:selected={tool.overlayMode === m.id}
                aria-selected={tool.overlayMode === m.id}
                onclick={() => chooseOverlayMode(m.id)}
              >
                <span class="opt-label">{m.label}</span>
                {@render check(tool.overlayMode === m.id)}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </section>
  </div>

  <!-- Footer ──────────────────────────────────────────────────────────────── -->
  <div class="footer">
    <button
      type="button"
      class="btn-reset"
      disabled={tool.isDefault}
      onclick={() => tool.reset()}
    >
      Reset
    </button>
    <div class="footer-row">
      <button type="button" class="btn-cancel" onclick={oncancel}>Cancel</button
      >
      <button type="button" class="btn-apply" onclick={onapply}>Apply</button>
    </div>
  </div>
</div>

<style>
  .crop-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .head {
    flex: none;
    padding: 13px var(--horizontal-padding) 8px;
  }
  .title {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--pc-text-1);
  }

  /* ── Scrollable body ────────────────────────────────────────────────────── */
  .body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 4px 0 12px;
  }
  .sec {
    padding: 0 var(--horizontal-padding);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .divider {
    height: 1px;
    background: var(--pc-border);
  }

  .label {
    font-size: 13px;
    font-weight: 600;
    color: var(--pc-text-1);
  }
  .label-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
  }
  .caption {
    margin: 0;
    font-size: 12px;
    line-height: 1.35;
    color: var(--pc-text-3);
  }

  /* ── Dropdown (Constrain / Overlay) — FormatDropdown pattern ────────────── */
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
    flex: none;
    width: 20px;
    height: 20px;
    color: var(--pc-text-2);
  }
  .trigger-label {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .chev {
    flex: none;
    width: 18px;
    height: 18px;
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
    max-height: min(360px, 55vh);
    overflow-y: auto;
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
  .cap {
    margin: 6px 0 1px;
    padding: 0 10px;
    font-size: 11px;
    font-weight: 600;
    color: var(--pc-text-3);
  }
  .menu-sep {
    height: 1px;
    margin: 5px 6px;
    background: var(--pc-border);
  }
  .option {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    height: 36px;
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
  .check {
    flex: none;
    width: 16px;
    height: 16px;
    color: var(--pc-text-1);
  }

  /* ── Custom aspect-ratio inline row ─────────────────────────────────────── */
  .ratio-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ratio-input {
    flex: 1;
    min-width: 0;
    height: 36px;
    padding: 0 10px;
    border: 1px solid var(--pc-border);
    border-radius: 9px;
    background: var(--pc-inset);
    color: var(--pc-text-1);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: center;
    -moz-appearance: textfield;
    appearance: textfield;
    transition: border-color 130ms ease;
  }
  @supports (corner-shape: squircle) {
    .ratio-input {
      corner-shape: squircle;
      border-radius: 11px;
    }
  }
  .ratio-input::-webkit-outer-spin-button,
  .ratio-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .ratio-input:focus {
    outline: none;
    border-color: var(--pc-focus);
  }
  .ratio-input:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 1px;
  }
  .swap {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border: 1px solid var(--pc-border);
    border-radius: 9px;
    background: var(--pc-raise);
    color: var(--pc-text-2);
    cursor: pointer;
    box-shadow: var(--pc-shadow-control);
    transition:
      background-color 130ms ease,
      color 130ms ease;
  }
  @supports (corner-shape: squircle) {
    .swap {
      corner-shape: squircle;
      border-radius: 11px;
    }
  }
  .swap svg {
    width: 18px;
    height: 18px;
  }
  .swap:hover {
    background: var(--pc-inset);
    color: var(--pc-text-1);
  }
  .swap:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* ── W / H fields ───────────────────────────────────────────────────────── */
  .wh-row {
    display: flex;
    gap: 8px;
  }
  .field {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 40px;
    padding: 0 10px;
    background: var(--pc-inset);
    border: 1px solid var(--pc-border);
    border-radius: 10px;
    transition: border-color 130ms ease;
  }
  @supports (corner-shape: squircle) {
    .field {
      corner-shape: squircle;
      border-radius: 12px;
    }
  }
  .field:focus-within {
    border-color: var(--pc-focus);
  }
  .field-key {
    flex: none;
    font-size: 12px;
    font-weight: 600;
    color: var(--pc-text-3);
  }
  .field-input {
    flex: 1;
    min-width: 0;
    width: 100%;
    border: none;
    background: transparent;
    color: var(--pc-text-1);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    text-align: right;
    outline: none;
    -moz-appearance: textfield;
    appearance: textfield;
    font-variant-numeric: tabular-nums;
  }
  .field-input::-webkit-outer-spin-button,
  .field-input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .field-unit {
    flex: none;
    font-size: 12px;
    color: var(--pc-text-3);
  }

  /* ── Transform buttons ──────────────────────────────────────────────────── */
  .transform-row {
    display: flex;
    gap: 6px;
  }
  .transform-row .tip-wrap {
    flex: 1;
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 38px;
    border: 1px solid var(--pc-border);
    border-radius: 10px;
    background: var(--pc-raise);
    color: var(--pc-text-1);
    cursor: pointer;
    padding: 0;
    box-shadow: var(--pc-shadow-control);
    transition:
      background-color 140ms ease,
      border-color 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .icon-btn {
      corner-shape: squircle;
      border-radius: 12px;
    }
  }
  .icon-btn svg {
    width: 20px;
    height: 20px;
  }
  .icon-btn:hover {
    background: var(--pc-inset);
    border-color: var(--pc-border-strong);
  }
  .icon-btn:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* ── Straighten readout + range ─────────────────────────────────────────── */
  .angle-readout {
    border: none;
    background: transparent;
    padding: 2px 4px;
    margin: -2px -4px;
    border-radius: 6px;
    color: var(--pc-text-2);
    font: inherit;
    font-size: 13px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    transition:
      background-color 130ms ease,
      color 130ms ease;
  }
  .angle-readout:hover:not(:disabled) {
    background: var(--pc-inset);
    color: var(--pc-text-1);
  }
  .angle-readout:disabled {
    cursor: default;
  }
  .angle-readout:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 1px;
  }

  .range-wrap {
    position: relative;
    display: flex;
    align-items: center;
    height: 24px;
  }
  .range-tick {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 12px;
    border-radius: 1px;
    background: var(--pc-border-strong);
    pointer-events: none;
  }
  .straighten {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 24px;
    margin: 0;
    background: transparent;
    cursor: pointer;
  }
  .straighten::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: var(--pc-inset);
    box-shadow: var(--pc-inset-shadow);
  }
  .straighten::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--pc-inset);
    box-shadow: var(--pc-inset-shadow);
  }
  .straighten::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 16px;
    height: 16px;
    margin-top: -6px;
    border-radius: 50%;
    background: #ffffff;
    border: 1px solid var(--pc-border-strong);
    box-shadow: var(--pc-shadow-control);
  }
  .straighten::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: #ffffff;
    border: 1px solid var(--pc-border-strong);
    box-shadow: var(--pc-shadow-control);
  }
  .straighten:focus-visible {
    outline: none;
  }
  .straighten:focus-visible::-webkit-slider-thumb {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }
  .straighten:focus-visible::-moz-range-thumb {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* ── Background swatches ────────────────────────────────────────────────── */
  .swatch-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .swatch {
    position: relative;
    flex: none;
    width: 24px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--pc-border-strong);
    border-radius: 50%;
    cursor: pointer;
    transition: box-shadow 130ms ease;
  }
  .swatch.selected {
    box-shadow:
      0 0 0 2px var(--pc-panel),
      0 0 0 4px var(--pc-focus);
  }
  .swatch:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }
  .checker {
    background-color: #ffffff;
    background-image:
      linear-gradient(45deg, #bcbcc0 25%, transparent 25%),
      linear-gradient(-45deg, #bcbcc0 25%, transparent 25%),
      linear-gradient(45deg, transparent 75%, #bcbcc0 75%),
      linear-gradient(-45deg, transparent 75%, #bcbcc0 75%);
    background-size: 12px 12px;
    background-position:
      0 0,
      0 6px,
      6px -6px,
      -6px 0;
  }
  .custom {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: conic-gradient(
      from 90deg,
      #ff5757,
      #ffd166,
      #4ade80,
      #38bdf8,
      #a78bfa,
      #ff5757
    );
  }
  .custom:focus-within {
    box-shadow:
      0 0 0 2px var(--pc-panel),
      0 0 0 4px var(--pc-focus);
  }
  .color-input {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    opacity: 0;
    cursor: pointer;
  }
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .sample-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 24px;
    padding: 0;
    border: 1px solid var(--pc-border);
    border-radius: 8px;
    background: var(--pc-raise);
    color: var(--pc-text-2);
    cursor: pointer;
    box-shadow: var(--pc-shadow-control);
    transition:
      background-color 130ms ease,
      color 130ms ease;
  }
  @supports (corner-shape: squircle) {
    .sample-btn {
      corner-shape: squircle;
      border-radius: 10px;
    }
  }
  .sample-btn svg {
    width: 17px;
    height: 17px;
  }
  .sample-btn:hover {
    background: var(--pc-inset);
    color: var(--pc-text-1);
  }
  .sample-btn.active {
    background: light-dark(#1b1b1f, #f5f5f7);
    color: light-dark(#ffffff, #16161c);
    border-color: transparent;
  }
  .sample-btn:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* ── Tooltip (TopBar pattern, label only) ───────────────────────────────── */
  .tip-wrap {
    position: relative;
    display: inline-flex;
  }
  .tooltip {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%) translateY(-4px);
    z-index: 40;
    display: flex;
    align-items: center;
    padding: 5px 9px;
    border-radius: 8px;
    background: var(--pc-tooltip-bg);
    color: var(--pc-tooltip-text);
    font-size: 12px;
    white-space: nowrap;
    opacity: 0;
    pointer-events: none;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
    transition:
      opacity 130ms ease,
      transform 130ms ease;
  }
  .tip-wrap:hover .tooltip,
  .icon-btn:focus-visible + .tooltip,
  .sample-btn:focus-visible + .tooltip {
    opacity: 1;
    transform: translateX(-50%) translateY(0);
  }

  /* ── Footer ─────────────────────────────────────────────────────────────── */
  .footer {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px var(--horizontal-padding);
    border-top: 1px solid var(--pc-border);
  }
  .footer-row {
    display: flex;
    gap: 8px;
  }
  .btn-reset,
  .btn-cancel,
  .btn-apply {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 40px;
    border-radius: 11px;
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 140ms ease,
      border-color 140ms ease,
      opacity 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .btn-reset,
    .btn-cancel,
    .btn-apply {
      corner-shape: squircle;
      border-radius: 13px;
    }
  }
  .btn-reset {
    width: 100%;
    border: 1px solid var(--pc-border);
    background: var(--pc-raise);
    color: var(--pc-text-1);
    box-shadow: var(--pc-shadow-control);
  }
  .btn-reset:hover:not(:disabled) {
    background: var(--pc-inset);
  }
  .btn-reset:disabled {
    opacity: 0.4;
    cursor: default;
    box-shadow: none;
  }
  .btn-cancel {
    flex: 1;
    border: 1px solid var(--pc-border);
    background: var(--pc-raise);
    color: var(--pc-text-1);
    box-shadow: var(--pc-shadow-control);
  }
  .btn-cancel:hover {
    background: var(--pc-inset);
  }
  .btn-apply {
    flex: 1;
    border: 1px solid transparent;
    background: light-dark(#1b1b1f, #f5f5f7);
    color: light-dark(#ffffff, #16161c);
    box-shadow: var(--pc-shadow-control);
  }
  .btn-apply:hover {
    background: light-dark(#000000, #ffffff);
  }
  .btn-reset:focus-visible,
  .btn-cancel:focus-visible,
  .btn-apply:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .trigger,
    .option,
    .field,
    .ratio-input,
    .swap,
    .icon-btn,
    .angle-readout,
    .swatch,
    .sample-btn,
    .tooltip,
    .btn-reset,
    .btn-cancel,
    .btn-apply {
      transition-duration: 0ms;
    }
  }
</style>
