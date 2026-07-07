// CropTool — the ONE shared state object for the porcelain-lab crop mode.
// CropStage (canvas + gestures) and CropPanel (porcelain controls) both take
// this instance; neither talks to the other directly. The geometry itself is
// pure (crop-geometry.ts); this class owns reactivity, constraints, and the
// decode/apply lifecycle. API contract:
// docs/specs/2026-07-07-porcelain-crop-tool.md.

import type {
  ConstrainMode,
  CropBackground,
  CropSnapshot,
  CropState,
  OverlayKind,
  OverlayShowMode,
} from './crop-types';
import {
  fitRectToRatio,
  initialState,
  moveRect,
  outputSize,
  setRectSize,
  withFlipH,
  withFlipV,
  withRotate90,
  withRotation,
  withStraighten,
} from './crop-geometry';
import { cropToPngFile } from './render-crop';

export class CropTool {
  readonly bitmap: ImageBitmap;
  // Declaration-time defaults keep TS happy about the $derived field
  // initializers below ($derived closures evaluate lazily, after the
  // constructor has assigned the real values).
  readonly imageWidth: number = 0;
  readonly imageHeight: number = 0;
  readonly fileName: string;

  state = $state<CropState>() as CropState;
  constrain = $state<ConstrainMode>({ kind: 'free' });
  background = $state<CropBackground>({ kind: 'transparent' });
  overlay = $state<OverlayKind>('thirds');
  overlayMode = $state<OverlayShowMode>('auto');

  /** Panel arms this; the stage's next click samples a pixel → background. */
  sampling = $state(false);
  /** True during any active gesture (drag OR slider scrub via notifyAdjust). */
  adjusting = $state(false);
  /** True while a rotate gesture is active (auto overlay shows Grid). */
  rotateGesture = $state(false);
  /**
   * Bumped on every rotation/flip-driven remap (NOT move/resize). The stage
   * watches it to keep the crop center screen-anchored across those remaps —
   * world space is image-anchored, so without compensation the composition
   * would drift on screen whenever θ changes.
   */
  transformEpoch = $state(0);

  #adjustTimer: ReturnType<typeof setTimeout> | null = null;

  outputWidth = $derived(outputSize(this.state.rect).w);
  outputHeight = $derived(outputSize(this.state.rect).h);

  /** Oriented image dims (swap at 90/270) — what "Original" ratio means. */
  orientedWidth = $derived(
    this.state.orientation % 180 === 0 ? this.imageWidth : this.imageHeight,
  );
  orientedHeight = $derived(
    this.state.orientation % 180 === 0 ? this.imageHeight : this.imageWidth,
  );

  activeRatio = $derived.by((): number | null => {
    const c = this.constrain;
    if (c.kind === 'free') return null;
    if (c.kind === 'original')
      return this.orientedWidth / Math.max(1, this.orientedHeight);
    return c.rw / Math.max(1e-6, c.rh);
  });

  isDefault = $derived.by(() => {
    const s = this.state;
    return (
      s.angleDeg === 0 &&
      s.orientation === 0 &&
      !s.flipH &&
      !s.flipV &&
      s.rect.cx === 0 &&
      s.rect.cy === 0 &&
      Math.round(s.rect.w) === this.imageWidth &&
      Math.round(s.rect.h) === this.imageHeight
    );
  });

  private constructor(bitmap: ImageBitmap, fileName: string) {
    this.bitmap = bitmap;
    this.imageWidth = bitmap.width;
    this.imageHeight = bitmap.height;
    this.fileName = fileName;
    this.state = initialState(bitmap.width, bitmap.height);
  }

  /** Decode the ORIGINAL file; optionally restore a previous crop session. */
  static async create(
    file: File,
    prior?: CropSnapshot | null,
  ): Promise<CropTool> {
    // 'from-image' matches the production decode path's EXIF handling.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: 'from-image',
    });
    const tool = new CropTool(bitmap, file.name);
    if (prior) {
      tool.state = structuredClone(prior.state);
      tool.constrain = structuredClone(prior.constrain);
      tool.background = structuredClone(prior.background);
      tool.overlay = prior.overlay;
      tool.overlayMode = prior.overlayMode;
    }
    return tool;
  }

  snapshot(): CropSnapshot {
    return {
      state: $state.snapshot(this.state) as CropState,
      constrain: $state.snapshot(this.constrain) as ConstrainMode,
      background: $state.snapshot(this.background) as CropBackground,
      overlay: this.overlay,
      overlayMode: this.overlayMode,
    };
  }

  applyToFile(): Promise<File> {
    return cropToPngFile(
      this.bitmap,
      $state.snapshot(this.state) as CropState,
      $state.snapshot(this.background) as CropBackground,
      this.fileName,
    );
  }

  dispose(): void {
    if (this.#adjustTimer !== null) clearTimeout(this.#adjustTimer);
    this.bitmap.close();
  }

  // ── Panel actions ─────────────────────────────────────────────────────────

  setConstrain(mode: ConstrainMode): void {
    this.constrain = mode;
    const ratio = this.activeRatio;
    if (ratio !== null)
      this.state.rect = fitRectToRatio(this.state.rect, ratio);
  }

  /** Exact output size (size presets / typing both fields). */
  setExactSize(w: number, h: number): void {
    this.constrain = { kind: 'free' };
    this.state.rect = setRectSize(this.state.rect, { w, h }, null);
  }

  setWidth(px: number): void {
    if (!Number.isFinite(px) || px < 1) return;
    this.state.rect = setRectSize(this.state.rect, { w: px }, this.activeRatio);
  }

  setHeight(px: number): void {
    if (!Number.isFinite(px) || px < 1) return;
    this.state.rect = setRectSize(this.state.rect, { h: px }, this.activeRatio);
  }

  setStraighten(deg: number): void {
    this.state = withStraighten(this.state, deg);
    this.transformEpoch += 1;
  }

  /** Interactive rotation (stage), folds overflow into orientation. */
  rotateBy(deltaDeg: number): void {
    this.state = withRotation(this.state, deltaDeg);
    this.transformEpoch += 1;
  }

  rotate90(dir: 1 | -1): void {
    this.state = withRotate90(this.state, dir);
    this.transformEpoch += 1;
  }

  flipHorizontal(): void {
    this.state = withFlipH(this.state);
    this.transformEpoch += 1;
  }

  flipVertical(): void {
    this.state = withFlipV(this.state);
    this.transformEpoch += 1;
  }

  moveRect(dx: number, dy: number): void {
    this.state.rect = moveRect(this.state.rect, dx, dy);
  }

  /** Slider/gesture activity ping; auto-clears 400ms after the last one. */
  notifyAdjust(): void {
    this.adjusting = true;
    if (this.#adjustTimer !== null) clearTimeout(this.#adjustTimer);
    this.#adjustTimer = setTimeout(() => {
      this.adjusting = false;
      this.#adjustTimer = null;
    }, 400);
  }

  reset(): void {
    this.state = initialState(this.imageWidth, this.imageHeight);
    this.constrain = { kind: 'free' };
  }
}
