<script lang="ts">
  // The crop workspace: a canvas painting the transformed image (checkerboard
  // or fill color inside the rect, porcelain scrim outside) plus an SVG layer
  // for the rect chrome (border, handles, guides, badges). The crop rect is
  // ALWAYS axis-aligned on screen; rotating visually rotates the IMAGE — the
  // view compensates pan on every transformEpoch bump so the crop center
  // stays screen-anchored (see crop-tool.svelte.ts).
  import { MediaQuery } from 'svelte/reactivity';
  import type { CropTool } from './crop-tool.svelte';
  import type { HandleId, Point, View } from './crop-types';
  import {
    DEFAULT_HIT_TOLERANCES,
    fitView,
    hitTest,
    imageToWorld,
    imageWorldCorners,
    moveRect,
    pointerAngleDeg,
    rectCorners,
    resizeRect,
    screenToWorld,
    worldToImage,
    worldToScreen,
    type HitResult,
    type Viewport,
  } from './crop-geometry';
  import { overlayGraphic } from './overlays';
  import { sampleImageColor } from './render-crop';

  interface Props {
    tool: CropTool;
  }

  let { tool }: Props = $props();

  const PANEL_GUTTER = 296 + 16 + 16; // panel width + right margin + gap
  const FIT_PADDING = 28;

  // Rotate cursor: white curved double-arrow with a dark outline (visible on
  // any image), hotspot centered.
  const ROTATE_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='22' height='22' viewBox='0 0 22 22'><g fill='none' stroke='black' stroke-width='4' stroke-linecap='round' stroke-linejoin='round' opacity='0.85'><path d='M5 8a7 7 0 0 1 12 0'/><path d='M17.4 4.2v4h-4'/><path d='M17 14a7 7 0 0 1-12 0'/><path d='M4.6 17.8v-4h4'/></g><g fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><path d='M5 8a7 7 0 0 1 12 0'/><path d='M17.4 4.2v4h-4'/><path d='M17 14a7 7 0 0 1-12 0'/><path d='M4.6 17.8v-4h4'/></g></svg>`,
  )}") 11 11, alias`;

  const darkScheme = new MediaQuery('(prefers-color-scheme: dark)');

  let rootEl = $state<HTMLDivElement>();
  let canvasEl = $state<HTMLCanvasElement>();
  let vw = $state(0);
  let vh = $state(0);
  let view = $state<View>({ scale: 1, tx: 0, ty: 0 });
  let hover = $state<HitResult>({ type: 'none' });

  // ── Gesture bookkeeping (non-reactive) ──────────────────────────────────
  type Gesture =
    | {
        type: 'resize';
        handle: HandleId;
        startRect: { cx: number; cy: number; w: number; h: number };
      }
    | {
        type: 'move';
        startRect: { cx: number; cy: number; w: number; h: number };
        startScreen: Point;
      }
    | { type: 'rotate'; startPointerAngle: number; startTotal: number };
  let gesture: Gesture | null = null;

  let rafId = 0;
  let lastCenter: Point | null = null;
  let lastEpoch = -1;

  const viewport = $derived.by((): Viewport => {
    if (vw <= 760) {
      // Compact layout: the panel becomes a bottom sheet (46dvh, like the
      // lab's other panels); keep the stage clear of it.
      return { x: 16, y: 16, w: vw - 32, h: vh - 16 - vh * 0.46 - 24 };
    }
    return { x: 24, y: 24, w: vw - 24 - PANEL_GUTTER - 16, h: vh - 48 };
  });

  const screenRect = $derived.by(() => {
    const r = tool.state.rect;
    const nw = worldToScreen(view, { x: r.cx - r.w / 2, y: r.cy - r.h / 2 });
    const se = worldToScreen(view, { x: r.cx + r.w / 2, y: r.cy + r.h / 2 });
    return { x: nw.x, y: nw.y, w: se.x - nw.x, h: se.y - nw.y };
  });

  const showEdgeHandles = $derived(Math.min(screenRect.w, screenRect.h) >= 56);

  const overlayVisible = $derived(
    tool.overlayMode === 'always' ||
      (tool.overlayMode === 'auto' && tool.adjusting),
  );
  const overlayKindActive = $derived(
    tool.rotateGesture && tool.overlayMode !== 'never' ? 'grid' : tool.overlay,
  );
  const guides = $derived(
    overlayVisible || tool.rotateGesture
      ? overlayGraphic(overlayKindActive, screenRect.w, screenRect.h)
      : { lines: [], paths: [] },
  );

  const angleLabel = $derived.by(() => {
    const a = tool.state.angleDeg;
    const shown = Math.round(a * 4) / 4;
    return `${shown === 0 ? '0' : shown.toFixed(2).replace(/\.?0+$/, '')}°`;
  });

  const cursor = $derived.by(() => {
    if (tool.sampling) return 'crosshair';
    const active = gesture ? gestureCursor(gesture) : null;
    if (active) return active;
    switch (hover.type) {
      case 'handle':
        return handleCursor(hover.handle);
      case 'rotate':
        return ROTATE_CURSOR;
      case 'move':
        return 'move';
      default:
        return 'default';
    }
  });

  function handleCursor(handle: HandleId): string {
    if (handle === 'nw' || handle === 'se') return 'nwse-resize';
    if (handle === 'ne' || handle === 'sw') return 'nesw-resize';
    if (handle === 'n' || handle === 's') return 'ns-resize';
    return 'ew-resize';
  }

  function gestureCursor(g: Gesture): string {
    if (g.type === 'resize') return handleCursor(g.handle);
    if (g.type === 'rotate') return ROTATE_CURSOR;
    return 'move';
  }

  // ── View management ──────────────────────────────────────────────────────

  function fitPoints(): Point[] {
    return [
      ...imageWorldCorners(tool.state, tool.imageWidth, tool.imageHeight),
      ...rectCorners(tool.state.rect),
    ];
  }

  function refit(animated: boolean) {
    if (viewport.w <= 0 || viewport.h <= 0) return;
    const target = fitView(fitPoints(), viewport, FIT_PADDING);
    cancelAnimationFrame(rafId);
    if (!animated) {
      view = target;
      return;
    }
    const from = { ...view };
    const start = performance.now();
    const duration = 160;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      view = {
        scale: from.scale + (target.scale - from.scale) * e,
        tx: from.tx + (target.tx - from.tx) * e,
        ty: from.ty + (target.ty - from.ty) * e,
      };
      if (t < 1) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
  }

  // Keep the crop center screen-anchored across rotation/flip remaps (the
  // remap moves the rect's WORLD coords; without this the composition jumps).
  $effect(() => {
    const epoch = tool.transformEpoch;
    const c = { x: tool.state.rect.cx, y: tool.state.rect.cy };
    if (epoch !== lastEpoch && lastCenter !== null) {
      const before = worldToScreen(view, lastCenter);
      const after = worldToScreen(view, c);
      view = {
        scale: view.scale,
        tx: view.tx + before.x - after.x,
        ty: view.ty + before.y - after.y,
      };
    }
    lastEpoch = epoch;
    lastCenter = c;
  });

  // Re-fit when geometry settles (never mid-gesture) and on viewport changes.
  let firstFit = true;
  $effect(() => {
    void tool.state.rect.w;
    void tool.state.rect.h;
    void tool.state.angleDeg;
    void tool.state.orientation;
    void viewport.w;
    void viewport.h;
    if (tool.adjusting) return;
    refit(!firstFit);
    firstFit = false;
  });

  // ── Canvas painting ──────────────────────────────────────────────────────

  let checkerLight: CanvasPattern | null = null;
  let checkerDark: CanvasPattern | null = null;

  function checkerPattern(ctx: CanvasRenderingContext2D, dark: boolean) {
    const cached = dark ? checkerDark : checkerLight;
    if (cached) return cached;
    const tile = document.createElement('canvas');
    tile.width = 16;
    tile.height = 16;
    const tctx = tile.getContext('2d')!;
    tctx.fillStyle = dark ? '#26262a' : '#ffffff';
    tctx.fillRect(0, 0, 16, 16);
    tctx.fillStyle = dark ? 'rgba(255,255,255,0.09)' : 'rgba(20,20,15,0.10)';
    tctx.fillRect(0, 0, 8, 8);
    tctx.fillRect(8, 8, 8, 8);
    const pattern = ctx.createPattern(tile, 'repeat')!;
    if (dark) checkerDark = pattern;
    else checkerLight = pattern;
    return pattern;
  }

  function scrimColor(): string {
    const host = rootEl?.closest('.app-root');
    if (host) {
      const bg = getComputedStyle(host).backgroundColor;
      const m = bg.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
      if (m) return `rgba(${m[1]}, ${m[2]}, ${m[3]}, 0.8)`;
    }
    return darkScheme.current
      ? 'rgba(19, 19, 21, 0.8)'
      : 'rgba(242, 241, 239, 0.8)';
  }

  $effect(() => {
    const canvas = canvasEl;
    if (!canvas || vw === 0 || vh === 0) return;
    // Reactive reads: full crop state, view, background, scheme.
    const { rect } = tool.state;
    const m = imageToWorld(tool.state, tool.imageWidth, tool.imageHeight);
    const background = tool.background;
    const dark = darkScheme.current;
    const v = view;

    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const bw = Math.round(vw * dpr);
    const bh = Math.round(vh * dpr);
    if (canvas.width !== bw) canvas.width = bw;
    if (canvas.height !== bh) canvas.height = bh;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, vw, vh);

    const sx = rect.cx * v.scale + v.tx - (rect.w * v.scale) / 2;
    const sy = rect.cy * v.scale + v.ty - (rect.h * v.scale) / 2;
    const sw = rect.w * v.scale;
    const sh = rect.h * v.scale;

    // 1. Empty-pixel preview inside the rect (checker or the chosen fill).
    if (background.kind === 'color') {
      ctx.fillStyle = background.css;
    } else {
      ctx.fillStyle = checkerPattern(ctx, dark);
    }
    ctx.fillRect(sx, sy, sw, sh);

    // 2. The image, view ∘ imageToWorld.
    ctx.save();
    ctx.translate(v.tx, v.ty);
    ctx.scale(v.scale, v.scale);
    ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(tool.bitmap, 0, 0);
    ctx.restore();

    // 3. Porcelain scrim outside the rect.
    ctx.fillStyle = scrimColor();
    ctx.beginPath();
    ctx.rect(0, 0, vw, vh);
    ctx.rect(sx, sy, sw, sh);
    ctx.fill('evenodd');
  });

  // ── Pointer interactions ─────────────────────────────────────────────────

  function eventPoint(event: PointerEvent): Point {
    const bounds = rootEl!.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  }

  function rectCenterScreen(): Point {
    return worldToScreen(view, {
      x: tool.state.rect.cx,
      y: tool.state.rect.cy,
    });
  }

  function totalAngle(): number {
    return tool.state.orientation + tool.state.angleDeg;
  }

  function onPointerDown(event: PointerEvent) {
    if (event.button !== 0 || gesture) return;
    const p = eventPoint(event);

    if (tool.sampling) {
      const world = screenToWorld(view, p);
      const img = worldToImage(tool.state, tool.imageWidth, tool.imageHeight);
      const ip = {
        x: img.a * world.x + img.c * world.y + img.e,
        y: img.b * world.x + img.d * world.y + img.f,
      };
      const color = sampleImageColor(tool.bitmap, ip.x, ip.y);
      if (color) {
        tool.background = { kind: 'color', css: color };
        tool.sampling = false;
      }
      return;
    }

    const hit = hitTest(tool.state.rect, view, p, DEFAULT_HIT_TOLERANCES);
    if (hit.type === 'none') return;

    const startRect = { ...tool.state.rect };
    if (hit.type === 'handle') {
      gesture = { type: 'resize', handle: hit.handle, startRect };
    } else if (hit.type === 'rotate') {
      gesture = {
        type: 'rotate',
        startPointerAngle: pointerAngleDeg(rectCenterScreen(), p),
        startTotal: totalAngle(),
      };
      tool.rotateGesture = true;
    } else {
      gesture = { type: 'move', startRect, startScreen: p };
    }
    tool.adjusting = true;
    rootEl!.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function onPointerMove(event: PointerEvent) {
    const p = eventPoint(event);
    if (!gesture) {
      hover = tool.sampling
        ? { type: 'none' }
        : hitTest(tool.state.rect, view, p, DEFAULT_HIT_TOLERANCES);
      return;
    }
    tool.adjusting = true;

    if (gesture.type === 'move') {
      const dx = (p.x - gesture.startScreen.x) / view.scale;
      const dy = (p.y - gesture.startScreen.y) / view.scale;
      tool.state.rect = moveRect(gesture.startRect, dx, dy);
      return;
    }

    if (gesture.type === 'resize') {
      const world = screenToWorld(view, p);
      const ratio =
        tool.activeRatio ??
        (event.shiftKey ? gesture.startRect.w / gesture.startRect.h : null);
      tool.state.rect = resizeRect(gesture.startRect, gesture.handle, world, {
        ratio,
        fromCenter: event.altKey,
      });
      return;
    }

    // Rotate: absolute target angle from the pointer sweep, then snapped.
    const sweep =
      pointerAngleDeg(rectCenterScreen(), p) - gesture.startPointerAngle;
    let target = gesture.startTotal + sweep;
    if (event.shiftKey) {
      target = Math.round(target / 15) * 15;
    } else {
      target = Math.round(target * 4) / 4;
      const near90 = Math.round(target / 90) * 90;
      if (Math.abs(target - near90) < 0.75) target = near90;
    }
    tool.rotateBy(target - totalAngle());
  }

  function onPointerUp(event: PointerEvent) {
    if (!gesture) return;
    gesture = null;
    tool.rotateGesture = false;
    tool.adjusting = false;
    if (rootEl?.hasPointerCapture(event.pointerId))
      rootEl.releasePointerCapture(event.pointerId);
  }

  function onKeydown(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable)
        return;
    }
    const step = event.shiftKey ? 10 : 1;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    else return;
    event.preventDefault();
    tool.state.rect = moveRect(tool.state.rect, dx, dy);
    tool.notifyAdjust();
  }

  $effect(() => {
    const root = rootEl;
    if (!root) return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box) return;
      vw = box.width;
      vh = box.height;
    });
    observer.observe(root);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
    };
  });
