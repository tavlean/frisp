import { createWorkerBridgeRuntime } from '../../../../src/client/lazy-app/worker-bridge/runtime';
import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
import { webpPipelineProbeWorkerUrl } from './codec-assets';

export interface WebpWasmUrls {
  baseline: string;
  simd: string;
}

export interface SvelteKitWorkerBridgeApi {
  webpEncode(
    signal: AbortSignal,
    imageData: ImageData,
    options: EncodeOptions,
    wasmUrls: WebpWasmUrls,
  ): Promise<ArrayBuffer>;
  dispose(): void;
}

const SvelteKitWorkerBridgeBase = createWorkerBridgeRuntime(
  ['webpEncode'] as const,
  () => new Worker(webpPipelineProbeWorkerUrl, { type: 'module' }),
) as new () => SvelteKitWorkerBridgeApi;

export default class SvelteKitWorkerBridge extends SvelteKitWorkerBridgeBase {}
