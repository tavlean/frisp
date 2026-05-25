import { canvasEncode } from 'client/lazy-app/util/canvas';
import { mimeType, type EncodeOptions } from '../shared/meta';

export const encode = (
  _signal: AbortSignal,
  _workerBridge: unknown,
  imageData: ImageData,
  _options: EncodeOptions,
) => canvasEncode(imageData, mimeType);
