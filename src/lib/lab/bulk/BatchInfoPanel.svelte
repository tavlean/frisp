<script lang="ts">
  // One flat panel surface (design doc §2/§4) that folds the former BatchCard,
  // InfoPanel and custom-settings bar into a single frosted card — sections,
  // not stacked cards. Section headers borrow the production OptionsPanel
  // language: a small accent dash + quiet uppercase label. Meant to sit inside
  // an `aside.options`-style surface supplied by the parent layout.
  //
  // Round 2: IMAGE section on top, BATCH below it, and the card ENDS with a
  // footer styled after the production Results footer (Results.svelte) — batch
  // totals at the bottom-left, the coral "Save all · ZIP" button at the
  // bottom-right — so this panel and the production OptionsPanel visually rhyme.
  import { labBulk } from './store.svelte';
  import { inferAspect } from './aspect';

  interface Props {
    /** Selected source File (for name + format + size). */
    file: File | undefined;
    /** Natural pixel width, or 0 until the thumbnail decode lands. */
    width: number;
    /** Natural pixel height, or 0 until the thumbnail decode lands. */
    height: number;
    /** Show the "Global settings" link in the BATCH section. */
    showGlobal?: boolean;
    /** Swap the panel to the global OptionsPanel. */
    onGlobal?: () => void;
    /** Clear the selected image's overrides back to global. */
    onReset?: () => void;
  }

  let {
    file,
    width,
    height,
    showGlobal = false,
    onGlobal,
    onReset,
  }: Props = $props();

  const summary = $derived(labBulk.summary);
  const output = $derived(summary.output);
  const progress = $derived(summary.progress);
  const busy = $derived(progress.active + progress.queued > 0);
  const hasOverrides = $derived(labBulk.selectedHasOverrides);

  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
  // Decimal (SI, base-1000), 3 significant figures — matches Results.svelte so
  // sizes read identically across the app.
  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  // The footer's leading figure: value + unit split so the unit can echo the
  // production footer's smaller accented unit glyph.
  function prettyParts(bytes: number): { value: string; unit: string } {
    if (bytes < 1) return { value: '0', unit: 'B' };
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return {
      value: (bytes / 1000 ** exponent).toPrecision(3),
      unit: SIZE_UNITS[exponent],
    };
  }

  const outputParts = $derived(
    output.optimized > 0 ? prettyParts(output.totalOutputSize) : null,
  );

  const delta = $derived.by(() => {
    if (output.optimized === 0) return null;
    const rounded = Math.round(output.percentChange);
    if (rounded < 0) return { text: `▼${Math.abs(rounded)}%`, up: false };
    if (rounded > 0) return { text: `▲${rounded}%`, up: true };
    return { text: '0%', up: false };
  });

  /** A short, uppercase format label from the MIME type or extension. */
  function formatLabel(source: File): string {
    const fromMime = source.type.split('/')[1]?.toLowerCase() ?? '';
    const fromExt = source.name.includes('.')
      ? source.name.split('.').pop()!.toLowerCase()
      : '';
    const raw = fromMime || fromExt;
    const map: Record<string, string> = {
      jpeg: 'JPEG',
      jpg: 'JPEG',
      jfif: 'JPEG',
      png: 'PNG',
      webp: 'WebP',
      avif: 'AVIF',
      gif: 'GIF',
      'svg+xml': 'SVG',
      svg: 'SVG',
      jxl: 'JPEG XL',
      qoi: 'QOI',
      bmp: 'BMP',
      tiff: 'TIFF',
      tif: 'TIFF',
    };
    return map[raw] ?? (raw ? raw.toUpperCase() : 'Image');
  }

  const hasDims = $derived(width > 0 && height > 0);
  const aspect = $derived(hasDims ? inferAspect(width, height) : null);
</script>

