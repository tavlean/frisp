<script lang="ts">
  // The before/after editor view, ported from
  // src/client/lazy-app/Compress/Output/index.tsx. Two synced <pinch-zoom>
  // elements inside a <two-up>: left draws the processed source, right draws the
  // decoded output. Only the left pinch-zoom is driven; pointer/wheel events are
  // retargeted to it and the right mirrors its transform.
  import PinchZoom, { type ScaleToOpts, type ZoomMode } from './pinch-zoom';
  import './two-up';
  import { browser } from '$app/environment';
  import { drawDataToCanvas } from 'client/lazy-app/util/canvas';
  import { isSafari } from 'client/lazy-app/util';
  import { retargetViewEvents } from './retarget-events';
  import ProcessingBadge from './ProcessingBadge.svelte';

  interface Props {
    /** Pixels drawn on the left ("before") side — side 0's output. */
    leftImage?: ImageData;
    /** Pixels drawn on the right ("after") side — side 1's output. */
    rightImage?: ImageData;
    /** Whether each side is mid-encode (the 500ms-delayed "working" signal) —
     *  drives the per-side ProcessingBadge. */
    leftWorking?: boolean;
    rightWorking?: boolean;
    /** Whether each side's status is `done` — gates the badge's green success
     *  beat (so an error/abort just fades, no green). */
    leftDone?: boolean;
    rightDone?: boolean;
    /** What each side's current pass is doing, for the badge wording:
     *  'resize' → "Resizing…", otherwise "Optimizing"/"Re-optimizing". */
    leftActivity?: 'optimize' | 'resize';
    rightActivity?: 'optimize' | 'resize';
    /** Identity of the loaded source; changes force a re-fit even at same dims. */
    fileId?: string | number;
    /** Per-side "contain" resize: display the (smaller) output letterboxed
     *  inside the original source footprint so the two-up split stays aligned. */
    leftContain?: boolean;
    rightContain?: boolean;
    /** The preprocessed (original, post-rotate) source dims — the contain box. */
    containWidth?: number;
    containHeight?: number;
    onRotate?: () => void;
  }

  let {
    leftImage,
    rightImage,
    leftWorking = false,
    rightWorking = false,
    leftDone = false,
    rightDone = false,
    leftActivity = 'optimize',
    rightActivity = 'optimize',
    fileId,
    leftContain = false,
    rightContain = false,
    containWidth = 0,
    containHeight = 0,
    onRotate,
  }: Props = $props();

  // Source fallback, mirroring the original Squoosh Output (rightDrawable() =>
  // rightCompressed || source.preprocessed): until a side has its own result,
  // show the other side's image (the "Original" left side is a near-instant
  // proxy for the decoded source) so the panel is never blank during a slow
  // encode. Each side prefers its own pixels and only borrows when it has none.
  const leftDraw = $derived(leftImage ?? rightImage);
  const rightDraw = $derived(rightImage ?? leftImage);

  // Pin both canvases' CSS box to the original (preprocessed) source dims so a
  // resized-down output keeps the same on-screen footprint as the other side and
  // the two-up split stays aligned. Faithful to the original's
  // getOutputPreviewImageState, which set width/height UNCONDITIONALLY and only
  // toggled object-fit. The box dims are identical for both sides (same source),
  // so they're shared; `object-fit:contain` is added per-side in the template
  // (only when that side is "contain"-resized) to letterbox without distortion —
  // otherwise the default `fill` stretches the smaller raster to the box (the
  // expected soft/pixelated look). Null when dims are unknown → property removed.
  const boxWidth = $derived(containWidth ? `${containWidth}px` : null);
  const boxHeight = $derived(containHeight ? `${containHeight}px` : null);

  let twoUp = $state<HTMLElement>();
  let pinchLeft = $state<PinchZoom>();
  let pinchRight = $state<PinchZoom>();
  let canvasLeft = $state<HTMLCanvasElement>();
  let canvasRight = $state<HTMLCanvasElement>();

  let viewportWidth = $state(1024);
  let viewportHeight = $state(768);
  let scale = $state(1);
  let editingScale = $state(false);
  let pixelated = $state(false);
  let altBackground = $state(false);

  const orientation = $derived(
    viewportWidth <= 760 ? 'vertical' : 'horizontal',
  );
  const scalePercent = $derived(Math.round(scale * 100));
  const fitTarget = $derived.by(() => {
    const image = leftImage ?? rightImage;
    if (!image) return null;
    // The displayed footprint is always the original source box when known (see
    // boxWidth/boxHeight), so fit + centre against that, not the resized raster.
    const usableBox = containWidth && containHeight;
    return {
      width: usableBox ? containWidth : image.width,
      height: usableBox ? containHeight : image.height,
    };
  });

  const scaleToOpts = {
    originX: '50%',
    originY: '50%',
    relativeTo: 'container',
    allowChangeEvent: true,
  } satisfies ScaleToOpts;

  // --- SCROLL-ZOOM-MODE EXPERIMENT (temporary) -----------------------------
  // A throwaway segmented control (rendered top-centre of the stage) that lets
  // us A/B the five wheel/scroll-zoom anchoring strategies live and persists
  // the pick across reloads. This ONLY affects mouse-wheel / trackpad-scroll
  // zoom — pinch gestures always anchor at the gesture itself, untouched by the
  // mode. Self-contained: remove this block + the markup + the .zoom-mode-bar
  // styles to drop the experiment entirely.
  const ZOOM_MODES: { value: ZoomMode; label: string; title: string }[] = [
    {
      value: 'cursor',
      label: 'Pointer',
      title: 'Zoom toward the pointer (current behaviour)',
    },
    {
      value: 'center',
      label: 'Center',
      title: 'Always zoom toward the viewport centre (like the +/- buttons)',
    },
    {
      value: 'smart',
      label: 'Smart',
      title:
        'Pointer when over the image, viewport centre when over the backdrop',
    },
    {
      value: 'adaptive',
      label: 'Adaptive',
      title: 'Viewport centre while the image fits; pointer once zoomed in past fit',
    },
    {
      value: 'smart-bounded',
      label: 'Framed',
      title: 'Smart anchoring, and keeps the image framed on screen',
    },
  ];
  const ZOOM_STORAGE_KEY = 'sqush:zoom-mode';

  // Initial mode from localStorage (validated against the known modes), else
  // the default 'cursor'. Only read storage in the browser.
  let zoomMode = $state<ZoomMode>(readStoredZoomMode());

  function readStoredZoomMode(): ZoomMode {
    if (!browser) return 'cursor';
    const stored = localStorage.getItem(ZOOM_STORAGE_KEY);
    return ZOOM_MODES.some((m) => m.value === stored)
      ? (stored as ZoomMode)
      : 'cursor';
  }

  // Persist the pick across reloads.
  $effect(() => {
    if (browser) localStorage.setItem(ZOOM_STORAGE_KEY, zoomMode);
  });

  // Push the selected mode onto BOTH pinch instances and re-apply bounds, so
  // switching to 'smart-bounded' re-frames immediately. Setting zoomMode on
  // both keeps the left's bounds clamp and the mirrored right's clamp identical
  // so the two panes can't desync.
  $effect(() => {
    const mode = zoomMode;
    if (pinchLeft) pinchLeft.zoomMode = mode;
    if (pinchRight) pinchRight.zoomMode = mode;
    pinchLeft?.setTransform({ allowChangeEvent: true });
  });
  // --- end scroll-zoom-mode experiment -------------------------------------

  // Draw the pixels whenever they change. leftDraw/rightDraw fall back to the
  // other side's image while a side awaits its own result (see above).
  $effect(() => {
    if (canvasLeft && leftDraw) drawDataToCanvas(canvasLeft, leftDraw);
  });
  $effect(() => {
    if (canvasRight && rightDraw) drawDataToCanvas(canvasRight, rightDraw);
  });

  // Fit + centre the view when the image dimensions change (new file / resize),
  // but not on every re-encode (which keeps the same dimensions).
  let fittedKey = '';
  $effect(() => {
    const s = fitTarget;
    const pz = pinchLeft;
    const tu = twoUp;
    if (!s || !pz || !tu) return;
    const key = `${fileId}:${s.width}x${s.height}:${orientation}:${viewportWidth}x${viewportHeight}`;
    if (key === fittedKey) return;
    const raf = requestAnimationFrame(() => {
      const bounds = tu.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;
      const styles = getComputedStyle(tu);
      const insetLeft =
        Number.parseFloat(styles.getPropertyValue('--fit-inset-left')) || 0;
      const insetRight =
        Number.parseFloat(styles.getPropertyValue('--fit-inset-right')) || 0;
      const insetTop =
        Number.parseFloat(styles.getPropertyValue('--fit-inset-top')) || 0;
      const insetBottom =
        Number.parseFloat(styles.getPropertyValue('--fit-inset-bottom')) || 0;
      const visibleWidth = Math.max(1, bounds.width - insetLeft - insetRight);
      const visibleHeight = Math.max(1, bounds.height - insetTop - insetBottom);
      fittedKey = key;
      const fit = Math.min(visibleWidth / s.width, visibleHeight / s.height);
      const fitScale = fit < 1 ? fit : 1;
      pz.setTransform({
        scale: fitScale,
        x: insetLeft + (visibleWidth - s.width * fitScale) / 2,
        y: insetTop + (visibleHeight - s.height * fitScale) / 2,
        allowChangeEvent: true,
      });
    });
    return () => cancelAnimationFrame(raf);
  });

  function onLeftChange() {
    if (!pinchLeft || !pinchRight) return;
    scale = pinchLeft.scale;
    pinchRight.setTransform({
      scale: pinchLeft.scale,
      x: pinchLeft.x,
      y: pinchLeft.y,
    });
  }

  // The pinch-zoom event sync is an attachment on <two-up> (see retarget-events
  // and the {@attach} below): it redirects view gestures to the left pinch-zoom.

  function zoomTo(next: number) {
    pinchLeft?.scaleTo(next, scaleToOpts);
  }

  function onScaleInput(event: Event) {
    const percent = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(percent) || percent <= 0) return;
    zoomTo(percent / 100);
  }

  function focusOnMount(node: HTMLInputElement) {
    // Force a style calc before focus() — Firefox otherwise drops focus on a
    // just-inserted input. Parity with the original onScaleValueFocus.
    void getComputedStyle(node).transform;
    node.focus();
    node.select();
  }