</script>

<svelte:window onkeydown={onKeydown} />

<!-- role=application: a pointer-driven canvas editor; keyboard nudges are
     handled globally (svelte:window) and Esc/Enter at the page level. -->
<div
  class="crop-stage"
  bind:this={rootEl}
  style:cursor
  role="application"
  aria-label="Crop area — drag edges to resize, outside corners to rotate"
  onpointerdown={onPointerDown}
  onpointermove={onPointerMove}
  onpointerup={onPointerUp}
  onpointercancel={onPointerUp}
>
  <canvas bind:this={canvasEl}></canvas>

  <svg class="chrome" width={vw} height={vh} aria-hidden="true">
    <g transform="translate({screenRect.x}, {screenRect.y})">
      {#if guides.lines.length > 0 || guides.paths.length > 0}
        <g class="guides">
          {#each guides.lines as line, i (i)}
            <line x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} />
          {/each}
          {#each guides.paths as d, i (i)}
            <path {d} />
          {/each}
        </g>
      {/if}

      <rect
        class="border"
        x="0"
        y="0"
        width={screenRect.w}
        height={screenRect.h}
      />

      <!-- Corner handles: porcelain white squircle chips. -->
      {#each [[0, 0], [screenRect.w, 0], [screenRect.w, screenRect.h], [0, screenRect.h]] as [hx, hy], i (i)}
        <rect
          class="handle"
          x={hx - 7}
          y={hy - 7}
          width="14"
          height="14"
          rx="4.5"
        />
      {/each}

      {#if showEdgeHandles}
        <rect
          class="handle"
          x={screenRect.w / 2 - 12}
          y={-3.5}
          width="24"
          height="7"
          rx="3.5"
        />
        <rect
          class="handle"
          x={screenRect.w / 2 - 12}
          y={screenRect.h - 3.5}
          width="24"
          height="7"
          rx="3.5"
        />
        <rect
          class="handle"
          x={-3.5}
          y={screenRect.h / 2 - 12}
          width="7"
          height="24"
          rx="3.5"
        />
        <rect
          class="handle"
          x={screenRect.w - 3.5}
          y={screenRect.h / 2 - 12}
          width="7"
          height="24"
          rx="3.5"
        />
      {/if}
    </g>
  </svg>

  {#if tool.adjusting && !tool.rotateGesture}
    <span
      class="badge"
      style:left="{screenRect.x + screenRect.w / 2}px"
      style:top="{Math.min(vh - 34, screenRect.y + screenRect.h + 12)}px"
    >
      {tool.outputWidth} × {tool.outputHeight}
    </span>
  {/if}
  {#if tool.rotateGesture}
    <span
      class="badge"
      style:left="{screenRect.x + screenRect.w / 2}px"
      style:top="{Math.max(10, screenRect.y - 34)}px"
    >
      {angleLabel}
    </span>
  {/if}
</div>

<style>
  .crop-stage {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }

  canvas,
  .chrome {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .chrome {
    pointer-events: none;
  }

  .guides line,
  .guides path {
    fill: none;
    stroke: rgba(255, 255, 255, 0.85);
    stroke-width: 1;
    filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.5));
  }

  .border {
    fill: none;
    stroke: #ffffff;
    stroke-width: 1.5;
    filter: drop-shadow(0 0 1.5px rgba(0, 0, 0, 0.55));
  }

  .handle {
    fill: #ffffff;
    stroke: rgba(20, 20, 15, 0.22);
    stroke-width: 1;
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.28));
  }

  .badge {
    position: absolute;
    transform: translateX(-50%);
    padding: 4px 9px;
    border-radius: 7px;
    background: var(--pc-tooltip-bg, #222226);
    color: var(--pc-tooltip-text, #fff);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    pointer-events: none;
  }
</style>
