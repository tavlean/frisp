// Shared types for the porcelain-lab crop tool. Pure declarations — no DOM,
// no Svelte. The coordinate model these types live in is specified in
// docs/specs/2026-07-07-porcelain-crop-tool.md and is FIXED: world space is
// y-down, image center at the origin, `world = R(θ)·F·(p − center)` with
// θ = orientation + angleDeg (degrees, clockwise-positive) and flips applied
// BEFORE rotation. The crop rect is always axis-aligned in world space.

/** Axis-aligned crop rect in world coordinates (center + size, world px). */
export interface CropRect {
  cx: number;
  cy: number;
  w: number;
  h: number;
}

export interface CropState {
  rect: CropRect;
  /** Straighten angle, kept in (−45, 45]; overflow folds into orientation. */
  angleDeg: number;
  orientation: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
}

export type ConstrainMode =
  | { kind: 'free' }
  | { kind: 'original' }
  | { kind: 'ratio'; rw: number; rh: number; custom?: boolean };

export type CropBackground =
  | { kind: 'transparent' }
  | { kind: 'color'; css: string };

export type OverlayKind =
  | 'thirds'
  | 'grid'
  | 'diagonal'
  | 'triangle'
  | 'goldenRatio'
  | 'goldenSpiral'
  | 'center';

export type OverlayShowMode = 'auto' | 'always' | 'never';

/** The 8 resize handles, named by compass direction. */
export type HandleId = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/** Everything needed to restore a crop session over the original image. */
export interface CropSnapshot {
  state: CropState;
  constrain: ConstrainMode;
  background: CropBackground;
  overlay: OverlayKind;
  overlayMode: OverlayShowMode;
}

/** 2×3 affine matrix, column convention matching canvas setTransform. */
export interface Mat2d {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export interface Point {
  x: number;
  y: number;
}

/** World→screen view: uniform scale + pan, never rotation. */
export interface View {
  scale: number;
  tx: number;
  ty: number;
}