</script>

<svelte:window
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

<div class="output" class:alt-background={altBackground}>
  <two-up
    class="two-up"
    legacy-clip-compat
    {orientation}
    bind:this={twoUp}
    {@attach retargetViewEvents(() => pinchLeft)}
  >
    <pinch-zoom
      class="pinch-zoom"
      bind:this={pinchLeft}
      onchange={onLeftChange}
    >
      <canvas
        class="pinch-target"
        class:pixelated
        width={leftDraw?.width}
        height={leftDraw?.height}
        style:width={boxWidth}
        style:height={boxHeight}
        style:object-fit={leftContain ? 'contain' : null}
        bind:this={canvasLeft}
      ></canvas>
    </pinch-zoom>
    <pinch-zoom class="pinch-zoom" bind:this={pinchRight}>
      <canvas
        class="pinch-target"
        class:pixelated
        width={rightDraw?.width}
        height={rightDraw?.height}
        style:width={boxWidth}
        style:height={boxHeight}
        style:object-fit={rightContain ? 'contain' : null}
        bind:this={canvasRight}
      ></canvas>
    </pinch-zoom>
  </two-up>

  <!-- Per-side in-progress signal, positioned over the side it refers to (left
       half / right half, or top / bottom when stacked) so it's never ambiguous
       which side is busy. The badge IS the in-progress treatment (no blur): a
       working side shows a spinner + "Optimizing…", and resolves into a green
       "Optimized" beat on success. See ProcessingBadge for the phase machine. -->
  <ProcessingBadge
    side="left"
    {orientation}
    working={leftWorking}
    done={leftDone}
    hasResult={!!leftImage}
    activity={leftActivity}
  />
  <ProcessingBadge
    side="right"
    {orientation}
    working={rightWorking}
    done={rightDone}
    hasResult={!!rightImage}
    activity={rightActivity}
  />

  <!-- SCROLL-ZOOM-MODE EXPERIMENT (temporary): top-centre segmented control to
       A/B the five wheel/scroll-zoom anchoring strategies live. Radiogroup
       pattern; the pick is persisted to localStorage. This ONLY changes how
       mouse-wheel / trackpad-scroll zoom picks its anchor — pinch gestures
       always anchor at the gesture and are unaffected. Remove this block (plus
       the experiment script block and the .zoom-mode-bar styles) to drop it. -->
  <div class="zoom-mode-bar" role="radiogroup" aria-label="Scroll-zoom behaviour">
    {#each ZOOM_MODES as mode (mode.value)}
      <button
        type="button"
        class="mode-button"
        class:active={zoomMode === mode.value}
        role="radio"
        aria-checked={zoomMode === mode.value}
        title={mode.title}
        onclick={() => (zoomMode = mode.value)}
      >{mode.label}</button>
    {/each}
  </div>
</div>

<div class="controls">
  <div class="button-group">
    <button
      class="button first-button"
      onclick={() => zoomTo(scale / 1.25)}
      title="Zoom out"
      aria-label="Zoom out"
    >
      <svg class="icon" viewBox="0 0 24 24"><path d="M19 13H5v-2h14v2z" /></svg>
    </button>
    {#if editingScale}
      <input
        class="zoom"
        type="number"
        step="1"
        min="1"
        max="1000000"
        value={scalePercent}
        oninput={onScaleInput}
        onblur={() => (editingScale = false)}
        {@attach focusOnMount}
      />
    {:else}
      <span
        class="zoom"
        role="button"
        tabindex="0"
        onfocus={() => (editingScale = true)}
        onclick={() => (editingScale = true)}
        onkeydown={(e) => {
          if (e.key === 'Enter') editingScale = true;
        }}
      >
        <span class="zoom-value">{scalePercent}</span>%
      </span>
    {/if}
    <button
      class="button last-button"
      onclick={() => zoomTo(scale * 1.25)}
      title="Zoom in"
      aria-label="Zoom in"
    >
      <svg class="icon" viewBox="0 0 24 24"
        ><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg
      >
    </button>
  </div>

  <div class="button-group">
    <button
      class="button first-button"
      class:last-button={isSafari}
      onclick={() => onRotate?.()}
      title="Rotate"
      aria-label="Rotate"
    >
      <svg class="icon" viewBox="0 0 24 24"
        ><path
          d="M15.6 5.5L11 1v3a8 8 0 0 0 0 16v-2a6 6 0 0 1 0-12v4l4.5-4.5zm4.3 5.5a8 8 0 0 0-1.6-3.9L17 8.5c.5.8.9 1.6 1 2.5h2zM13 17.9v2a8 8 0 0 0 3.9-1.6L15.5 17c-.8.5-1.6.9-2.5 1zm3.9-2.4l1.4 1.4A8 8 0 0 0 20 13h-2c-.1.9-.5 1.7-1 2.5z"
        /></svg
      >
    </button>
    {#if !isSafari}
      <button
        class="button"
        class:active={pixelated}
        onclick={() => (pixelated = !pixelated)}
        title="Toggle smoothing"
        aria-label="Toggle smoothing"
        aria-pressed={pixelated}
      >
        {#if pixelated}
          <svg class="icon" viewBox="0 0 24 24"
            ><path
              d="M12 3h5v2h2v2h2v5h-2V9h-2V7h-2V5h-3V3M21 12v5h-2v2h-2v2h-5v-2h3v-2h2v-2h2v-3h2M12 21H7v-2H5v-2H3v-5h2v3h2v2h2v2h3v2M3 12V7h2V5h2V3h5v2H9v2H7v2H5v3H3"
            /></svg
          >
        {:else}
          <svg class="icon" viewBox="0 0 24 24"
            ><circle
              cx="12"
              cy="12"
              r="8"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            /></svg
          >
        {/if}
      </button>
    {/if}
    <button
      class="button last-button"
      class:active={altBackground}
      onclick={() => (altBackground = !altBackground)}
      title="Toggle background"
      aria-label="Toggle background"
      aria-pressed={altBackground}
    >
      {#if altBackground}
        <svg class="icon" viewBox="0 0 24 24"
          ><path
            d="M9 7H7v2h2V7zm0 4H7v2h2v-2zm0-8a2 2 0 0 0-2 2h2V3zm4 12h-2v2h2v-2zm6-12v2h2a2 2 0 0 0-2-2zm-6 0h-2v2h2V3zM9 17v-2H7c0 1.1.9 2 2 2zm10-4h2v-2h-2v2zm0-4h2V7h-2v2zm0 8a2 2 0 0 0 2-2h-2v2zM5 7H3v12c0 1.1.9 2 2 2h12v-2H5V7zm10-2h2V3h-2v2zm0 12h2v-2h-2v2z"
          /></svg
        >
      {:else}
        <svg class="icon" viewBox="0 0 24 24"
          ><path
            d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm2 4v-2H3c0 1.1.9 2 2 2zM3 9h2V7H3v2zm12 12h2v-2h-2v2zm4-18H9a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12H9V5h10v10zm-8 6h2v-2h-2v2zm-4 0h2v-2H7v2z"
          /></svg
        >
      {/if}
    </button>
  </div>
</div>

<style>
  .output {
    position: absolute;
    inset: 0;
  }

  .output::before {
    content: '';
    position: absolute;
    inset: 0;
    /* The canvas stage: near-black with a soft vignette so the glass panels
       read as floating above it, and a faint dot grid (in place of Squoosh's
       transparency checkerboard). The dots are a neutral grey at low alpha so
       they read on both the dark and the light fill (the toggle swaps to a
       near-white), which lets only the colour cross-fade on toggle. */
    background-color: #101014;
    background-image:
      radial-gradient(
        ellipse 120% 90% at 50% 40%,
        rgba(255, 255, 255, 0.045),
        transparent 70%
      ),
      radial-gradient(rgba(128, 128, 140, 0.3) 1px, transparent 1.4px);
    background-size:
      100% 100%,
      22px 22px;
    background-position: center;
    transition: background-color 500ms ease;
  }

  .output.alt-background::before {
    background-color: #d4d4d8;
  }

  .two-up,
  .pinch-zoom {
    position: absolute;
    inset: 0;
  }

  .pinch-zoom {
    outline: none;
  }

  .pinch-target {
    will-change: auto;
    flex-shrink: 0;
  }

  .pixelated {
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }

  .controls {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    pointer-events: none;
  }

  .controls > * {
    pointer-events: auto;
  }

  .button-group {
    display: flex;
    position: relative;
  }

  .button,
  .zoom {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    background-color: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-width: 1px 0 1px 1px;
    line-height: 1.1;
    white-space: nowrap;
    height: 38px;
    padding: 0 12px;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-2, #bbb);
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .button {
    justify-content: center;
    min-width: 40px;
    padding: 0 7px;
  }

  .icon {
    display: block;
    width: 20px;
    height: 20px;
    fill: currentColor;
  }

  .button:hover {
    background: rgba(45, 45, 54, 0.92);
    color: var(--text-1, #fff);
  }

  .button.active {
    background: rgba(62, 62, 74, 0.95);
    color: var(--text-1, #fff);
  }

  .button-group {
    border-radius: 999px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }

  .first-button {
    border-radius: 999px 0 0 999px;
    padding-left: 11px;
  }

  .last-button {
    border-radius: 0 999px 999px 0;
    border-right-width: 1px;
    padding-right: 11px;
  }

  .zoom {
    cursor: text;
    width: 7rem;
    font: inherit;
    text-align: center;
    justify-content: center;
  }

  span.zoom {
    color: var(--text-3, #939393);
    font-size: 0.85rem;
  }

  .zoom-value {
    margin: 0 3px 0 0;
    padding: 0 2px;
    font-size: 1.15rem;
    letter-spacing: 0.04rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-1, #fff);
    border-bottom: 1px dashed rgba(255, 255, 255, 0.3);
  }

  input.zoom {
    font-size: 1.15rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-1, #fff);
    -moz-appearance: textfield;
    appearance: textfield;
  }

  input.zoom::-webkit-outer-spin-button,
  input.zoom::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }

  /* SCROLL-ZOOM-MODE EXPERIMENT (temporary): a single glass pill of 5 buttons,
     pinned top-centre over the stage. Matches the .button-group aesthetic
     (semi-transparent dark surface, backdrop blur, subtle border, rounded
     pill, brighter active state). Centred + max-width so it clears the
     top-corner ProcessingBadges, and allowed to shrink/wrap on narrow widths
     so it never overflows the viewport. Remove this whole block to drop the
     experiment. */
  .zoom-mode-bar {
    position: absolute;
    top: 12px;
    left: 0;
    right: 0;
    z-index: 5;
    margin: 0 auto;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    width: max-content;
    max-width: calc(100% - 24px);
    /* The control itself is interactive, but keep it compact (width:max-content
       + centred) so it doesn't blanket the stage and block gestures around it. */
    pointer-events: auto;
    background-color: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
    overflow: hidden;
  }

  .mode-button {
    flex: 0 1 auto;
    min-width: 0;
    box-sizing: border-box;
    background: transparent;
    border: none;
    line-height: 1.1;
    white-space: nowrap;
    height: 32px;
    padding: 0 12px;
    font: inherit;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    color: var(--text-2, #bbb);
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .mode-button:hover {
    background: rgba(45, 45, 54, 0.92);
    color: var(--text-1, #fff);
  }

  .mode-button.active {
    background: rgba(62, 62, 74, 0.95);
    color: var(--text-1, #fff);
  }
</style>
