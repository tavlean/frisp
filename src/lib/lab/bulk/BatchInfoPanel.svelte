<script lang="ts">
  // The left-panel surface for the bulk lab. It has two faces driven by
  // SELECTION (not the right-panel scope tab):
  //
  //  • IMAGE face (an image is selected): the panel TITLE is the filename (in
  //    azure, the single-image scope hue), then the info rows (Format /
  //    Dimensions / Original size / Aspect chip), then the ● custom-settings +
  //    "Reset to global" row when the job deviates.
  //  • GLOBAL face (nothing selected): the title is the image COUNT, then real
  //    batch facts (format breakdown / total size / largest file computed from
  //    the actual source files), then a quiet fine-tune hint.
  //
  // A footer is ALWAYS present (both faces) and is the SINGLE home of the batch
  // result, styled after the production Results footer (Results.svelte): the big
  // batch output total + delta pill, a secondary transform line ("10.5 MB →
  // 301 kB" — the count is NOT repeated here, the global title carries it), and
  // the coral "Save all · ZIP" action. On the IMAGE face a tiny "ALL IMAGES"
  // whisper-caption tops the footer so the info-for-one / action-for-all seam
  // reads intentionally.
  import { labBulk } from './store.svelte';
  import { inferAspect } from './aspect';
  import DeltaPill from './DeltaPill.svelte';

  interface Props {
    /** Selected source File (for name + format + size). Undefined = global. */
    file: File | undefined;
    /** Natural pixel width, or 0 until the thumbnail decode lands. */
    width: number;
    /** Natural pixel height, or 0 until the thumbnail decode lands. */
    height: number;
    /** Clear the selected image's overrides back to global. */
    onReset?: () => void;
  }

  let { file, width, height, onReset }: Props = $props();

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

  const showDelta = $derived(output.optimized > 0);

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

  // ── Global-face batch facts (computed from the actual source files) ────────
  const jobs = $derived(labBulk.session.jobs);

  /** "8 JPEG · 4 PNG" — counts by short format label, most common first. */
  const formatBreakdown = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      const label = formatLabel(job.sourceFile);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([label, count]) => `${count} ${label}`)
      .join(' · ');
  });

  /** The heaviest source file — the one most worth a second look. */
  const largest = $derived.by(() => {
    let top: File | undefined;
    for (const job of jobs) {
      if (!top || job.sourceFile.size > top.size) top = job.sourceFile;
    }
    return top;
  });
</script>

<div class="batch-info">
  <div class="batch-info-scroll">
    {#if file}
      <!-- IMAGE face: filename is the title, then the info rows. -->
      <div class="head">
        <p class="title filename" title={file.name}>{file.name}</p>
      </div>
      <div class="body">
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
      </div>
    {:else}
      <!-- GLOBAL face: the count is the title, then batch facts, then a hint. -->
      <div class="head global-head">
        <p class="title count">
          {summary.totalJobs}
          {summary.totalJobs === 1 ? 'image' : 'images'}
        </p>
      </div>
      <div class="body">
        <dl class="rows">
          {#if formatBreakdown}
            <div class="row">
              <dt>Formats</dt>
              <dd>{formatBreakdown}</dd>
            </div>
          {/if}
          <div class="row">
            <dt>Total size</dt>
            <dd>{prettySize(output.totalOriginalSize)}</dd>
          </div>
          {#if largest}
            <div class="row">
              <dt>Largest</dt>
              <dd class="largest" title={largest.name}>
                {prettySize(largest.size)}
              </dd>
            </div>
          {/if}
        </dl>
        <p class="hint">Select an image below to fine-tune it</p>
      </div>
    {/if}

    {#if busy}
      <div class="progress" aria-label="Batch progress">
        <span class="spinner" aria-hidden="true"></span>
        <span>Encoding {progress.completed} of {progress.total}…</span>
      </div>
    {:else if progress.failed > 0}
      <p class="failed">{progress.failed} failed</p>
    {/if}
  </div>

  <!-- Panel footer, styled after the production Results footer: the batch
       output total + delta at the top, a secondary transform line, and the
       coral "Save all · ZIP" action at the right. This footer owns the ONE
       home of the batch result total; the count lives in the global title. -->
  <div class="panel-footer">
    {#if file}
      <!-- Under single-image info, a whisper-caption makes the seam explicit:
           the info above is for ONE image, the totals + action below are for
           the whole batch. -->
      <p class="footer-scope">All images</p>
    {/if}
    <div class="footer-main">
      <div class="stats">
        <div class="size-row">
          <span class="total-size">
            {#if outputParts}
              {outputParts.value}<span class="unit">{outputParts.unit}</span>
            {:else}
              <span class="pending">…</span>
            {/if}
          </span>
          {#if showDelta}
            <DeltaPill percent={output.percentChange} />
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
</div>

<style>
  .batch-info {
    display: flex;
    flex-direction: column;
    min-height: 0;
    color: var(--text-1, #f5f5f7);
  }

  /* Title + info rows scroll together; the footer stays pinned. */
  .batch-info-scroll {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
  }

  .head {
    display: grid;
    gap: 3px;
    padding: 14px 16px 10px;
  }

  /* The panel title (filename OR count) reads like a card heading, not a
     section label — it replaces the removed IMAGE/BATCH headers. */
  .title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
  }
  /* The filename title leans azure — the single-image scope hue — so the
     left panel's "who am I looking at" echoes the strip ring + right panel. */
  .filename {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--accent-2, #53b2ff);
  }
  .count {
    font-variant-numeric: tabular-nums;
  }

  .hint {
    margin: 6px 0 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.9rem;
  }

  /* Long size strings (e.g. "3.68 MB") shouldn't be forced onto one clipped
     line the way a filename is. */
  .largest {
    max-width: 12ch;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .body {
    display: grid;
    gap: 12px;
    padding: 0 16px 14px;
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

  /* Custom-settings affordance — closes out the IMAGE face. */
  .override-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-top: 2px;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.92rem;
  }
  /* Blue dot: a per-image deviation is a single-image (azure) concept, matching
     the strip corner dot. */
  .override-row .dot {
    color: var(--accent-2, #53b2ff);
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

  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px 12px;
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
    padding: 0 16px 12px;
    color: var(--bad, #ff7d92);
    font-size: 0.9rem;
    font-weight: 700;
  }

  /* Footer: mirrors Results.svelte — size stats at the left, action at the
     right, same paddings/radius rhythm as the production OptionsPanel footer
     (border-top + faint inset background). */
  .panel-footer {
    flex: none;
    padding: 10px 16px 12px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    background: rgba(0, 0, 0, 0.18);
  }

  .footer-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 10px;
  }

  /* Tiny uppercase whisper in the section-header idiom — marks the batch seam
     under single-image info. */
  .footer-scope {
    margin: 0 0 6px;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
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

  .from-to {
    font-size: 0.85rem;
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
