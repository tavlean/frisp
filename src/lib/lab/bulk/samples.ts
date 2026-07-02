// Synthetic sample-image generator for the Bulk UI lab.
//
// The lab is a dev-only sandbox for the bulk UI; to exercise it without hunting
// for real photos, `makeSampleFiles` paints varied canvases (gradients,
// shapes, banded noise) at a mix of aspect ratios and sizes, then encodes each
// to JPEG or PNG. The output is an ordinary File[] the engine's import path
// accepts unchanged. Deterministic-ish: a small seeded PRNG drives the variety
// so repeated loads look stable enough to compare, without being pixel-locked.

interface SampleSpec {
  /** Long edge in CSS pixels; the short edge follows from the aspect ratio. */
  long: number;
  /** [w, h] proportion — landscape or portrait. */
  aspect: [number, number];
  /** Encoded container. PNG stresses the lossless path; JPEG the lossy one. */
  type: 'image/jpeg' | 'image/png';
}

// A spread of shapes and sizes so the strip/grid, aspect chip, and letterboxed
// SplitCompare geometry all get exercised. Cycled if n exceeds the list.
const SAMPLE_SPECS: readonly SampleSpec[] = [
  { long: 2400, aspect: [16, 9], type: 'image/jpeg' },
  { long: 1600, aspect: [1, 1], type: 'image/png' },
  { long: 3000, aspect: [3, 2], type: 'image/jpeg' },
  { long: 1200, aspect: [9, 16], type: 'image/jpeg' },
  { long: 2048, aspect: [4, 3], type: 'image/png' },
  { long: 3500, aspect: [21, 9], type: 'image/jpeg' },
  { long: 900, aspect: [1, 1], type: 'image/png' },
  { long: 1920, aspect: [16, 9], type: 'image/jpeg' },
  { long: 1400, aspect: [3, 4], type: 'image/jpeg' },
  { long: 2600, aspect: [3, 2], type: 'image/png' },
  { long: 1080, aspect: [1, 1], type: 'image/jpeg' },
  { long: 2200, aspect: [4, 3], type: 'image/jpeg' },
];

/** Small deterministic PRNG (mulberry32) so a seed reproduces one image. */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${h} ${s}% ${l}%)`;
}

function paintSample(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  random: () => number,
): void {
  const baseHue = Math.floor(random() * 360);

  // Diagonal two-stop gradient backdrop.
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, hsl(baseHue, 60, 22));
  gradient.addColorStop(1, hsl((baseHue + 60) % 360, 55, 45));
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  // Scattered translucent shapes for mid-frequency detail.
  const shapeCount = 8 + Math.floor(random() * 10);
  for (let index = 0; index < shapeCount; index += 1) {
    const hue = (baseHue + index * 37) % 360;
    ctx.fillStyle = `hsl(${hue} 70% ${40 + random() * 30}% / ${
      0.25 + random() * 0.4
    })`;
    const cx = random() * width;
    const cy = random() * height;
    const size = (0.08 + random() * 0.28) * Math.min(width, height);
    if (random() > 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(random() * Math.PI);
      ctx.fillRect(-size / 2, -size / 2, size, size * (0.4 + random()));
      ctx.restore();
    }
  }

  // Fine banded noise so lossy encoders have high-frequency content to chew on.
  const bandHeight = Math.max(2, Math.floor(height / 220));
  for (let y = 0; y < height; y += bandHeight) {
    ctx.fillStyle = `rgba(255,255,255,${random() * 0.05})`;
    ctx.fillRect(0, y, width, 1);
  }
}

async function canvasToFile(
  canvas: HTMLCanvasElement,
  type: SampleSpec['type'],
  name: string,
): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, type, type === 'image/jpeg' ? 0.92 : undefined);
  });
  if (!blob) throw new Error(`Could not encode sample "${name}"`);
  return new File([blob], name, { type: blob.type || type, lastModified: 1 });
}

/**
 * Generate `n` synthetic image Files (default 12) with mixed aspect ratios,
 * sizes, and formats. Runs entirely on a throwaway canvas — no network, no real
 * files. Sequential encode keeps peak memory to a single canvas at a time.
 */
export async function makeSampleFiles(n = 12): Promise<File[]> {
  const files: File[] = [];

  for (let index = 0; index < n; index += 1) {
    const spec = SAMPLE_SPECS[index % SAMPLE_SPECS.length];
    const [aw, ah] = spec.aspect;
    const landscape = aw >= ah;
    const width = landscape ? spec.long : Math.round((spec.long * aw) / ah);
    const height = landscape ? Math.round((spec.long * ah) / aw) : spec.long;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    paintSample(ctx, width, height, createRandom(index * 2654435761 + 1));

    const extension = spec.type === 'image/jpeg' ? 'jpg' : 'png';
    const name = `sample-${String(index + 1).padStart(2, '0')}.${extension}`;
    files.push(await canvasToFile(canvas, spec.type, name));
  }

  return files;
}
