<script lang="ts">
  // The before/after editor view, ported from
  // src/client/lazy-app/Compress/Output/index.tsx. Two synced <pinch-zoom>
  // elements inside a <two-up>: left draws the processed source, right draws the
  // decoded output. Only the left pinch-zoom is driven; pointer/wheel events are
  // retargeted to it and the right mirrors its transform.
  import PinchZoom, { type ScaleToOpts } from './pinch-zoom';
  import './two-up';
  import { drawDataToCanvas } from 'client/lazy-app/util/canvas';
  import { isSafari } from 'client/lazy-app/util';

  interface Props {
    /** Pixels drawn on the left ("before") side — side 0's output. */
    leftImage?: ImageData;
    /** Pixels drawn on the right ("after") side — side 1's output. */
    rightImage?: ImageData;
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
    fileId,
    leftContain = false,
    rightContain = false,
    containWidth = 0,
    containHeight = 0,
    onRotate,
  }: Props = $props();

  // When a side is "contain"-resized, pin the canvas's CSS box to the original
  // source dims and let object-fit letterbox the smaller raster inside it, so
  // both sides occupy the same footprint. Ported from the original's
  // getOutputPreviewImageState.
  const containStyle = (active: boolean) =>
    active && containWidth && containHeight
      ? `width:${containWidth}px;height:${containHeight}px;object-fit:contain;`
      : '';

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

  const orientation = $derived(viewportWidth <= 760 ? 'vertical' : 'horizontal');
  const scalePercent = $derived(Math.round(scale * 100));
  const fitTarget = $derived.by(() => {
    const image = leftImage ?? rightImage;
    if (!image) return null;
    const containActive = leftImage ? leftContain : rightContain;
    return {
      width:
        containActive && containWidth && containHeight ? containWidth : image.width,
      height:
        containActive && containWidth && containHeight
          ? containHeight
          : image.height,
    };
  });

  const scaleToOpts = {
    originX: '50%',
    originY: '50%',
    relativeTo: 'container',
    allowChangeEvent: true,
  } satisfies ScaleToOpts;

  // Draw the pixels whenever they change.
  $effect(() => {
    if (canvasLeft && leftImage) drawDataToCanvas(canvasLeft, leftImage);
  });
  $effect(() => {
    if (canvasRight && rightImage) drawDataToCanvas(canvasRight, rightImage);
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

  // Keep the two pinch-zooms in sync by redirecting all view events to the left
  // one. Handle drags pass through (so the two-up slider works); wheel always
  // retargets so it zooms even over the handle.
  $effect(() => {
    const el = twoUp;
    const pz = pinchLeft;
    if (!el || !pz) return;
    const retargeted = new WeakSet<Event>();
    const handler = (event: Event) => {
      if (retargeted.has(event)) return;
      const target = event.target as HTMLElement | null;
      const isHandle = !!target?.closest?.('.two-up-handle');
      if (!(event.type === 'wheel' || !isHandle)) return;
      event.stopImmediatePropagation();
      event.preventDefault();
      const Ctor = event.constructor as typeof Event;
      const cloned = new Ctor(event.type, event as EventInit);
      retargeted.add(cloned);
      pz.dispatchEvent(cloned);
    };
    const types = ['touchstart', 'touchend', 'touchmove', 'mousedown', 'wheel'];
    if (!isSafari) types.push('pointerdown');
    for (const type of types) {
      el.addEventListener(type, handler, { capture: true, passive: false });
    }
    return () => {
      for (const type of types) {
        el.removeEventListener(type, handler, { capture: true });
      }
    };
  });

  function zoomTo(next: number) {
    pinchLeft?.scaleTo(next, scaleToOpts);
  }

  function onScaleInput(event: Event) {
    const percent = Number((event.currentTarget as HTMLInputElement).value);
    if (!Number.isFinite(percent) || percent <= 0) return;
    zoomTo(percent / 100);
  }

  function focusOnMount(node: HTMLInputElement) {
    node.focus();
    node.select();
  }
</script>

<svelte:window bind:innerWidth={viewportWidth} bind:innerHeight={viewportHeight} />

<div class="output" class:alt-background={altBackground}>
  <two-up class="two-up" legacy-clip-compat {orientation} bind:this={twoUp}>
    <pinch-zoom class="pinch-zoom" bind:this={pinchLeft} onchange={onLeftChange}>
      <canvas
        class="pinch-target"
        class:pixelated
        width={leftImage?.width}
        height={leftImage?.height}
        style={containStyle(leftContain)}
        bind:this={canvasLeft}
      ></canvas>
    </pinch-zoom>
    <pinch-zoom class="pinch-zoom" bind:this={pinchRight}>
      <canvas
        class="pinch-target"
        class:pixelated
        width={rightImage?.width}
        height={rightImage?.height}
        style={containStyle(rightContain)}
        bind:this={canvasRight}
      ></canvas>
    </pinch-zoom>
  </two-up>
</div>

  <div class="controls">
    <div class="button-group">
      <button
        class="button first-button"
        onclick={() => zoomTo(scale / 1.25)}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <svg class="icon" viewBox="0 0 24 24"
          ><path d="M19 13H5v-2h14v2z" /></svg
        >
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
          use:focusOnMount
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
    background: #000;
    opacity: 0.8;
    transition: opacity 500ms ease;
  }

  .output.alt-background::before {
    opacity: 0;
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
    background-color: rgba(29, 29, 29, 0.92);
    border: 1px solid rgba(0, 0, 0, 0.67);
    border-width: 1px 0 1px 1px;
    line-height: 1.1;
    white-space: nowrap;
    height: 39px;
    padding: 0 12px;
    font-size: 1.2rem;
    cursor: pointer;
    color: #fff;
  }

  .button {
    justify-content: center;
    min-width: 39px;
    padding: 0 7px;
  }

  .icon {
    display: block;
    width: 24px;
    height: 24px;
    fill: currentColor;
  }

  .button:hover {
    background: rgba(50, 50, 50, 0.92);
  }

  .button.active {
    background: rgba(72, 72, 72, 0.92);
  }

  .first-button {
    border-radius: 6px 0 0 6px;
  }

  .last-button {
    border-radius: 0 6px 6px 0;
    border-right-width: 1px;
  }

  .zoom {
    cursor: text;
    width: 7rem;
    font: inherit;
    text-align: center;
    justify-content: center;
  }

  span.zoom {
    color: #939393;
    font-size: 0.8rem;
    font-weight: 100;
  }

  .zoom-value {
    margin: 0 3px 0 0;
    padding: 0 2px;
    font-size: 1.2rem;
    letter-spacing: 0.05rem;
    font-weight: 700;
    color: #fff;
    border-bottom: 1px dashed #999;
  }

  input.zoom {
    font-size: 1.2rem;
    font-weight: 700;
    color: #fff;
    -moz-appearance: textfield;
    appearance: textfield;
  }

  input.zoom::-webkit-outer-spin-button,
  input.zoom::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
</style>
