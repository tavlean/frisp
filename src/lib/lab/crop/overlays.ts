// Crop guide overlay geometry consumed by the porcelain lab CropStage.
import type { OverlayKind } from './crop-types';

export interface OverlayLine {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface OverlayGraphic {
  lines: OverlayLine[];
  paths: string[];
}

const EMPTY: OverlayGraphic = { lines: [], paths: [] };
const PHI = (1 + Math.sqrt(5)) / 2;

export function overlayGraphic(
  kind: OverlayKind,
  w: number,
  h: number,
): OverlayGraphic {
  if (w <= 0 || h <= 0) return EMPTY;

  switch (kind) {
    case 'thirds':
      return {
        lines: [
          { x1: w / 3, y1: 0, x2: w / 3, y2: h },
          { x1: (2 * w) / 3, y1: 0, x2: (2 * w) / 3, y2: h },
          { x1: 0, y1: h / 3, x2: w, y2: h / 3 },
          { x1: 0, y1: (2 * h) / 3, x2: w, y2: (2 * h) / 3 },
        ],
        paths: [],
      };
    case 'grid':
      return gridOverlay(w, h);
    case 'diagonal': {
      const m = Math.min(w, h);
      return {
        lines: [
          { x1: 0, y1: 0, x2: m, y2: m },
          { x1: w, y1: 0, x2: w - m, y2: m },
          { x1: 0, y1: h, x2: m, y2: h - m },
          { x1: w, y1: h, x2: w - m, y2: h - m },
        ],
        paths: [],
      };
    }
    case 'triangle':
      return triangleOverlay(w, h);
    case 'goldenRatio':
      return {
        lines: [
          { x1: w * 0.382, y1: 0, x2: w * 0.382, y2: h },
          { x1: w * 0.618, y1: 0, x2: w * 0.618, y2: h },
          { x1: 0, y1: h * 0.382, x2: w, y2: h * 0.382 },
          { x1: 0, y1: h * 0.618, x2: w, y2: h * 0.618 },
        ],
        paths: [],
      };
    case 'goldenSpiral':
      return { lines: [], paths: [goldenSpiralPath(w, h)] };
    case 'center':
      return {
        lines: [
          { x1: w / 2, y1: 0, x2: w / 2, y2: h },
          { x1: 0, y1: h / 2, x2: w, y2: h / 2 },
        ],
        paths: [],
      };
  }
}

function gridOverlay(w: number, h: number): OverlayGraphic {
  const cell = Math.max(w, h) / 12;
  const lines: OverlayLine[] = [];

  for (let x = cell; x < w; x += cell) {
    lines.push({ x1: x, y1: 0, x2: x, y2: h });
  }

  for (let y = cell; y < h; y += cell) {
    lines.push({ x1: 0, y1: y, x2: w, y2: y });
  }

  return { lines, paths: [] };
}

function triangleOverlay(w: number, h: number): OverlayGraphic {
  const denom = w * w + h * h;
  const footFromTopRight = projectOntoDiagonal(w, 0, w, h, denom);
  const footFromBottomLeft = projectOntoDiagonal(0, h, w, h, denom);

  return {
    lines: [
      { x1: 0, y1: 0, x2: w, y2: h },
      { x1: w, y1: 0, x2: footFromTopRight.x, y2: footFromTopRight.y },
      { x1: 0, y1: h, x2: footFromBottomLeft.x, y2: footFromBottomLeft.y },
    ],
    paths: [],
  };
}

function projectOntoDiagonal(
  px: number,
  py: number,
  w: number,
  h: number,
  denom: number,
): { x: number; y: number } {
  const t = (px * w + py * h) / denom;
  return { x: t * w, y: t * h };
}

function goldenSpiralPath(w: number, h: number): string {
  const scaleX = w / PHI;
  const scaleY = h;
  let rect = { x: 0, y: 0, w: PHI, h: 1 };
  const segments: string[] = [];

  for (let i = 0; i < 10; i += 1) {
    const dir = i % 4;
    const square = nextGoldenSquare(rect, dir);
    const arc = squareArc(square.x, square.y, square.size, dir, scaleX, scaleY);

    if (i === 0) {
      segments.push(`M ${arc.startX} ${arc.startY}`);
    }

    segments.push(
      `A ${arc.rx} ${arc.ry} 0 0 ${arc.sweep} ${arc.endX} ${arc.endY}`,
    );
    rect = square.remainder;
  }

  return segments.join(' ');
}

function nextGoldenSquare(
  rect: { x: number; y: number; w: number; h: number },
  dir: number,
): {
  x: number;
  y: number;
  size: number;
  remainder: { x: number; y: number; w: number; h: number };
} {
  const size = Math.min(rect.w, rect.h);

  switch (dir) {
    case 0:
      return {
        x: rect.x,
        y: rect.y,
        size,
        remainder: { x: rect.x + size, y: rect.y, w: rect.w - size, h: rect.h },
      };
    case 1:
      return {
        x: rect.x,
        y: rect.y,
        size,
        remainder: { x: rect.x, y: rect.y + size, w: rect.w, h: rect.h - size },
      };
    case 2:
      return {
        x: rect.x + rect.w - size,
        y: rect.y,
        size,
        remainder: { x: rect.x, y: rect.y, w: rect.w - size, h: rect.h },
      };
    default:
      return {
        x: rect.x,
        y: rect.y + rect.h - size,
        size,
        remainder: { x: rect.x, y: rect.y, w: rect.w, h: rect.h - size },
      };
  }
}

function squareArc(
  x: number,
  y: number,
  size: number,
  dir: number,
  scaleX: number,
  scaleY: number,
): {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  rx: number;
  ry: number;
  sweep: 0 | 1;
} {
  const sx = (value: number) => value * scaleX;
  const sy = (value: number) => value * scaleY;
  const rx = size * scaleX;
  const ry = size * scaleY;

  switch (dir) {
    case 0:
      return {
        startX: sx(x),
        startY: sy(y + size),
        endX: sx(x + size),
        endY: sy(y),
        rx,
        ry,
        sweep: 0,
      };
    case 1:
      return {
        startX: sx(x),
        startY: sy(y),
        endX: sx(x + size),
        endY: sy(y + size),
        rx,
        ry,
        sweep: 0,
      };
    case 2:
      return {
        startX: sx(x + size),
        startY: sy(y),
        endX: sx(x),
        endY: sy(y + size),
        rx,
        ry,
        sweep: 0,
      };
    default:
      return {
        startX: sx(x + size),
        startY: sy(y + size),
        endX: sx(x),
        endY: sy(y),
        rx,
        ry,
        sweep: 0,
      };
  }
}
