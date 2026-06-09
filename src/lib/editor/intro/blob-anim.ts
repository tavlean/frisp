// The landing-screen blob animation, adapted from Squoosh's
// src/shared/prerendered-app/Intro/blob-anim/{index.ts,meta.ts}. A canvas of
// soft peach blobs: a stack of slowly-rotating, gently-morphing "central" blobs
// sitting behind the drop/paste target. Colour + opacity come from the
// `--blob-color` / `--center-blob-opacity` custom properties read off the canvas.
//
// Adaptations from the original: we drop its drifting "background" blobs and
// keep only the central stack; the target element is passed in (no CSS-module
// class lookup); `startBlobAnim` returns a teardown fn; and we honour
// `prefers-reduced-motion` by painting a single static frame instead of looping.

/** Control point x,y - point x,y - control point x,y */
export type BlobPoint = [number, number, number, number, number, number];

const maxPointDistance = 0.25;

function randomisePoint(point: BlobPoint): BlobPoint {
  const distance = Math.random() * maxPointDistance;
  const angle = Math.random() * Math.PI * 2;
  const xShift = Math.sin(angle) * distance;
  const yShift = Math.cos(angle) * distance;
  return [
    point[0] + xShift,
    point[1] + yShift,
    point[2] + xShift,
    point[3] + yShift,
    point[4] + xShift,
    point[5] + yShift,
  ];
}

