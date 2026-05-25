import type { PreprocessorState, ProcessorState } from '../feature-meta';
import type { SourceImage } from '../image-pipeline';
import {
  getSideEncodedResultState,
  getSideLoadingState,
  getSideProcessedResultState,
  setPreprocessedSourceState,
  type SideIndex,
} from './side-state';
import {
  getSourceDecodeSuccessState,
  getSourceDecodeStartState,
  getSourcePreprocessErrorState,
  getSourcePreprocessStartState,
} from './source-state';
import { runSourceImageWorkflow } from './source-workflow';
import { runSideImageWorkflow, type SideWorkflowCache } from './side-workflow';
import {
  getActiveImageJobsAfterMainCompletion,
  getActiveImageJobsAfterSideCompletion,
  getPlannedImageWork,
  type SideJobEncodedResult,
  type SideJobState,
} from './work-plan';
import {
  startImageWork,
  type ImageWorkRuntimeState,
} from './work-start-runner';
import type { SourceJobPipeline } from './source-job-runner';
import type { SideJobPipeline } from './side-job-runner';
import type { SideSettings } from './saved-settings';

export interface CompressionUpdateSide {
  processed?: ImageData;
  latestSettings: SideSettings;
  encodedSettings?: SideSettings;
  loading: boolean;
}

export interface CompressionUpdateState {
  source?: SourceImage;
  sides: [CompressionUpdateSide, CompressionUpdateSide];
  loading: boolean;
  preprocessorState: PreprocessorState;
  encodedPreprocessorState?: PreprocessorState;
}

export interface CompressionUpdateRuntime extends ImageWorkRuntimeState {
  sideJobs: [SideJobState?, SideJobState?];
  mainAbortController: AbortController;
  sideAbortControllers: [AbortController, AbortController];
}

export type CompressionUpdateStatePatch<State> =
  | Partial<State>
  | ((currentState: State) => Partial<State>);

export interface CompressionUpdatePipeline<WorkerBridgeType>
  extends SourceJobPipeline<WorkerBridgeType>,
    SideJobPipeline<WorkerBridgeType> {}

export interface CompressionUpdateWorkflowInput<WorkerBridgeType, State> {
  sourceFile: File;
  currentState: State;
  getRuntime: () => CompressionUpdateRuntime;
  setRuntime: (runtime: CompressionUpdateRuntime) => void;
  encodeCache: SideWorkflowCache;
  workerBridges: [WorkerBridgeType, WorkerBridgeType];
  pipeline: CompressionUpdatePipeline<WorkerBridgeType>;
  isUnmounted: () => boolean;
  showSnack: (message: string) => unknown;
  applyState: (patch: CompressionUpdateStatePatch<State>) => void;
}

export async function runCompressionUpdateWorkflow<
  WorkerBridgeType,
  State extends CompressionUpdateState,
>({
  sourceFile,
  currentState,
  getRuntime,
  setRuntime,
  encodeCache,
  workerBridges,
  pipeline,
  isUnmounted,
  showSnack,
  applyState,
}: CompressionUpdateWorkflowInput<WorkerBridgeType, State>): Promise<void> {
  const runtime = getRuntime();
  const { mainJobState, sideJobStates, workPlan, workStarts } =
    getPlannedImageWork(
      runtime.mainJob,
      runtime.sideJobs,
      sourceFile,
      currentState,
    );

  const workRuntime = startImageWork(runtime, workStarts);
  setRuntime(workRuntime);

  if (!workPlan.jobNeeded) return;

  const { mainSignal, sideSignals } = workRuntime;

  const source = await runSourceImageWorkflow({
    signal: mainSignal,
    currentSource: currentState.source,
    mainJobState,
    workPlan,
    // Either worker is good enough here.
    workerBridge: workerBridges[0],
    pipeline,
    isUnmounted,
    showSnack,
    onDecodeStart: () => {
      applyState(getSourceDecodeStartState() as Partial<State>);
    },
    onDecoded: ({ decoded, vectorImage }) => {
      applyState((state) => {
        if (mainSignal.aborted) return {};
        return getSourceDecodeSuccessState(
          state,
          decoded,
          Boolean(vectorImage),
        ) as Partial<State>;
      });
    },
    onPreprocessStart: () => {
      applyState(getSourcePreprocessStartState() as Partial<State>);
    },
    onPreprocessed: (preprocessedSource) => {
      applyState((state) => {
        if (mainSignal.aborted) return {};
        return setPreprocessedSourceState(
          state,
          preprocessedSource,
          mainJobState.preprocessorState,
          preprocessedSource.preprocessed,
        ) as Partial<State>;
      });
    },
    onPreprocessError: () => {
      applyState(getSourcePreprocessErrorState() as Partial<State>);
    },
  });
  if (!source) return;

  const currentRuntimeAfterSource = getRuntime();
  const activeJobsAfterMainCompletion = getActiveImageJobsAfterMainCompletion(
    currentRuntimeAfterSource,
  );
  setRuntime({
    ...currentRuntimeAfterSource,
    mainJob: activeJobsAfterMainCompletion.mainJob,
    sideJobs: activeJobsAfterMainCompletion.sideJobs as [
      SideJobState?,
      SideJobState?,
    ],
  });

  runSideImageWorkflow({
    sideWorksNeeded: workPlan.sideWorksNeeded,
    sideJobStates,
    sideSignals,
    source,
    sides: currentState.sides,
    encodeCache,
    getWorkerBridge: (sideIndex) => workerBridges[sideIndex],
    pipeline,
    isUnmounted,
    showSnack,
    onProcessingStart: (sideIndex, signal) => {
      applyState((state) => {
        if (signal.aborted) return {};
        return getSideLoadingState(
          state,
          sideIndex as SideIndex,
          true,
        ) as Partial<State>;
      });
    },
    onProcessed: (sideIndex, signal, processed, processorState) => {
      applyState((state) => {
        if (signal.aborted) return {};
        return getSideProcessedResultState(
          state,
          sideIndex as SideIndex,
          processed,
          processorState as ProcessorState,
        ) as Partial<State>;
      });
    },
    onEncodedResult: (sideIndex, signal, sideResult) => {
      applyState((state) => {
        if (signal.aborted) return {};
        return getSideEncodedResultState(
          state,
          sideIndex as SideIndex,
          sideResult as SideJobEncodedResult,
        ) as Partial<State>;
      });
    },
    onSideComplete: (sideIndex) => {
      const currentRuntime = getRuntime();
      const activeJobsAfterSideCompletion =
        getActiveImageJobsAfterSideCompletion(currentRuntime, sideIndex);
      setRuntime({
        ...currentRuntime,
        mainJob: activeJobsAfterSideCompletion.mainJob,
        sideJobs: activeJobsAfterSideCompletion.sideJobs as [
          SideJobState?,
          SideJobState?,
        ],
      });
    },
    onProcessingError: (sideIndex) => {
      applyState((state) => {
        return getSideLoadingState(
          state,
          sideIndex as SideIndex,
          false,
        ) as Partial<State>;
      });
    },
  });
}
