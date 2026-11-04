// Imported here, not in codec-assets.ts: the production worker bridge imports
// that module, and a probe URL there emits the probe worker into every build.
import codecAssetProbeWorkerUrl from './codec-asset-probe.worker.ts?worker&url';
import { webpEncoderWasmUrl } from './codec-assets';

export interface CodecAssetProbeResult {
  wasmUrl: string;
  wasmBytes: number;
  wasmMagic: string;
}

export function runCodecAssetProbe(): Promise<CodecAssetProbeResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(codecAssetProbeWorkerUrl, { type: 'module' });

    worker.onmessage = (
      event: MessageEvent<CodecAssetProbeResult | { error: string }>,
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
      reject(new Error(event.message || 'Codec asset worker failed.'));
    };

    worker.postMessage({ wasmUrl: webpEncoderWasmUrl });
  });
}