function easeInOutQuad(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

const rand = (min: number, max: number) => Math.random() * (max - min) + min;

interface CircleBlobPointState {
  basePoint: BlobPoint;
  pos: number;
  duration: number;
  startPoint: BlobPoint;
  endPoint: BlobPoint;
}

/** Bezier points for a seven point circle, to 3 decimal places */
const sevenPointCircle: BlobPoint[] = [
  [-0.304, -1, 0, -1, 0.304, -1],
  [0.592, -0.861, 0.782, -0.623, 0.972, -0.386],
  [1.043, -0.074, 0.975, 0.223, 0.907, 0.519],
  [0.708, 0.769, 0.434, 0.901, 0.16, 1.033],
  [-0.16, 1.033, -0.434, 0.901, -0.708, 0.769],
  [-0.907, 0.519, -0.975, 0.223, -1.043, -0.074],
  [-0.972, -0.386, -0.782, -0.623, -0.592, -0.861],
];

/** Start points for the four stacked central blobs (Squoosh's prerender shape). */
const startBlobs: BlobPoint[][] = [
  [
    [-0.232, -1.029, 0.073, -1.029, 0.377, -1.029],
    [0.565, -1.098, 0.755, -0.86, 0.945, -0.622],
    [0.917, -0.01, 0.849, 0.286, 0.782, 0.583],
    [0.85, 0.687, 0.576, 0.819, 0.302, 0.951],
    [-0.198, 1.009, -0.472, 0.877, -0.746, 0.745],
    [-0.98, 0.513, -1.048, 0.216, -1.116, -0.08],
    [-0.964, -0.395, -0.774, -0.633, -0.584, -0.871],
  ],
  [
    [-0.505, -1.109, -0.201, -1.109, 0.104, -1.109],
    [0.641, -0.684, 0.831, -0.446, 1.02, -0.208],
    [1.041, 0.034, 0.973, 0.331, 0.905, 0.628],
    [0.734, 0.794, 0.46, 0.926, 0.186, 1.058],
    [-0.135, 0.809, -0.409, 0.677, -0.684, 0.545],
    [-0.935, 0.404, -1.002, 0.108, -1.07, -0.189],
    [-0.883, -0.402, -0.693, -0.64, -0.503, -0.878],
  ],
  [
    [-0.376, -1.168, -0.071, -1.168, 0.233, -1.168],
    [0.732, -0.956, 0.922, -0.718, 1.112, -0.48],
    [1.173, 0.027, 1.105, 0.324, 1.038, 0.621],
    [0.707, 0.81, 0.433, 0.943, 0.159, 1.075],
    [-0.096, 1.135, -0.37, 1.003, -0.644, 0.871],
    [-0.86, 0.457, -0.927, 0.161, -0.995, -0.136],
    [-0.87, -0.516, -0.68, -0.754, -0.49, -0.992],
  ],
  [
    [-0.309, -0.998, -0.004, -0.998, 0.3, -0.998],
    [0.535, -0.852, 0.725, -0.614, 0.915, -0.376],
    [1.05, -0.09, 0.982, 0.207, 0.915, 0.504],
    [0.659, 0.807, 0.385, 0.939, 0.111, 1.071],
    [-0.178, 1.048, -0.452, 0.916, -0.727, 0.784],
    [-0.942, 0.582, -1.009, 0.285, -1.077, -0.011],
    [-1.141, -0.335, -0.951, -0.573, -0.761, -0.811],
  ],
];

interface CircleBlobOptions {
  minDuration?: number;
  maxDuration?: number;
  startPoints?: BlobPoint[];
}

class CircleBlob {
  private animStates: CircleBlobPointState[];
  private minDuration: number;
  private maxDuration: number;
  private points: BlobPoint[];

  constructor(
    basePoints: BlobPoint[],
    {
      startPoints = basePoints.map((point) => randomisePoint(point)),
      minDuration = 4000,
      maxDuration = 11000,
    }: CircleBlobOptions = {},
  ) {
    this.points = startPoints;
    this.minDuration = minDuration;
    this.maxDuration = maxDuration;
    this.animStates = basePoints.map((basePoint, i) => ({
      basePoint,
      pos: 0,
      duration: rand(minDuration, maxDuration),
      startPoint: startPoints[i],
      endPoint: randomisePoint(basePoint),
    }));
  }

  advance(timeDelta: number): void {
    this.points = this.animStates.map((animState) => {
      animState.pos += timeDelta / animState.duration;
      if (animState.pos >= 1) {
        animState.startPoint = animState.endPoint;
        animState.pos = 0;
        animState.duration = rand(this.minDuration, this.maxDuration);
        animState.endPoint = randomisePoint(animState.basePoint);
      }
      const eased = easeInOutQuad(animState.pos);

      return animState.startPoint.map((startPoint, i) => {
        const endPoint = animState.endPoint[i];
        return (endPoint - startPoint) * eased + startPoint;
      }) as BlobPoint;
    });
  }

  draw(ctx: CanvasRenderingContext2D) {
    const points = this.points;
    ctx.beginPath();
    ctx.moveTo(points[0][2], points[0][3]);

    for (let i = 0; i < points.length; i++) {
      const nextI = i === points.length - 1 ? 0 : i + 1;
      ctx.bezierCurveTo(
        points[i][4],
        points[i][5],
        points[nextI][0],
        points[nextI][1],
        points[nextI][2],
        points[nextI][3],
      );
    }

    ctx.closePath();
    ctx.fill();
  }
}

const centralBlobsRotationTime = 120000;

class CentralBlobs {
  private rotatePos = 0;
  private blobs = Array.from(
    { length: 4 },
    (_, i) => new CircleBlob(sevenPointCircle, { startPoints: startBlobs[i] }),
  );

  advance(timeDelta: number) {
    this.rotatePos =
      (this.rotatePos + timeDelta / centralBlobsRotationTime) % 1;
    for (const blob of this.blobs) blob.advance(timeDelta);
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(radius, radius);
    ctx.rotate(Math.PI * 2 * this.rotatePos);
    for (const blob of this.blobs) blob.draw(ctx);
    ctx.restore();
  }
}

const deltaMultiplierStep = 0.01;

/**
 * Drive the blob animation on `canvas`, gravitating towards `targetEl`'s centre.
 * Returns a teardown function (removes listeners + stops the loop).
 */
export function startBlobAnim(
  canvas: HTMLCanvasElement,
  targetEl: Element,
): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const reduceMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  const centralBlobs = new CentralBlobs();
  let lastTime = performance.now();
  let hasFocus = document.hasFocus();
  let deltaMultiplier = hasFocus ? 1 : 0;
  let animating = true;
  let rafId = 0;

  // Layout/style reads (getBoundingClientRect, getComputedStyle) are hoisted
  // out of the frame loop: at 60fps they would force a style recalc every
  // frame for values that only change on resize. The ResizeObserver below
  // refreshes this snapshot when the canvas or target actually changes.
  let canvasBounds = { width: 0, height: 0, left: 0, top: 0 };
  let targetX = 0;
  let targetY = 0;
  let targetRadius = 0;
  let blobColor = '';
  let blobOpacity = 0;

  function refreshGeometry() {
    const bounds = canvas.getBoundingClientRect();
    canvasBounds = {
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      top: bounds.top,
    };
    const targetBounds = targetEl.getBoundingClientRect();
    const computedStyles = getComputedStyle(canvas);
    blobColor = computedStyles.getPropertyValue('--blob-color');
    blobOpacity = Number(
      computedStyles.getPropertyValue('--center-blob-opacity'),
    );
    targetX = targetBounds.left - canvasBounds.left + targetBounds.width / 2;
    targetY = targetBounds.top - canvasBounds.top + targetBounds.height / 2;
    targetRadius = targetBounds.height / 2 / (1 + maxPointDistance);
  }

  function drawFrame(delta: number) {
    if (!canvasBounds.width || !canvasBounds.height) return;

    // Only reallocate the backing store when its size actually changed —
    // assigning canvas.width clears AND reallocates the bitmap, which is
    // needless churn when done every frame.
    const bitmapWidth = Math.round(canvasBounds.width * devicePixelRatio);
    const bitmapHeight = Math.round(canvasBounds.height * devicePixelRatio);
    if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
      canvas.width = bitmapWidth;
      canvas.height = bitmapHeight;
    }

    ctx!.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx!.clearRect(0, 0, canvasBounds.width, canvasBounds.height);

    centralBlobs.advance(delta);

    ctx!.globalAlpha = blobOpacity;
    ctx!.fillStyle = blobColor;

    centralBlobs.draw(ctx!, targetX, targetY, targetRadius);
  }

  function frame(time: number) {
    if (!canvas.isConnected) return destruct();

    // Be kind: when the window loses focus, ease the animation to a stop.
    if (!hasFocus) {
      deltaMultiplier = Math.max(0, deltaMultiplier - deltaMultiplierStep);
      if (deltaMultiplier === 0) {
        animating = false;
        return;
      }
    } else if (deltaMultiplier !== 1) {
      deltaMultiplier = Math.min(1, deltaMultiplier + deltaMultiplierStep);
    }

    const delta = (time - lastTime) * deltaMultiplier;
    lastTime = time;
    drawFrame(delta);
    rafId = requestAnimationFrame(frame);
  }

  function startAnim() {
    animating = true;
    rafId = requestAnimationFrame((time) => {
      lastTime = time;
      frame(time);
    });
  }

  const visibilityListener = () => {
    // 'Pause time' while the page is hidden so it doesn't fast-forward on return.
    if (document.visibilityState === 'visible') lastTime = performance.now();
  };
  const focusListener = () => {
    hasFocus = true;
    if (!animating) startAnim();
  };
  const blurListener = () => {
    hasFocus = false;
  };
  const resizeObserver = new ResizeObserver(() => {
    refreshGeometry();
    if (!animating) drawFrame(0);
  });

  function destruct() {
    cancelAnimationFrame(rafId);
    removeEventListener('focus', focusListener);
    removeEventListener('blur', blurListener);
    resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', visibilityListener);
  }

  // Reduced motion: paint one settled frame and stop — no drifting, no spin.
  if (reduceMotion) {
    refreshGeometry();
    drawFrame(0);
    resizeObserver.observe(canvas);
    resizeObserver.observe(targetEl);
    return () => {
      resizeObserver.disconnect();
    };
  }

  refreshGeometry();
  resizeObserver.observe(canvas);
  resizeObserver.observe(targetEl);
  addEventListener('focus', focusListener);
  addEventListener('blur', blurListener);
  document.addEventListener('visibilitychange', visibilityListener);
  startAnim();

  return destruct;
}
