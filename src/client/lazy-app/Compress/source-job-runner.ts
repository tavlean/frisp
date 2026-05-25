import type { PreprocessorState } from '../feature-meta';
import type { DecodedSourceImage, SourceImage } from '../image-pipeline';
import { assertSignal } from '../abort';

export interface SourceJobPipeline<WorkerBridgeType> {
  decodeSourceImage: (
    signal: AbortSignal,
    file: File,
    workerBridge: WorkerBridgeType,
  ) => Promise<DecodedSourceImage>;
  preprocessImage: (
    signal: AbortSignal,
    data: ImageData,
    preprocessorState: PreprocessorState,
    workerBridge: WorkerBridgeType,
  ) => Promise<ImageData>;
}

export interface RunSourceDecodeInput<WorkerBridgeType> {
  signal: AbortSignal;
  file: File;
  workerBridge: WorkerBridgeType;
  pipeline: Pick<SourceJobPipeline<WorkerBridgeType>, 'decodeSourceImage'>;
  onDecodeStart?: () => void;
  onDecoded?: (decodedSource: DecodedSourceImage) => void;
}

export interface RunSourcePreprocessInput<WorkerBridgeType> {
  signal: AbortSignal;
  decodedSource: DecodedSourceImage;
  preprocessorState: PreprocessorState;
  workerBridge: WorkerBridgeType;
  pipeline: Pick<SourceJobPipeline<WorkerBridgeType>, 'preprocessImage'>;
  onPreprocessStart?: () => void;
  onPreprocessed?: (source: SourceImage) => void;
}

export async function runSourceDecode<WorkerBridgeType>({
  signal,
  file,
  workerBridge,
  pipeline,
  onDecodeStart,
  onDecoded,
}: RunSourceDecodeInput<WorkerBridgeType>): Promise<DecodedSourceImage> {
  assertSignal(signal);
  onDecodeStart?.();

  const decodedSource = await pipeline.decodeSourceImage(
    signal,
    file,
    workerBridge,
  );
  onDecoded?.(decodedSource);
  return decodedSource;
}

export async function runSourcePreprocess<WorkerBridgeType>({
  signal,
  decodedSource,
  preprocessorState,
  workerBridge,
  pipeline,
  onPreprocessStart,
  onPreprocessed,
}: RunSourcePreprocessInput<WorkerBridgeType>): Promise<SourceImage> {
  assertSignal(signal);
  onPreprocessStart?.();

  const preprocessed = await pipeline.preprocessImage(
    signal,
    decodedSource.decoded,
    preprocessorState,
    workerBridge,
  );
  const source = {
    ...decodedSource,
    preprocessed,
  };
  onPreprocessed?.(source);
  return source;
}
