import { describe, expect, it } from 'vitest';

import {
  applyMat,
  fitRectToRatio,
  hitTest,
  imageToWorld,
  outputSize,
  resizeRect,
  rectCorners,
  snapRectToPixels,
  withFlipH,
  withFlipV,
  withRotate90,
  withRotation,
  worldToImage,
} from '../../src/lib/lab/crop/crop-geometry';
import type {
  CropRect,
  CropState,
  Point,
} from '../../src/lib/lab/crop/crop-types';

const precision = 6;

function expectPointClose(actual: Point, expected: Point) {
  expect(actual.x).toBeCloseTo(expected.x, precision);
  expect(actual.y).toBeCloseTo(expected.y, precision);
}

function expectRectClose(actual: CropRect, expected: CropRect) {
  expect(actual.cx).toBeCloseTo(expected.cx, precision);
  expect(actual.cy).toBeCloseTo(expected.cy, precision);
  expect(actual.w).toBeCloseTo(expected.w, precision);
  expect(actual.h).toBeCloseTo(expected.h, precision);
}

function totalAngleMod(state: CropState) {
  return (((state.orientation + state.angleDeg) % 360) + 360) % 360;
}

describe('crop geometry', () => {
  it('imageToWorld and worldToImage are inverses across rotations, orientation, and flips', () => {
    const states: CropState[] = [
      {
        rect: { cx: 0, cy: 0, w: 120, h: 60 },
        angleDeg: 30,
        orientation: 90,
        flipH: false,
        flipV: false,
      },
      {
        rect: { cx: 10, cy: -20, w: 120, h: 60 },
        angleDeg: 30,
        orientation: 90,
        flipH: true,
        flipV: false,
      },
      {
        rect: { cx: -25, cy: 30, w: 120, h: 60 },
        angleDeg: 30,
        orientation: 90,
        flipH: false,
        flipV: true,
      },
      {
        rect: { cx: 15, cy: 5, w: 120, h: 60 },
        angleDeg: 30,
        orientation: 90,
        flipH: true,
        flipV: true,
      },
    ];
    const points: Point[] = [
      { x: 0, y: 0 },
      { x: 200, y: 100 },
      { x: 73.25, y: 81.5 },
      { x: 12.125, y: 44.75 },
    ];

    for (const state of states) {
      const toWorld = imageToWorld(state, 200, 100);
      const toImage = worldToImage(state, 200, 100);

      for (const point of points) {
        expectPointClose(applyMat(toImage, applyMat(toWorld, point)), point);
      }
    }
  });

  it('withRotation pivots on the crop center', () => {
    const state: CropState = {
      rect: { cx: 40, cy: -20, w: 100, h: 80 },
      angleDeg: 0,
      orientation: 0,
      flipH: false,
      flipV: false,
    };

    const before = applyMat(worldToImage(state, 400, 300), {
      x: state.rect.cx,
      y: state.rect.cy,
    });
    const next = withRotation(state, 17);
    const after = applyMat(worldToImage(next, 400, 300), {
      x: next.rect.cx,
      y: next.rect.cy,
    });

    expectPointClose(after, before);
  });

  it('folds angle overflow into orientation while preserving total theta', () => {
    const state: CropState = {
      rect: { cx: 12, cy: -8, w: 100, h: 80 },
      angleDeg: 0,
      orientation: 0,
      flipH: false,
      flipV: false,
    };

    const positive = withRotation(state, 50);
    expect(positive.angleDeg).toBeCloseTo(-40, precision);
    expect(positive.orientation).toBe(90);
    expect(totalAngleMod(positive)).toBeCloseTo(50, precision);
    expect(positive.angleDeg).toBeGreaterThan(-45);
    expect(positive.angleDeg).toBeLessThanOrEqual(45);

    const negative = withRotation(state, -50);
    expect(negative.angleDeg).toBeCloseTo(40, precision);
    expect(negative.orientation).toBe(270);
    expect(totalAngleMod(negative)).toBeCloseTo(310, precision);
    expect(negative.angleDeg).toBeGreaterThan(-45);
    expect(negative.angleDeg).toBeLessThanOrEqual(45);
  });

  it('withRotate90 preserves content under the crop center, swaps dimensions, and cycles after four turns', () => {
    const state: CropState = {
      rect: { cx: 40, cy: -20, w: 100, h: 80 },
      angleDeg: 13,
      orientation: 0,
      flipH: false,
      flipV: false,
    };

    const before = applyMat(worldToImage(state, 400, 300), {
      x: state.rect.cx,
      y: state.rect.cy,
    });
    const once = withRotate90(state, 1);
    const after = applyMat(worldToImage(once, 400, 300), {
      x: once.rect.cx,
      y: once.rect.cy,
    });

    expectPointClose(after, before);
    expect(once.rect.w).toBeCloseTo(state.rect.h, precision);
    expect(once.rect.h).toBeCloseTo(state.rect.w, precision);
    expect(once.orientation).toBe(90);

    const four = withRotate90(withRotate90(withRotate90(once, 1), 1), 1);
    expectRectClose(four.rect, state.rect);
    expect(four.angleDeg).toBeCloseTo(state.angleDeg, precision);
    expect(four.orientation).toBe(state.orientation);
    expect(four.flipH).toBe(state.flipH);
    expect(four.flipV).toBe(state.flipV);
  });

  it('withFlipH toggles horizontally, preserves crop center content, and is identity after two flips', () => {
    const state: CropState = {
      rect: { cx: 40, cy: -20, w: 100, h: 80 },
      angleDeg: 0,
      orientation: 0,
      flipH: false,
      flipV: false,
    };

    const flipped = withFlipH(state);
    const restored = withFlipH(flipped);
    expectRectClose(restored.rect, state.rect);
    expect(restored.angleDeg).toBeCloseTo(state.angleDeg, precision);
    expect(restored.orientation).toBe(state.orientation);
    expect(restored.flipH).toBe(state.flipH);

    expect(flipped.rect.cx).toBeCloseTo(-state.rect.cx, precision);
    expect(flipped.angleDeg).toBeCloseTo(-state.angleDeg, precision);
    expect(flipped.flipH).toBe(true);

    const oldPoint = applyMat(worldToImage(state, 400, 300), {
      x: state.rect.cx,
      y: state.rect.cy,
    });
    const newPoint = applyMat(worldToImage(flipped, 400, 300), {
      x: flipped.rect.cx,
      y: flipped.rect.cy,
    });
    expect(newPoint.x).toBeCloseTo(oldPoint.x, precision);
    expect(newPoint.y).toBeCloseTo(oldPoint.y, precision);
  });

  it('withFlipV toggles vertically, preserves crop center content, and is identity after two flips', () => {
    const state: CropState = {
      rect: { cx: 40, cy: -20, w: 100, h: 80 },
      angleDeg: 0,
      orientation: 0,
      flipH: false,
      flipV: false,
    };

    const flipped = withFlipV(state);
    const restored = withFlipV(flipped);
    expectRectClose(restored.rect, state.rect);
    expect(restored.angleDeg).toBeCloseTo(state.angleDeg, precision);
    expect(restored.orientation).toBe(state.orientation);
    expect(restored.flipV).toBe(state.flipV);

    expect(flipped.rect.cy).toBeCloseTo(-state.rect.cy, precision);
    expect(flipped.angleDeg).toBeCloseTo(-state.angleDeg, precision);
    expect(flipped.flipV).toBe(true);

    const oldPoint = applyMat(worldToImage(state, 400, 300), {
      x: state.rect.cx,
      y: state.rect.cy,
    });
    const newPoint = applyMat(worldToImage(flipped, 400, 300), {
      x: flipped.rect.cx,
      y: flipped.rect.cy,
    });
    expect(newPoint.x).toBeCloseTo(oldPoint.x, precision);
    expect(newPoint.y).toBeCloseTo(oldPoint.y, precision);
  });

  it('resizeRect supports free, min-size, ratio-locked, edge, and from-center resizing', () => {
    const rect: CropRect = { cx: 0, cy: 0, w: 100, h: 80 };

    expectRectClose(resizeRect(rect, 'se', { x: 70, y: 50 }, { ratio: null }), {
      cx: 10,
      cy: 5,
      w: 120,
      h: 90,
    });
    expectRectClose(
      resizeRect(rect, 'se', { x: -80, y: -80 }, { ratio: null }),
      { cx: -46, cy: -36, w: 8, h: 8 },
    );

    const locked = resizeRect(rect, 'se', { x: 70, y: 0 }, { ratio: 2 });
    expect(locked.w / locked.h).toBeCloseTo(2, precision);
    expect(locked.cx - locked.w / 2).toBeCloseTo(-50, precision);
    expect(locked.cy - locked.h / 2).toBeCloseTo(-40, precision);

    const edge = resizeRect(rect, 'e', { x: 90, y: 999 }, { ratio: 2 });
    expect(edge.w / edge.h).toBeCloseTo(2, precision);
    expect(edge.cy).toBeCloseTo(rect.cy, precision);

    const centered = resizeRect(
      rect,
      'se',
      { x: 90, y: 70 },
      { ratio: null, fromCenter: true },
    );
    expect(centered.cx).toBeCloseTo(rect.cx, precision);
    expect(centered.cy).toBeCloseTo(rect.cy, precision);
    expect(centered.w).toBeCloseTo(180, precision);
    expect(centered.h).toBeCloseTo(140, precision);
  });

  it('fitRectToRatio keeps center and area while matching the ratio', () => {
    const rect: CropRect = { cx: 12, cy: -18, w: 120, h: 80 };
    const fitted = fitRectToRatio(rect, 16 / 9);

    expect(fitted.cx).toBeCloseTo(rect.cx, precision);
    expect(fitted.cy).toBeCloseTo(rect.cy, precision);
    expect(fitted.w * fitted.h).toBeCloseTo(rect.w * rect.h, precision);
    expect(fitted.w / fitted.h).toBeCloseTo(16 / 9, precision);
  });

  it('snapRectToPixels snaps pure orientations to integer image corners and leaves angled states unchanged', () => {
    const state: CropState = {
      rect: { cx: 3.2, cy: -4.7, w: 101.3, h: 79.8 },
      angleDeg: 0,
      orientation: 90,
      flipH: false,
      flipV: false,
    };
    const snapped = snapRectToPixels(state, 301, 201);

    for (const corner of rectCorners(snapped.rect)) {
      const imagePoint = applyMat(worldToImage(snapped, 301, 201), corner);
      expect(imagePoint.x).toBeCloseTo(Math.round(imagePoint.x), precision);
      expect(imagePoint.y).toBeCloseTo(Math.round(imagePoint.y), precision);
    }

    const angled: CropState = { ...state, angleDeg: 5 };
    expect(snapRectToPixels(angled, 301, 201)).toBe(angled);
  });

  it('hitTest prioritizes handles, edges, rotation, move, and none', () => {
    const view = { scale: 1, tx: 0, ty: 0 };
    const rect: CropRect = { cx: 0, cy: 0, w: 200, h: 100 };

    expect(hitTest(rect, view, { x: -100, y: -50 })).toEqual({
      type: 'handle',
      handle: 'nw',
    });
    expect(hitTest(rect, view, { x: 0, y: -50 })).toEqual({
      type: 'handle',
      handle: 'n',
    });
    expect(hitTest(rect, view, { x: -115, y: -60 })).toEqual({
      type: 'rotate',
      corner: 'nw',
    });
    expect(hitTest(rect, view, { x: 0, y: 0 })).toEqual({ type: 'move' });
    expect(hitTest(rect, view, { x: -200, y: -200 })).toEqual({ type: 'none' });
  });

  it('outputSize rounds and clamps to the output bounds', () => {
    expect(outputSize({ cx: 0, cy: 0, w: 0.2, h: -4 })).toEqual({ w: 1, h: 1 });
    expect(outputSize({ cx: 0, cy: 0, w: 123.6, h: 45.4 })).toEqual({
      w: 124,
      h: 45,
    });
    expect(outputSize({ cx: 0, cy: 0, w: 20000, h: 16384.6 })).toEqual({
      w: 16384,
      h: 16384,
    });
  });
});
