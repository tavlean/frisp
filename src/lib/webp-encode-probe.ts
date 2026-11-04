// Imported here, not in codec-assets.ts: the production worker bridge imports
// that module, and a probe URL there emits the probe worker into every build.
import webpEncodeProbeWorkerUrl from './webp-encode-probe.worker.ts?worker&url';
import { webpEncoderSimdWasmUrl, webpEncoderWasmUrl } from './codec-assets';

export interface WebpEncodeProbeResult {
  outputBytes: number;
  magicBytes: string;
  riffHeader: string;
}

export function runWebpEncodeProbe(): Promise<WebpEncodeProbeResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(webpEncodeProbeWorkerUrl, { type: 'module' });

    worker.onmessage = (
      event: MessageEvent<WebpEncodeProbeResult | { error: string }>,
    ) => {
      worker.terminate();
      if ('error' in event.data) {
        reject(new Error(event.data.error));
        return;
      }
      resolve(event.data);
    };

    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'WebP encode worker failed.'));
    };

    worker.postMessage({
      type: 'encode',
      wasmUrls: {
        baseline: webpEncoderWasmUrl,
        simd: webpEncoderSimdWasmUrl,
      },
    });
  });
}
