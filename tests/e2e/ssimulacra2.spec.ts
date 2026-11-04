import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

// The SSIMULACRA2 scorer through the real production codec worker, before any
// UI calls it. No test hook exists in the app on purpose, so the page starts
// the built worker itself and speaks Comlink's wire protocol to it by hand: an
// APPLY message with RAW arguments, answered by RAW (a value) or HANDLER
// "throw" (an error). The WASM URLs a bridge would inject come from the build
// output, which is also what the preview server serves. The degraded image
// comes from the pipeline op's own scored encode (auto quality's probe path).
const photo = fileURLToPath(new URL('../fixtures/photo.jpg', import.meta.url));
const assetsDir = fileURLToPath(
  new URL('../../build/_app/immutable/assets', import.meta.url),
);

function assetUrl(pattern: RegExp): string {
  const matches = readdirSync(assetsDir).filter((name) => pattern.test(name));
  if (matches.length !== 1) {
    throw new Error(
      `Expected one build asset matching ${pattern}, found ${matches.length}.`,
    );
  }
  return `/_app/immutable/assets/${matches[0]}`;
}

test('scores identical and degraded images through the codec worker', async ({
  page,
}) => {
  const urls = {
    ssimulacra2: { metric: assetUrl(/^ssimulacra2\.[^.]+\.wasm$/) },
    webp: {
      baseline: assetUrl(/^webp_enc\.[^.]+\.wasm$/),
      decoder: assetUrl(/^webp_dec\.[^.]+\.wasm$/),
      simd: assetUrl(/^webp_enc_simd\.[^.]+\.wasm$/),
    },
  };

  const photoBase64 = readFileSync(photo).toString('base64');

  await page.goto('/');
  const result = await page.evaluate(
    async ({ urls, photoBase64 }) => {
      const file = new Blob(
        [Uint8Array.from(atob(photoBase64), (char) => char.charCodeAt(0))],
        { type: 'image/jpeg' },
      );

      const workers: string[] = await (
        await fetch('/_app/worker-precache.json')
      ).json();
      const workerUrl = workers.find((url) =>
        url.includes('/workers/codec-worker-'),
      );
      if (!workerUrl) throw new Error('No codec worker in the build.');
      const worker = new Worker(workerUrl, { type: 'module' });

      let nextId = 0;
      const call = (method: string, ...args: unknown[]) =>
        new Promise<unknown>((resolve, reject) => {
          const id = `ssimulacra2-e2e-${nextId++}`;
          const onMessage = (event: MessageEvent) => {
            if (event.data?.id !== id) return;
            worker.removeEventListener('message', onMessage);
            if (event.data.type === 'HANDLER' && event.data.name === 'throw') {
              reject(new Error(event.data.value?.value?.message ?? 'thrown'));
            } else {
              resolve(event.data.value);
            }
          };
          worker.addEventListener('message', onMessage);
          worker.postMessage({
            id,
            type: 'APPLY',
            path: [method],
            argumentList: args.map((value) => ({ type: 'RAW', value })),
          });
        });

      const pixels = async (blob: Blob): Promise<ImageData> => {
        const bitmap = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0);
        return context.getImageData(0, 0, bitmap.width, bitmap.height);
      };

      try {
        const source = await pixels(file);
        const identical = (await call(
          'ssimulacra2Score',
          source,
          source,
          urls.ssimulacra2,
        )) as number;

        const webpOptions = {
          quality: 10,
          target_size: 0,
          target_PSNR: 0,
          method: 4,
          sns_strength: 50,
          filter_strength: 60,
          filter_sharpness: 0,
          filter_type: 1,
          partitions: 0,
          segments: 4,
          pass: 1,
          show_compressed: 0,
          preprocessing: 0,
          autofilter: 0,
          partition_limit: 0,
          alpha_compression: 1,
          alpha_filtering: 1,
          alpha_quality: 100,
          lossless: 0,
          exact: 0,
          image_hint: 0,
          emulate_jpeg_size: 0,
          thread_level: 0,
          low_memory: 0,
          near_lossless: 100,
          use_delta_palette: 0,
          use_sharp_yuv: 0,
        };
        // The pipeline op, asked to score: it encodes in the worker, decodes
        // the output, and scores it against the frame it encoded (here the
        // source itself, since no processor runs). The preview it returns is
        // that same decoded output, so scoring it again through the plain
        // metric op must agree.
        const reply = (await call(
          'optimize',
          {
            key: 'ssimulacra2-e2e',
            file: { type: 'image/jpeg', name: 'photo.jpg' },
            source: { kind: 'pixels', image: source },
            recipe: {
              rotate: 0,
              processors: {
                resize: { enabled: false },
                grain: { enabled: false, amount: 0, size: 1 },
                quantize: { enabled: false },
              },
              output: {
                kind: 'raster',
                encoder: { type: 'webP', options: webpOptions },
              },
            },
            preview: true,
            score: true,
          },
          { urls, threads: 1 },
        )) as {
          kind: string;
          bytes: ArrayBuffer;
          preview: ImageData;
          score: number;
        };
        const lowQuality = reply.score;
        const rescored = (await call(
          'ssimulacra2Score',
          source,
          reply.preview,
          urls.ssimulacra2,
        )) as number;
        const webp = reply.bytes;

        // The source is still usable here, which proves it was not transferred.
        const cropped = new ImageData(
          source.data.slice(0, 16 * 16 * 4),
          16,
          16,
        );
        const mismatch = await call(
          'ssimulacra2Score',
          source,
          cropped,
          urls.ssimulacra2,
        ).then(
          () => 'resolved',
          (error: Error) => error.message,
        );

        return {
          identical,
          lowQuality,
          rescored,
          webpBytes: webp.byteLength,
          sourceBytes: source.data.byteLength,
          mismatch,
        };
      } finally {
        worker.terminate();
      }
    },
    { urls, photoBase64 },
  );

  // eslint-disable-next-line no-console
  console.log(
    `[ssimulacra2] identical=${result.identical.toFixed(2)} webp-q10=${result.lowQuality.toFixed(2)} (${result.webpBytes} bytes)`,
  );
  expect(result.sourceBytes).toBe(1024 * 683 * 4);
  expect(result.identical).toBeGreaterThanOrEqual(99.5);
  expect(result.webpBytes).toBeGreaterThan(0);
  expect(result.lowQuality).toBeLessThan(70);
  // A real score, not the -1000 failure sentinel.
  expect(result.lowQuality).toBeGreaterThan(-100);
  expect(result.rescored).toBeCloseTo(result.lowQuality, 6);
  expect(result.mismatch).toMatch(/equal dimensions/);
});