<div class="batch-info">
  <div class="batch-info-scroll">
    <section class="section" aria-label="Image information">
      <h3 class="section-title">Image</h3>
      <div class="section-body">
        {#if file}
          <p class="filename" title={file.name}>{file.name}</p>
          <dl class="rows">
            <div class="row">
              <dt>Format</dt>
              <dd>{formatLabel(file)}</dd>
            </div>
            <div class="row">
              <dt>Dimensions</dt>
              <dd>{hasDims ? `${width} × ${height}` : '—'}</dd>
            </div>
            <div class="row">
              <dt>Original size</dt>
              <dd>{prettySize(file.size)}</dd>
            </div>
            <div class="row">
              <dt>Aspect</dt>
              <dd>
                {#if aspect}
                  <span class="chip" class:approx={aspect.approx}
                    >{aspect.label}</span
                  >
                {:else}
                  —
                {/if}
              </dd>
            </div>
          </dl>

          {#if hasOverrides}
            <div class="override-row">
              <span class="dot" aria-hidden="true">●</span>
              <strong>Custom settings</strong>
              <button type="button" onclick={() => onReset?.()}
                >Reset to global</button
              >
            </div>
          {/if}
        {:else}
          <p class="empty">No image selected.</p>
        {/if}
      </div>
    </section>

    <section class="section" aria-label="Batch">
      <h3 class="section-title">Batch</h3>
      <div class="section-body">
        <p class="count">
          <strong>{summary.totalJobs}</strong>
          {summary.totalJobs === 1 ? 'image' : 'images'}
        </p>

        {#if busy}
          <div class="progress" aria-label="Batch progress">
            <span class="spinner" aria-hidden="true"></span>
            <span>Encoding {progress.completed} of {progress.total}…</span>
          </div>
        {:else if progress.failed > 0}
          <p class="failed">{progress.failed} failed</p>
        {/if}

        {#if showGlobal}
          <button type="button" class="global-link" onclick={onGlobal}>
            Global settings
          </button>
        {/if}
      </div>
    </section>
  </div>

  <!-- Panel footer, styled after the production Results footer: batch totals
       at the left, the coral "Save all · ZIP" action at the right. -->
  <div class="panel-footer">
    <div class="stats">
      <div class="size-row">
        <span class="total-size">
          {#if outputParts}
            {outputParts.value}<span class="unit">{outputParts.unit}</span>
          {:else}
            <span class="pending">…</span>
          {/if}
        </span>
        {#if delta}
          <span class="delta" class:up={delta.up} class:down={!delta.up}>
            {delta.text}
          </span>
        {/if}
      </div>
      <span class="from-to">
        {prettySize(output.totalOriginalSize)}
        <span class="arrow" aria-hidden="true">→</span>
        {#if output.optimized > 0}
          {prettySize(output.totalOutputSize)}
        {:else}
          …
        {/if}
      </span>
    </div>

    <button
      type="button"
      class="save-all"
      onclick={() => labBulk.saveAllStub()}
    >
      Save all · ZIP
    </button>
  </div>
</div>

<style>
  .batch-info {
    display: flex;
    flex-direction: column;
    min-height: 0;
    color: var(--text-1, #f5f5f7);
  }

  /* The IMAGE + BATCH sections scroll together; the footer stays pinned. */
  .batch-info-scroll {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  /* Section header: quiet uppercase label with an accent dash, mirroring the
     production OptionsPanel `.options-title`. */
  .section-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 10px 16px 8px;
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
  }
  .section-title::before {
    content: '';
    flex: none;
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(
      90deg,
      var(--main-theme-color, #ff8a5e),
      var(--hot-theme-color, #ff5e8a)
    );
    box-shadow: 0 0 8px var(--main-theme-glow, transparent);
  }

  .section + .section .section-title {
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  }

  .section-body {
    display: grid;
    gap: 12px;
    padding: 2px 16px 14px;
  }

  .filename {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rows {
    display: grid;
    gap: 9px;
    margin: 0;
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  dt {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    color: var(--text-1, #f5f5f7);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .chip {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
  }
  .chip.approx {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
  }

  .empty {
    margin: 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.95rem;
  }

  /* Custom-settings affordance — closes out the IMAGE section. */
  .override-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 2px;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.92rem;
  }
  .override-row .dot {
    color: var(--accent-1, #ff8a5e);
  }
  .override-row strong {
    color: var(--text-1, #f5f5f7);
    font-weight: 700;
  }
  .override-row button {
    margin-left: auto;
    border: none;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .override-row button:hover {
    color: var(--text-1, #f5f5f7);
  }

  .count {
    margin: 0;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.95rem;
  }
  .count strong {
    color: var(--text-1, #f5f5f7);
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }

  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  .spinner {
    flex: none;
    width: 13px;
    height: 13px;
    border: 2px solid rgba(255, 255, 255, 0.22);
    border-top-color: var(--accent-1, #ff8a5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .failed {
    margin: 0;
    color: var(--bad, #ff7d92);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .global-link {
    justify-self: start;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .global-link:hover {
    color: var(--text-1, #f5f5f7);
  }

  /* Footer: mirrors Results.svelte — size stats at the left, action at the
     right, same paddings/radius rhythm as the production OptionsPanel footer
     (border-top + faint inset background). */
  .panel-footer {
    flex: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
    padding: 10px 16px 12px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    background: rgba(0, 0, 0, 0.18);
  }

  .stats {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .size-row {
    display: flex;
    align-items: baseline;
    gap: 7px;
    min-width: 0;
  }

  .total-size {
    font-size: 1.7rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
    color: var(--text-1, #f5f5f7);
    white-space: nowrap;
  }

  .unit {
    font-size: 1.1rem;
    font-weight: 600;
    margin-left: 2px;
    color: var(--main-theme-color, #ff8a5e);
  }

  .pending {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
  }

  .delta {
    align-self: center;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 1.05rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }
  .delta.down {
    color: var(--good, #3ddc97);
    background: color-mix(in srgb, var(--good, #3ddc97) 14%, transparent);
  }
  .delta.up {
    color: var(--warn, #ffb020);
    background: color-mix(in srgb, var(--warn, #ffb020) 14%, transparent);
  }

  .from-to {
    font-size: 0.95rem;
    font-weight: 500;
    letter-spacing: 0.02em;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .arrow {
    margin: 0 2px;
  }

  .save-all {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    height: 34px;
    padding: 0 16px;
    border: none;
    border-radius: 999px;
    font: inherit;
    font-weight: 700;
    font-size: 1.05rem;
    white-space: nowrap;
    cursor: pointer;
    background: linear-gradient(
      135deg,
      var(--main-theme-color, #ff8a5e),
      var(--hot-theme-color, #ff5e8a)
    );
    color: #16161c;
    box-shadow:
      0 4px 14px var(--main-theme-glow, rgba(255, 122, 80, 0.35)),
      inset 0 1px 0 rgba(255, 255, 255, 0.25);
    transition:
      transform 150ms ease,
      box-shadow 200ms ease,
      filter 200ms ease;
  }
  .save-all:hover {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }
  .save-all:active {
    transform: translateY(0);
  }
  .save-all:focus-visible {
    outline: 2px solid var(--main-theme-color, #ff8a5e);
    outline-offset: 2px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
