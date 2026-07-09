<script lang="ts">
  // The left-panel surface for bulk mode. It has two faces driven by
  // SELECTION (not the right-panel scope tab):
  //
  //  • IMAGE face (an image is selected): the panel TITLE is the filename (in
  //    azure, the single-image scope hue), then the info rows (Format /
  //    Original size / Dimensions / Aspect chip — identity, then weight, then
  //    the geometry pair together), then the ● custom-settings +
  //    "Reset to global" row when the job deviates.
  //  • GLOBAL face (nothing selected): the title is the image COUNT, then real
  //    batch facts (format breakdown / largest file computed from the actual
  //    source files — the ORIGINAL total lives in the hero below, not a row),
  //    then a quiet fine-tune hint.
  //
  // A footer is ALWAYS present (both faces) and is the SINGLE home of the batch
  // result — the CELEBRATION block (the app's whole point in one glance): a
  // two-stat hero pair (ORIGINAL → OPTIMIZED, big figures sized like the
  // production Results footer), the proud green savings line (↓97% · "25.8 MB
  // saved") just under it, and the full-width coral "Save all · ZIP" action
  // closing the block. While encoding, a slim progress line sits above the
  // stats and the OPTIMIZED figure pulses as it climbs. On the IMAGE face a
  // tiny "ALL IMAGES" whisper-caption tops the footer so the info-for-one /
  // action-for-all seam reads intentionally.
  import ImageInfoRows from '$lib/editor/ImageInfoRows.svelte';
  import { formatLabel } from '$lib/editor/format-label';
  import { prettySize, prettySizeParts } from '$lib/editor/pretty-size';
  import { bulkStore } from './store.svelte';
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

  const summary = $derived(bulkStore.summary);
  const output = $derived(summary.output);
  const progress = $derived(summary.progress);
  const busy = $derived(progress.active + progress.queued > 0);
  const hasOverrides = $derived(bulkStore.selectedHasOverrides);
  const selectedCount = $derived(bulkStore.selectedCount);
  const multiSelected = $derived(selectedCount > 1);

  // The two hero figures, value + unit split so each unit can echo the
  // production footer's smaller accented unit glyph. ORIGINAL is always known
  // (source sizes are on disk); OPTIMIZED only exists once results land.
  const originalParts = $derived(prettySizeParts(output.totalOriginalSize));
  const outputParts = $derived(
    output.optimized > 0 ? prettySizeParts(output.totalOutputSize) : null,
  );

  const showDelta = $derived(output.optimized > 0);

  // The money line: how many bytes the batch shed. Only meaningful once at
  // least one result exists and the batch actually got smaller.
  const savedBytes = $derived(
    output.totalOriginalSize - output.totalOutputSize,
  );
  const savedPretty = $derived(prettySize(Math.max(savedBytes, 0)));

  // ── Global-face batch facts (computed from the actual source files) ────────
  const jobs = $derived(bulkStore.session.jobs);
  const faceJobs = $derived(multiSelected ? bulkStore.selectedJobs : jobs);

  /** "8 JPEG · 4 PNG" — counts by short format label, most common first. */
  const formatBreakdown = $derived.by(() => {
    const counts = new Map<string, number>();
    for (const job of faceJobs) {
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
    for (const job of faceJobs) {
      if (!top || job.sourceFile.size > top.size) top = job.sourceFile;
    }
    return top;
  });
</script>

<div class="batch-info">
  <div class="batch-info-scroll">
    {#if file && !multiSelected}
      <!-- IMAGE face: filename is the title, then the info rows. -->
      <div class="head">
        <p class="title filename" title={file.name}>{file.name}</p>
      </div>
      <div class="body">
        <ImageInfoRows {file} {width} {height} />

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
      <!-- GLOBAL / MULTI face: count title, then facts over all jobs or the selected subset. -->
      <div class="head global-head">
        <p class="title count">
          {#if multiSelected}
            {selectedCount} images selected
          {:else}
            {summary.totalJobs}
            {summary.totalJobs === 1 ? 'image' : 'images'}
          {/if}
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
          {#if largest}
            <div class="row">
              <dt>Largest</dt>
              <dd class="largest" title={largest.name}>
                {prettySize(largest.size)}
              </dd>
            </div>
          {/if}
        </dl>
        {#if multiSelected && hasOverrides}
          <div class="override-row">
            <span class="dot" aria-hidden="true">●</span>
            <strong>Custom settings</strong>
            <button type="button" onclick={() => onReset?.()}
              >Reset to global</button
            >
          </div>
        {:else if !multiSelected}
          <p class="hint">Select an image below to fine-tune it</p>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Panel footer — the batch celebration. This is THE selling point of the
       app: the whole batch went from ORIGINAL → OPTIMIZED, and that deserves
       room to breathe. A two-stat pair (big figures, sized like the production
       Results footer) leads; the green savings line is the proud money line
       just under it; the coral "Save all · ZIP" action closes the block,
       full-width, so the win and the action read as one gesture. This footer
       owns the ONE home of the batch result total; the count lives in the
       global title. -->
  <div class="panel-footer">
    {#if selectedCount > 0}
      <!-- Under single-image info, a whisper-caption makes the seam explicit:
           the info above is for ONE image, the totals + action below are for
           the whole batch. -->
      <p class="footer-scope">All images</p>
    {/if}

    {#if busy}
      <!-- Slim progress line, integrated above the stats so the celebration
           builds as results land. -->
      <div class="progress" aria-label="Batch progress">
        <span class="spinner" aria-hidden="true"></span>
        <span>Encoding {progress.completed} of {progress.total}…</span>
      </div>
    {:else if progress.failed > 0}
      <p class="failed">{progress.failed} failed</p>
    {/if}

    <!-- The two-stat hero pair: ORIGINAL → OPTIMIZED. -->
    <div class="hero-pair">
      <div class="stat stat-original">
        <span class="figure">
          {originalParts.value}<span class="unit unit-quiet"
            >{originalParts.unit}</span
          >
        </span>
        <span class="stat-label">Original</span>
      </div>

      <span class="cue" aria-hidden="true">
        <svg viewBox="0 0 24 12" class="cue-arrow">
          <path
            d="M2 6h18M15 1.5L20.5 6 15 10.5"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </span>

      <div class="stat stat-output" class:working={busy}>
        <span class="figure">
          {#if outputParts}
            {outputParts.value}<span class="unit">{outputParts.unit}</span>
          {:else}
            <span class="pending">…</span>
          {/if}
        </span>
        <span class="stat-label">Optimized</span>
      </div>
    </div>

    <!-- The money line: proud, readable, just under the big figures. -->
    {#if showDelta}
      <div class="savings">
        <DeltaPill percent={output.percentChange} />
        <span class="saved">{savedPretty} saved</span>
      </div>
    {/if}

    <button
      type="button"
      class="save-all"
      disabled={!bulkStore.canSaveAll}
      onclick={() => void bulkStore.saveAll()}
    >
      <!-- The same download glyph the production per-image Save button uses
           (Results.svelte), sized to the button text. -->
      <svg class="save-all-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 3v10.2m0 0l4.2-4.2M12 13.2L7.8 9M4.5 16.5v2.3c0 .9.8 1.7 1.7 1.7h11.6c.9 0 1.7-.8 1.7-1.7v-2.3"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
      {bulkStore.exporting ? 'Saving…' : 'Save all · ZIP'}
    </button>
    <label class="keep-originals">
      <input type="checkbox" bind:checked={bulkStore.keepOriginalWhenLarger} />
      <span>Keep originals when larger</span>
    </label>
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
    text-align: center;
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

  /* Slim progress line — now lives at the top of the footer, above the hero
     stats, so its own padding is just a bottom gap before the figures. */
  .progress {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 10px;
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
    margin: 0 0 10px;
    color: var(--bad, #ff7d92);
    font-size: 0.9rem;
    font-weight: 700;
  }

  /* Footer: mirrors Results.svelte — size stats at the left, action at the
     right, same paddings/radius rhythm as the production OptionsPanel footer
     (border-top + faint inset background). */
  /* The celebration is the panel's selling point — give it room to breathe.
     Generous top/bottom padding lifts the stat pair off the info rows above and
     sets the Save-all action apart below, using the panel's spare height. */
  .panel-footer {
    flex: none;
    padding: 22px 16px 20px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    background: rgba(0, 0, 0, 0.18);
  }

  /* Tiny uppercase whisper in the section-header idiom — marks the batch seam
     under single-image info. */
  .footer-scope {
    margin: 0 0 10px;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  /* ── The hero pair: ORIGINAL → OPTIMIZED ──────────────────────────────────
     Two big figures flanking a directional cue. The row hugs its content and
     centres, so the pair reads as one balanced "before → after" gesture rather
     than a left/right split. Figures use clamp() so they scale DOWN gracefully
     at the 250px compact width without clipping. */
  .hero-pair {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: clamp(8px, 4%, 16px);
    min-width: 0;
  }

  .stat {
    display: grid;
    justify-items: center;
    gap: 2px;
    min-width: 0;
  }

  .figure {
    font-size: clamp(1.35rem, 6.2vw, 1.7rem);
    font-weight: 700;
    line-height: 1.05;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
    color: var(--text-1, #f5f5f7);
    white-space: nowrap;
  }

  /* The label under each figure — the whisper-caption idiom (uppercase, tracked,
     text-3), matching the info-row dt styling elsewhere in the panel. */
  .stat-label {
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
  }

  .unit {
    font-size: 0.66em;
    font-weight: 600;
    margin-left: 2px;
    color: var(--main-theme-color, #ff8a5e);
  }
  /* The ORIGINAL figure is the "before" — its unit stays neutral (gray, not the
     coral reserved for the OPTIMIZED win) but sits a step brighter than the
     faint text-3 so the "before" reads comfortably. */
  .unit-quiet {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
  }

  .pending {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
  }

  /* Directional cue between the figures — a quiet arrow, aligned to the figure
     baseline row (nudged up so it sits with the numbers, not the labels). */
  .cue {
    flex: none;
    display: flex;
    align-items: center;
    align-self: start;
    margin-top: 0.5em;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
  }
  .cue-arrow {
    width: 22px;
    height: 11px;
  }

  /* While encoding, the running OPTIMIZED total breathes so the figure reads as
     "still working" without any layout jank. */
  .stat-output.working .figure {
    animation: figure-pulse 1.4s ease-in-out infinite;
  }
  @media (prefers-reduced-motion: reduce) {
    .stat-output.working .figure {
      animation: none;
    }
  }

  /* ── The money line — proud, just under the big figures ───────────────────*/
  .savings {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 14px;
  }
  .saved {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    font-variant-numeric: tabular-nums;
    color: var(--text-1, #f5f5f7);
    white-space: nowrap;
  }

  .save-all {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    margin-top: 22px;
    height: 40px;
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
  .save-all:hover:not(:disabled) {
    transform: translateY(-1px);
    filter: brightness(1.06);
  }
  .save-all:active:not(:disabled) {
    transform: translateY(0);
  }
  .save-all:disabled {
    opacity: 0.45;
    cursor: default;
    filter: saturate(0.6);
    box-shadow: none;
  }
  .save-all:focus-visible {
    outline: 2px solid var(--main-theme-color, #ff8a5e);
    outline-offset: 2px;
  }
  /* Match the download glyph to the button text size. */
  .save-all-icon {
    flex: none;
    width: 1.15em;
    height: 1.15em;
  }

  .keep-originals {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin-top: 10px;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
  }
  .keep-originals input {
    width: 13px;
    height: 13px;
    margin: 0;
    accent-color: var(--main-theme-color, #ff8a5e);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  @keyframes figure-pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.55;
    }
  }
</style>
