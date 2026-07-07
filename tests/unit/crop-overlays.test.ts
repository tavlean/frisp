import { describe, expect, it } from 'vitest';

import { overlayGraphic } from '../../src/lib/lab/crop/overlays';

describe('overlayGraphic', () => {
  it('returns thirds lines for 300x150', () => {
    expect(overlayGraphic('thirds', 300, 150)).toEqual({
      lines: [
        { x1: 100, y1: 0, x2: 100, y2: 150 },
        { x1: 200, y1: 0, x2: 200, y2: 150 },
        { x1: 0, y1: 50, x2: 300, y2: 50 },
        { x1: 0, y1: 100, x2: 300, y2: 100 },
      ],
      paths: [],
    });
  });

  it('returns grid lines at square cell intervals', () => {
    const graphic = overlayGraphic('grid', 1200, 600);

    expect(graphic.paths).toEqual([]);
    expect(
      graphic.lines.filter((line) => line.y1 === 0 && line.y2 === 600),
    ).toHaveLength(11);
    expect(
      graphic.lines.filter((line) => line.x1 === 0 && line.x2 === 1200),
    ).toHaveLength(5);
  });

  it('returns diagonal guide endpoints', () => {
    expect(overlayGraphic('diagonal', 200, 100)).toEqual({
      lines: [
        { x1: 0, y1: 0, x2: 100, y2: 100 },
        { x1: 200, y1: 0, x2: 100, y2: 100 },
        { x1: 0, y1: 100, x2: 100, y2: 0 },
        { x1: 200, y1: 100, x2: 100, y2: 0 },
      ],
      paths: [],
    });
  });

  it('projects triangle perpendicular feet onto the main diagonal', () => {
    const { lines } = overlayGraphic('triangle', 300, 200);
    const [, topRightPerpendicular, bottomLeftPerpendicular] = lines;

    for (const line of [topRightPerpendicular, bottomLeftPerpendicular]) {
      const tx = line.x2 / 300;
      const ty = line.y2 / 200;

      expect(tx).toBeGreaterThanOrEqual(0);
      expect(tx).toBeLessThanOrEqual(1);
      expect(ty).toBeCloseTo(tx);
    }
  });

  it('returns golden ratio line positions', () => {
    expect(overlayGraphic('goldenRatio', 1000, 500)).toEqual({
      lines: [
        { x1: 382, y1: 0, x2: 382, y2: 500 },
        { x1: 618, y1: 0, x2: 618, y2: 500 },
        { x1: 0, y1: 191, x2: 1000, y2: 191 },
        { x1: 0, y1: 309, x2: 1000, y2: 309 },
      ],
      paths: [],
    });
  });

  it('returns one finite golden spiral path', () => {
    const graphic = overlayGraphic('goldenSpiral', 300, 200);

    expect(graphic.lines).toEqual([]);
    expect(graphic.paths).toHaveLength(1);
    expect(graphic.paths[0].startsWith('M')).toBe(true);
    expect(graphic.paths[0]).not.toContain('NaN');
  });

  it('returns center lines', () => {
    expect(overlayGraphic('center', 80, 60)).toEqual({
      lines: [
        { x1: 40, y1: 0, x2: 40, y2: 60 },
        { x1: 0, y1: 30, x2: 80, y2: 30 },
      ],
      paths: [],
    });
  });

  it('returns empty graphics for zero or negative sizes', () => {
    expect(overlayGraphic('thirds', 0, 100)).toEqual({ lines: [], paths: [] });
    expect(overlayGraphic('center', 100, 0)).toEqual({ lines: [], paths: [] });
    expect(overlayGraphic('goldenSpiral', -1, 100)).toEqual({
      lines: [],
      paths: [],
    });
    expect(overlayGraphic('grid', 100, -1)).toEqual({ lines: [], paths: [] });
  });
});
