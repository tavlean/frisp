import type { DecodedSourceImage, SourceImage } from '../image-pipeline';
import { isAbortError } from '../util';
import { getImageProcessingErrorMessage } from './processing-errors';
import {
  runSourceDecode,
  runSourcePreprocess,
  type SourceJobPipeline,
} from './source-job-runner';
import type { ImageWorkPlan, MainJobState } from './work-plan';

export interface RunSourceImageWorkflowInput<WorkerBridgeType> {
  signal: AbortSignal;
  currentSource?: SourceImage;
  mainJobState: MainJobState;
  workPlan: Pick<ImageWorkPlan, 'needsDecoding' | 'needsPreprocessing'>;
  workerBridge: WorkerBridgeType;
  pipeline: SourceJobPipeline<WorkerBridgeType>;
  isUnmounted: () => boolean;
  showSnack: (message: string) => unknown;
  onDecodeStart?: () => void;
  onDecoded?: (decodedSource: DecodedSourceImage) => void;
  onPreprocessStart?: () => void;
  onPreprocessed?: (source: SourceImage) => void;
  onPreprocessError?: () => void;
}

export async function runSourceImageWorkflow<WorkerBridgeType>({
  signal,
  currentSource,
  mainJobState,
  workPlan,
  workerBridge,
  pipeline,
  isUnmounted,
  showSnack,
  onDecodeStart,
  onDecoded,
  onPreprocessStart,
  onPreprocessed,
  onPreprocessError,
}: RunSourceImageWorkflowInput<WorkerBridgeType>): Promise<
  SourceImage | undefined
> {
  let decodedSource: DecodedSourceImage;

  if (workPlan.needsDecoding) {
    try {
      decodedSource = await runSourceDecode({
        signal,
        file: mainJobState.file,
        workerBridge,
        pipeline,
        onDecodeStart,
        onDecoded,
      });
    } catch (err) {
      if (isAbortError(err)) return undefined;
      if (isUnmounted()) return undefined;
      showSnack(getImageProcessingErrorMessage('source-decoding', err));
      throw err;
    }
  } else {
    decodedSource = currentSource!;
  }

  if (workPlan.needsPreprocessing) {
    try {
      return await runSourcePreprocess({
        signal,
        decodedSource,
        preprocessorState: mainJobState.preprocessorState,
        workerBridge,
        pipeline,
        onPreprocessStart,
        onPreprocessed,
      });
    } catch (err) {
      if (isAbortError(err)) return undefined;
      if (isUnmounted()) return undefined;
      onPreprocessError?.();
      showSnack(getImageProcessingErrorMessage('preprocessing', err));
      throw err;
    }
  }

  return currentSource!;
}
