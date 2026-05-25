import type { EncoderState, ProcessorState } from '../feature-meta';
import type { SourceImage } from '../image-pipeline';
import { isAbortError } from '../abort';
import { getImageProcessingErrorMessage } from './processing-errors';
import { runRunnableSideJobs, type SideJobPipeline } from './side-job-runner';
import type {
  SideEncodingResult,
  SideJobCacheEntry,
  SideJobEncodedResult,
  SideJobState,
  SideWorkNeeded,
} from './work-plan';
import { getRunnableSideJobs } from './work-plan';

export interface SideWorkflowSide {
  processed?: ImageData;
}

export interface SideWorkflowCache {
  match: (
    preprocessed: ImageData,
    processorState: ProcessorState,
    encoderState: EncoderState,
  ) => SideEncodingResult | undefined;
  add: (cacheEntry: SideJobCacheEntry) => void;
}

export interface RunSideImageWorkflowInput<WorkerBridgeType> {
  sideWorksNeeded: readonly SideWorkNeeded[];
  sideJobStates: readonly SideJobState[];
  sideSignals: readonly AbortSignal[];
  source: SourceImage;
  sides: readonly SideWorkflowSide[];
  encodeCache: SideWorkflowCache;
  getWorkerBridge: (sideIndex: number) => WorkerBridgeType;
  pipeline: SideJobPipeline<WorkerBridgeType>;
  isUnmounted: () => boolean;
  showSnack: (message: string) => unknown;
  onProcessingStart?: (sideIndex: number, signal: AbortSignal) => void;
  onProcessed?: (
    sideIndex: number,
    signal: AbortSignal,
    processed: ImageData,
    processorState: ProcessorState,
  ) => void;
  onEncodedResult?: (
    sideIndex: number,
    signal: AbortSignal,
    sideResult: SideJobEncodedResult,
  ) => void;
  onSideComplete?: (sideIndex: number) => void;
  onProcessingError?: (
    sideIndex: number,
    signal: AbortSignal,
    error: unknown,
  ) => void;
}

export function runSideImageWorkflow<WorkerBridgeType>({
  sideWorksNeeded,
  sideJobStates,
  sideSignals,
  source,
  sides,
  encodeCache,
  getWorkerBridge,
  pipeline,
  isUnmounted,
  showSnack,
  onProcessingStart,
  onProcessed,
  onEncodedResult,
  onSideComplete,
  onProcessingError,
}: RunSideImageWorkflowInput<WorkerBridgeType>): Promise<void>[] {
  return runRunnableSideJobs({
    runnableSideJobs: getRunnableSideJobs(sideWorksNeeded, sideJobStates),
    sideSignals,
    source,
    getCurrentProcessed: (sideIndex) => sides[sideIndex].processed,
    getCacheResult: (...args) => encodeCache.match(...args),
    getWorkerBridge,
    pipeline,
    onProcessingStart,
    onProcessed,
    onCacheEntry: (cacheEntry) => encodeCache.add(cacheEntry),
    onEncodedResult,
    onSideComplete,
    onError: (sideIndex, signal, err) => {
      if (isAbortError(err)) return;
      if (isUnmounted()) return;
      onProcessingError?.(sideIndex, signal, err);
      showSnack(getImageProcessingErrorMessage('processing', err));
      throw err;
    },
  });
}
