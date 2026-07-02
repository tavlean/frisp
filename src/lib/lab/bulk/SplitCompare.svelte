<script lang="ts">
  // Before/after split viewer for the selected job. NO zoom/pan (out of lab
  // scope). The ORIGINAL renders below (an <img> off a full-size object URL of
  // the source File); the ENCODED result renders on top, clipped with a
  // `clip-path: inset()` driven by a draggable vertical divider. Both images use
  // object-fit: contain, so on a letterboxed image the divider must track the
  // RENDERED IMAGE BOX (not the container) or it would sit off the picture — we
  // compute that box from the natural aspect ratio and the stage size, then lay
  // the divider + clip against it.
  //
  // While the selected job is encoding, the stage dims and shows a spinner.
  import { labBulk } from './store.svelte';

  const job = $derived(labBulk.selectedJob);
  const outputUrl = $derived(job?.output?.downloadUrl);
  const thumb = $derived(labBulk.selectedThumb);
  const detail = $derived(labBulk.selectedDetail);

  // Encoding = this job is active OR its output is missing/stale while the
  // batch is still working (so the stage dims instead of showing a broken top).
  const encoding = $derived(
    !!job &&
      (job.status === 'processing' ||
        job.status === 'decoding' ||
        (!job.output && labBulk.processing)),
  );

  // Full-size original object URL for the current source File. Owned by ONE
  // self-cleaning effect: it mints the URL for the current file, and its
  // cleanup revokes it — so switching source (effect re-runs) and component
  // teardown both revoke exactly once. `originalUrl` is written only from this
  // effect's own scope, mirroring the editor's raw-payload URL handling.
  let originalUrl = $state<string | null>(null);

  $effect(() => {
    const file = job?.sourceFile;
    if (!file) {
      originalUrl = null;
      return;
    }
    const url = URL.createObjectURL(file);
    originalUrl = url;
    return () => {
      URL.revokeObjectURL(url);
      originalUrl = null;
    };
  });

  // Divider position as a fraction (0..1) across the RENDERED image box.
  let split = $state(0.5);
  let stageEl: HTMLDivElement | undefined;
  let dragging = false;

  // Stage size, tracked so the rendered-image box recomputes on resize.
  let stageW = $state(0);
  let stageH = $state(0);

  $effect(() => {
    const el = stageEl;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      stageW = rect.width;
      stageH = rect.height;
    });
    observer.observe(el);
    return () => observer.disconnect();
  });

  // The rendered box of a contain-fitted image inside the stage: same aspect as
  // the natural source, centred, letterboxed on the constrained axis.
  const box = $derived.by(() => {
    const natW = thumb?.w ?? 0;
    const natH = thumb?.h ?? 0;
    if (natW <= 0 || natH <= 0 || stageW <= 0 || stageH <= 0) {
      return { left: 0, top: 0, width: stageW, height: stageH };
    }
    const scale = Math.min(stageW / natW, stageH / natH);
    const width = natW * scale;
    const height = natH * scale;
    return {
      left: (stageW - width) / 2,
      top: (stageH - height) / 2,
      width,
      height,
    };
  });

  // Divider x in stage pixels (clamped to the rendered image box).
  const dividerX = $derived(box.left + split * box.width);

  // clip-path inset for the TOP (encoded) layer: reveal from the left edge of
  // the box up to the divider. Because the top <img> fills the stage and is
  // contain-fitted identically to the bottom one, insetting in stage pixels
  // aligns with the picture.
  const clipRight = $derived(Math.max(0, stageW - dividerX));

  function setSplitFromClientX(clientX: number) {
    if (!stageEl || box.width <= 0) return;
    const rect = stageEl.getBoundingClientRect();
    const x = clientX - rect.left - box.left;
    split = Math.min(1, Math.max(0, x / box.width));
  }

  function onPointerDown(event: PointerEvent) {
    dragging = true;
    (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
    setSplitFromClientX(event.clientX);
  }

  function onPointerMove(event: PointerEvent) {
    if (dragging) setSplitFromClientX(event.clientX);
  }

  function onPointerUp(event: PointerEvent) {
    dragging = false;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(
      event.pointerId,
    );
  }

  function onKeydown(event: KeyboardEvent) {
    const step = event.shiftKey ? 0.1 : 0.02;
    if (event.key === 'ArrowLeft') {
      split = Math.max(0, split - step);
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      split = Math.min(1, split + step);
      event.preventDefault();
    }
  }

  // Size chips.
  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  const originalSize = $derived(detail?.size.originalSize ?? job?.originalSize);
  const outputSize = $derived(detail?.size.outputSize);
  const percent = $derived(detail?.size.percentChange);
  const percentRounded = $derived(
    percent === undefined ? null : Math.round(percent),
  );
</script>

<div class="split">
  <div
    class="stage"
    bind:this={stageEl}
    class:encoding
    role="group"
    aria-label="Before and after comparison"
  >
    {#if originalUrl}
      <img
        class="layer original"
        src={originalUrl}
        alt="Original"
        draggable="false"
      />
    {/if}
    {#if outputUrl}
      <img
        class="layer encoded"
        src={outputUrl}
        alt="Encoded result"
        draggable="false"
        style="clip-path: inset(0 {clipRight}px 0 0)"
      />
    {/if}

    <!-- Overlay chips positioned to the rendered image box. -->
    {#if originalSize !== undefined}
      <span
        class="chip top-left"
        style="left: {box.left + 12}px; top: {box.top + 12}px"
      >
        Original · {prettySize(originalSize)}
      </span>
    {/if}
    {#if outputSize !== undefined}
      <span
        class="chip top-right"
        style="right: {stageW - box.left - box.width + 12}px; top: {box.top +
          12}px"
      >
        WebP · {prettySize(outputSize)}
        {#if percentRounded !== null && percentRounded !== 0}
          <span
            class="pill"
            class:down={percentRounded < 0}
            class:up={percentRounded > 0}
          >
            {percentRounded < 0 ? '▼' : '▲'}
            {Math.abs(percentRounded)}%
          </span>
        {/if}
      </span>
    {/if}

    <!-- Draggable divider (only meaningful when both layers exist). -->
    {#if originalUrl && outputUrl}
      <button
        type="button"
        class="divider"
        style="left: {dividerX}px; top: {box.top}px; height: {box.height}px"
        aria-label="Comparison divider"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(split * 100)}
        role="slider"
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointercancel={onPointerUp}
        onkeydown={onKeydown}
      >
        <span class="handle" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path
              d="M9 7l-4 5 4 5M15 7l4 5-4 5"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </span>
      </button>
    {/if}

    {#if encoding}
      <div class="encoding-overlay" aria-label="Encoding">
        <span class="spinner"></span>
      </div>
    {/if}

    {#if !job}
      <p class="empty">Select an image to compare.</p>
    {/if}
  </div>
</div>

<style>
  .split {
    width: 100%;
    height: 100%;
  }

  .stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 240px;
    border-radius: var(--options-radius, 16px);
    background:
      linear-gradient(rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.1)),
      var(--surface-solid, #16161c);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    overflow: hidden;
    touch-action: none;
    user-select: none;
  }

  .layer {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
  }

  .encoded {
    z-index: 1;
  }

  .stage.encoding .layer {
    filter: brightness(0.7) saturate(0.8);
  }

  .chip {
    position: absolute;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 5px 11px;
    border-radius: 999px;
    background: rgba(12, 12, 15, 0.72);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    color: var(--text-1, #f5f5f7);
    font-size: 0.95rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }

  .pill {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    padding: 1px 7px;
    border-radius: 999px;
    font-weight: 700;
  }

  .pill.down {
    color: var(--good, #3ddc97);
    background: color-mix(in srgb, var(--good, #3ddc97) 16%, transparent);
  }

  .pill.up {
    color: var(--bad, #ff7d92);
    background: color-mix(in srgb, var(--bad, #ff7d92) 16%, transparent);
  }

  .divider {
    position: absolute;
    z-index: 4;
    width: 2px;
    margin: 0;
    padding: 0;
    transform: translateX(-1px);
    background: rgba(255, 255, 255, 0.85);
    border: none;
    cursor: ew-resize;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
  }

  .divider:focus-visible {
    outline: none;
    background: var(--accent-1, #ff8a5e);
  }

  .handle {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.95);
    color: #16161c;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
  }

  .handle svg {
    width: 18px;
    height: 18px;
  }

  .encoding-overlay {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: grid;
    place-items: center;
    pointer-events: none;
  }

  .spinner {
    width: 34px;
    height: 34px;
    border: 3px solid rgba(255, 255, 255, 0.25);
    border-top-color: var(--accent-1, #ff8a5e);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .empty {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 1rem;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
