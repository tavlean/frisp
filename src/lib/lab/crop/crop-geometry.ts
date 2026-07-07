// Pure geometry for the porcelain-lab crop tool. No DOM, no Svelte — every
// function is a value-in/value-out transform over the coordinate model fixed
// in docs/specs/2026-07-07-porcelain-crop-tool.md:
//
//   world = R(θ) · F · (p − imageCenter)     θ = orientation + angleDeg (CW, y-down)
//
// The crop rect is ALWAYS axis-aligned in world space; rotating/flipping is
// a change of the image's transform plus a matching remap of the rect so the
// content under the crop is preserved (rotate90/flip) or pivots around the
// crop center (straighten). Each remap here is derived from the matrix
// identities noted inline — change the model doc before changing these.

import type {
  CropRect,
  CropState,
  HandleId,
  Mat2d,
  Point,
  View,
} from './crop-types';

export const MIN_RECT_SIZE = 8;
export const MAX_OUTPUT_DIM = 16384;

const DEG = Math.PI / 180;

export function rotatePoint(p: Point, deg: number): Point {
  const r = deg * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  // Canvas convention: positive = clockwise with y-down.
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** image → world matrix (canvas {a,b,c,d,e,f} convention). */
export function imageToWorld(state: CropState, w: number, h: number): Mat2d {
  const r = (state.orientation + state.angleDeg) * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const fx = state.flipH ? -1 : 1;
  const fy = state.flipV ? -1 : 1;
  // R(θ)·F — flip first, then rotate.
  const a = cos * fx;
  const b = sin * fx;
  const c = -sin * fy;
  const d = cos * fy;
  const cx = w / 2;
  const cy = h / 2;
  return { a, b, c, d, e: -(a * cx + c * cy), f: -(b * cx + d * cy) };
}

/** world → image matrix: p = F·R(−θ)·world + imageCenter (F is self-inverse). */
export function worldToImage(state: CropState, w: number, h: number): Mat2d {
  const r = (state.orientation + state.angleDeg) * DEG;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const fx = state.flipH ? -1 : 1;
  const fy = state.flipV ? -1 : 1;
  // F·R(−θ): rows of R(−θ) scaled by F.
  return {
    a: cos * fx,
    b: -sin * fy,
    c: sin * fx,
    d: cos * fy,
    e: w / 2,
    f: h / 2,
  };
}

export function applyMat(m: Mat2d, p: Point): Point {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

/** The image's four corners in world space (nw, ne, se, sw in image terms). */
export function imageWorldCorners(
  state: CropState,
  w: number,
  h: number,
): Point[] {
  const m = imageToWorld(state, w, h);
  return [
    applyMat(m, { x: 0, y: 0 }),
    applyMat(m, { x: w, y: 0 }),
    applyMat(m, { x: w, y: h }),
    applyMat(m, { x: 0, y: h }),
  ];
}

/** Crop rect corners in world space: nw, ne, se, sw. */
export function rectCorners(rect: CropRect): Point[] {
  const x0 = rect.cx - rect.w / 2;
  const x1 = rect.cx + rect.w / 2;
  const y0 = rect.cy - rect.h / 2;
  const y1 = rect.cy + rect.h / 2;
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

export function initialState(imageW: number, imageH: number): CropState {
  return {
    rect: { cx: 0, cy: 0, w: imageW, h: imageH },
    angleDeg: 0,
    orientation: 0,
    flipH: false,
    flipV: false,
  };
}

// ── Rotation / flip remaps ─────────────────────────────────────────────────

/**
 * Fold angleDeg overflow into orientation, keeping θ = orientation + angleDeg
 * invariant. Pure relabeling — NO geometry change, so the rect is untouched.
 */
function foldAngle(state: CropState): CropState {
  let { angleDeg, orientation } = state;
  while (angleDeg > 45) {
    angleDeg -= 90;
    orientation = ((orientation + 90) % 360) as CropState['orientation'];
  }
  while (angleDeg <= -45) {
    angleDeg += 90;
    orientation = ((orientation + 270) % 360) as CropState['orientation'];
  }
  return { ...state, angleDeg, orientation };
}

/**
 * Rotate the image by deltaDeg with the CROP CENTER as pivot. Derivation: the
 * image point under the crop center is p₀ = T⁻¹(c); after θ → θ+Δ the same
 * point lands at R(Δ)·c, so the rect center follows it. Used by the
 * straighten slider AND interactive corner rotation (which then folds).
 */
export function withRotation(state: CropState, deltaDeg: number): CropState {
  if (deltaDeg === 0) return state;
  const c = rotatePoint({ x: state.rect.cx, y: state.rect.cy }, deltaDeg);
  return foldAngle({
    ...state,
    angleDeg: state.angleDeg + deltaDeg,
    rect: { ...state.rect, cx: c.x, cy: c.y },
  });
}

/** Set the straighten angle directly (slider). Input clamped to ±45. */
export function withStraighten(state: CropState, angleDeg: number): CropState {
  const clamped = Math.max(-45, Math.min(45, angleDeg));
  return withRotation(state, clamped - state.angleDeg);
}

/**
 * Rotate the WHOLE composition 90° (dir +1 = CW). T' = R(90·dir)·T, so the
 * rect rotates with the scene: center remaps by R(90·dir), w/h swap, and the
 * content under the crop is unchanged.
 */
export function withRotate90(state: CropState, dir: 1 | -1): CropState {
  const orientation = ((((state.orientation + 90 * dir) % 360) + 360) %
    360) as CropState['orientation'];
  const c = rotatePoint({ x: state.rect.cx, y: state.rect.cy }, 90 * dir);
  return {
    ...state,
    orientation,
    rect: { cx: c.x, cy: c.y, w: state.rect.h, h: state.rect.w },
  };
}

/**
 * Mirror the whole scene across the world vertical axis. Identity used:
 * M·R(θ) = R(−θ)·M, so θ negates, flipH toggles, and the rect center's x
 * negates. Content under the crop is preserved (mirrored).
 */
export function withFlipH(state: CropState): CropState {
  return {
    ...state,
    flipH: !state.flipH,
    angleDeg: -state.angleDeg === 0 ? 0 : -state.angleDeg,
    orientation: ((360 - state.orientation) % 360) as CropState['orientation'],
    rect: { ...state.rect, cx: -state.rect.cx },
  };
}

/** Mirror across the world horizontal axis; same identity with y. */
export function withFlipV(state: CropState): CropState {
  return {
    ...state,
    flipV: !state.flipV,
    angleDeg: -state.angleDeg === 0 ? 0 : -state.angleDeg,
    orientation: ((360 - state.orientation) % 360) as CropState['orientation'],
    rect: { ...state.rect, cy: -state.rect.cy },
  };
}

// ── Rect editing ───────────────────────────────────────────────────────────

export function moveRect(rect: CropRect, dx: number, dy: number): CropRect {
  // Deliberately unclamped: out-of-canvas cropping is a feature.
  return { ...rect, cx: rect.cx + dx, cy: rect.cy + dy };
}

export interface ResizeOptions {
  /** w/h ratio to hold, or null for free. */
  ratio: number | null;
  /** Resize symmetrically around the rect center (alt-drag). */
  fromCenter?: boolean;
  minSize?: number;
}

/**
 * Resize by dragging `handle` to world point `p`. Anchor = opposite corner
 * (corner handles) / opposite edge with the cross-axis center kept (edge
 * handles), or the rect center when fromCenter. The rect never inverts.
 */
export function resizeRect(
  rect: CropRect,
  handle: HandleId,
  p: Point,
  opts: ResizeOptions,
): CropRect {
  const min = opts.minSize ?? MIN_RECT_SIZE;
  const ratio = opts.ratio;
  const hasW = handle.includes('w');
  const hasE = handle.includes('e');
  const hasN = handle.includes('n');
  const hasS = handle.includes('s');
  const isCorner = (hasW || hasE) && (hasN || hasS);

  let x0 = rect.cx - rect.w / 2;
  let x1 = rect.cx + rect.w / 2;
  let y0 = rect.cy - rect.h / 2;
  let y1 = rect.cy + rect.h / 2;

  if (opts.fromCenter) {
    const { cx, cy } = rect;
    let halfW = rect.w / 2;
    let halfH = rect.h / 2;
    if (hasW || hasE) halfW = Math.max(min / 2, Math.abs(p.x - cx));
    if (hasN || hasS) halfH = Math.max(min / 2, Math.abs(p.y - cy));
    if (ratio !== null) {
      if (isCorner) {
        halfW = Math.max(halfW, halfH * ratio, min / 2, (min / 2) * ratio);
        halfH = halfW / ratio;
      } else if (hasW || hasE) {
        halfH = halfW / ratio;
      } else {
        halfW = halfH * ratio;
      }
    }
    return { cx, cy, w: halfW * 2, h: halfH * 2 };
  }

  if (ratio === null) {
    if (hasE) x1 = Math.max(p.x, x0 + min);
    if (hasW) x0 = Math.min(p.x, x1 - min);
    if (hasS) y1 = Math.max(p.y, y0 + min);
    if (hasN) y0 = Math.min(p.y, y1 - min);
    return fromEdges(x0, y0, x1, y1);
  }

  // Ratio-locked. Anchor and drag direction depend on the handle.
  if (isCorner) {
    const ax = hasE ? x0 : x1;
    const ay = hasS ? y0 : y1;
    const sx = hasE ? 1 : -1;
    const sy = hasS ? 1 : -1;
    const dx = Math.max(0, (p.x - ax) * sx);
    const dy = Math.max(0, (p.y - ay) * sy);
    let w = Math.max(dx, dy * ratio, min, min * ratio);
    const h = w / ratio;
    return fromEdges(
      sx > 0 ? ax : ax - w,
      sy > 0 ? ay : ay - h,
      sx > 0 ? ax + w : ax,
      sy > 0 ? ay + h : ay,
    );
  }

  if (hasE || hasW) {
    const ax = hasE ? x0 : x1;
    const sx = hasE ? 1 : -1;
    const w = Math.max((p.x - ax) * sx, min, min * ratio);
    const h = w / ratio;
    const cy = rect.cy;
    return fromEdges(
      sx > 0 ? ax : ax - w,
      cy - h / 2,
      sx > 0 ? ax + w : ax,
      cy + h / 2,
    );
  }

  const ay = hasS ? y0 : y1;
  const sy = hasS ? 1 : -1;
  const h = Math.max((p.y - ay) * sy, min, min / ratio);
  const w = h * ratio;
  const cx = rect.cx;
  return fromEdges(
    cx - w / 2,
    sy > 0 ? ay : ay - h,
    cx + w / 2,
    sy > 0 ? ay + h : ay,
  );
}

function fromEdges(x0: number, y0: number, x1: number, y1: number): CropRect {
  return {
    cx: (x0 + x1) / 2,
    cy: (y0 + y1) / 2,
    w: x1 - x0,
    h: y1 - y0,
  };
}

/** Re-fit the rect to a ratio, keeping center and area (constrain switch). */
export function fitRectToRatio(rect: CropRect, ratio: number): CropRect {
  const area = rect.w * rect.h;
  const w = Math.sqrt(area * ratio);
  return { ...rect, w, h: w / ratio };
}

/** Set exact size, keeping the center. Ratio (if any) follows the set axis. */
export function setRectSize(
  rect: CropRect,
  size: { w?: number; h?: number },
  ratio: number | null,
): CropRect {
  let { w, h } = rect;
  if (size.w !== undefined) {
    w = Math.max(1, size.w);
    if (ratio !== null && size.h === undefined) h = w / ratio;
  }
  if (size.h !== undefined) {
    h = Math.max(1, size.h);
    if (ratio !== null && size.w === undefined) w = h * ratio;
  }
  return { ...rect, w, h };
}

export function outputSize(rect: CropRect): { w: number; h: number } {
  return {
    w: Math.min(MAX_OUTPUT_DIM, Math.max(1, Math.round(rect.w))),
    h: Math.min(MAX_OUTPUT_DIM, Math.max(1, Math.round(rect.h))),
  };
}

/**
 * Snap the rect to the IMAGE pixel grid (apply-time, angleDeg === 0 only) so
 * a pure crop stays resample-free. Snapping happens in image space — with an
 * odd-dimension image the world grid sits at half-pixel offsets, which is
 * exactly the blur this avoids.
 */
export function snapRectToPixels(
  state: CropState,
  imageW: number,
  imageH: number,
): CropState {
  if (state.angleDeg !== 0) return state;
  const toImg = worldToImage(state, imageW, imageH);
  const toWorld = imageToWorld(state, imageW, imageH);
  const corners = rectCorners(state.rect);
  const p0 = applyMat(toImg, corners[0]);
  const p1 = applyMat(toImg, corners[2]);
  const r0 = { x: Math.round(p0.x), y: Math.round(p0.y) };
  const r1 = { x: Math.round(p1.x), y: Math.round(p1.y) };
  // Guard degenerate rounding (sub-pixel rects).
  if (r0.x === r1.x) r1.x += p1.x >= p0.x ? 1 : -1;
  if (r0.y === r1.y) r1.y += p1.y >= p0.y ? 1 : -1;
  const w0 = applyMat(toWorld, r0);
  const w1 = applyMat(toWorld, r1);
  return {
    ...state,
    rect: fromEdges(
      Math.min(w0.x, w1.x),
      Math.min(w0.y, w1.y),
      Math.max(w0.x, w1.x),
      Math.max(w0.y, w1.y),
    ),
  };
}

// ── View fitting & hit testing (screen space) ──────────────────────────────

export interface Viewport {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Fit a world bbox of `points` into the viewport (uniform scale + center). */
export function fitView(
  points: Point[],
  viewport: Viewport,
  padding = 40,
  maxScale = 4,
): View {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const bw = Math.max(1e-6, maxX - minX);
  const bh = Math.max(1e-6, maxY - minY);
  const availW = Math.max(24, viewport.w - padding * 2);
  const availH = Math.max(24, viewport.h - padding * 2);
  const scale = Math.min(maxScale, availW / bw, availH / bh);
  return {
    scale,
    tx: viewport.x + viewport.w / 2 - scale * (minX + bw / 2),
    ty: viewport.y + viewport.h / 2 - scale * (minY + bh / 2),
  };
}

export function worldToScreen(view: View, p: Point): Point {
  return { x: p.x * view.scale + view.tx, y: p.y * view.scale + view.ty };
}

export function screenToWorld(view: View, p: Point): Point {
  return { x: (p.x - view.tx) / view.scale, y: (p.y - view.ty) / view.scale };
}

export type HitResult =
  | { type: 'handle'; handle: HandleId }
  | { type: 'rotate'; corner: HandleId }
  | { type: 'move' }
  | { type: 'none' };

export interface HitTolerances {
  corner: number;
  edge: number;
  rotate: number;
}

export const DEFAULT_HIT_TOLERANCES: HitTolerances = {
  corner: 12,
  edge: 9,
  rotate: 30,
};

/**
 * Hit test in SCREEN space (the rect is axis-aligned there). Priority:
 * corner handle > edge handle > rotate annulus (outside, near a corner) >
 * inside (move) > none.
 */
export function hitTest(
  rect: CropRect,
  view: View,
  p: Point,
  tol: HitTolerances = DEFAULT_HIT_TOLERANCES,
): HitResult {
  const nw = worldToScreen(view, {
    x: rect.cx - rect.w / 2,
    y: rect.cy - rect.h / 2,
  });
  const se = worldToScreen(view, {
    x: rect.cx + rect.w / 2,
    y: rect.cy + rect.h / 2,
  });
  const corners: { id: HandleId; x: number; y: number }[] = [
    { id: 'nw', x: nw.x, y: nw.y },
    { id: 'ne', x: se.x, y: nw.y },
    { id: 'se', x: se.x, y: se.y },
    { id: 'sw', x: nw.x, y: se.y },
  ];

  let nearest: HandleId = 'nw';
  let nearestDist = Infinity;
  for (const c of corners) {
    const d = Math.hypot(p.x - c.x, p.y - c.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = c.id;
    }
  }
  if (nearestDist <= tol.corner) return { type: 'handle', handle: nearest };

  const inX = p.x >= nw.x && p.x <= se.x;
  const inY = p.y >= nw.y && p.y <= se.y;
  if (inY) {
    if (Math.abs(p.x - nw.x) <= tol.edge)
      return { type: 'handle', handle: 'w' };
    if (Math.abs(p.x - se.x) <= tol.edge)
      return { type: 'handle', handle: 'e' };
  }
  if (inX) {
    if (Math.abs(p.y - nw.y) <= tol.edge)
      return { type: 'handle', handle: 'n' };
    if (Math.abs(p.y - se.y) <= tol.edge)
      return { type: 'handle', handle: 's' };
  }

  const inside = inX && inY;
  if (!inside && nearestDist <= tol.rotate)
    return { type: 'rotate', corner: nearest };
  if (inside) return { type: 'move' };
  return { type: 'none' };
}

/** Angle (deg) of `p` around `center` for interactive rotation gestures. */
export function pointerAngleDeg(center: Point, p: Point): number {
  return Math.atan2(p.y - center.y, p.x - center.x) / DEG;
}
