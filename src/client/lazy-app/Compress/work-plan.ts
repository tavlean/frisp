import type {
  EncoderState,
  PreprocessorState,
  ProcessorState,
} from '../feature-meta';
import { defaultProcessorState } from '../feature-meta';
import { processorStateEquivalent } from './processor-state';
import type { SideSettings } from './saved-settings';

export interface MainJobState {
  file: File;
  preprocessorState: PreprocessorState;
}

export interface SideJobState {
  processorState: ProcessorState;
  encoderState?: EncoderState;
}

export interface SideWorkNeeded {
  processing: boolean;
  encoding: boolean;
}

export interface ImageWorkPlan {
  needsDecoding: boolean;
  needsPreprocessing: boolean;
  sideWorksNeeded: SideWorkNeeded[];
  jobNeeded: boolean;
}

export interface WorkPlanSideInput {
  latestSettings: SideSettings;
  encodedSettings?: SideSettings;
}

export interface ImageWorkState {
  source?: { file: File };
  encodedPreprocessorState?: PreprocessorState;
  preprocessorState: PreprocessorState;
  sides: readonly WorkPlanSideInput[];
}

export interface PlannedImageWork {
  mainJobState: MainJobState;
  sideJobStates: SideJobState[];
  workStarts: ImageWorkStarts;
  workPlan: ImageWorkPlan;
}

export interface ImageWorkStarts {
  mainJobState?: MainJobState;
  sideJobStates: (SideJobState | undefined)[];
}

export interface ImageWorkAbortPlan {
  main: boolean;
  sides: boolean[];
}

export interface ActiveImageJobs {
  mainJob?: MainJobState;
  sideJobs: readonly (SideJobState | undefined)[];
}

export interface SideEncodingResult {
  processed?: ImageData;
  data: ImageData;
  file: File;
}

export type SideEncodingPlan =
  | { kind: 'skip' }
  | { kind: 'original'; result: SideEncodingResult }
  | { kind: 'cache'; result: SideEncodingResult }
  | {
      kind: 'encode';
      encoderState: EncoderState;
      needsProcessing: boolean;
      processed?: ImageData;
      processorState: ProcessorState;
    };

export interface SideEncodingPlanInput {
  cacheResult?: SideEncodingResult;
  currentProcessed?: ImageData;
  jobState: SideJobState;
  sideWorkNeeded: SideWorkNeeded;
  sourceFile: File;
  sourcePreprocessed: ImageData;
}

export interface SideJobExecutionPlanInput {
  currentProcessed?: ImageData;
  getCacheResult: (
    preprocessed: ImageData,
    processorState: ProcessorState,
    encoderState: EncoderState,
  ) => SideEncodingResult | undefined;
  jobState: SideJobState;
  sideWorkNeeded: SideWorkNeeded;
  sourceFile: File;
  sourcePreprocessed: ImageData;
}

export interface SideJobEncodedResult {
  data: ImageData;
  file: File;
  processed: ImageData | undefined;
  processorState: ProcessorState;
  encoderState: EncoderState | undefined;
}

export interface SideJobCacheEntry {
  data: ImageData;
  file: File;
  processed: ImageData;
  preprocessed: ImageData;
  processorState: ProcessorState;
  encoderState: EncoderState;
}

export function getLatestMainJobState(
  activeMainJob: MainJobState | undefined,
  sourceFile: File | undefined,
  encodedPreprocessorState: PreprocessorState | undefined,
): Partial<MainJobState> {
  return (
    activeMainJob || {
      file: sourceFile,
      preprocessorState: encodedPreprocessorState,
    }
  );
}

export function getLatestSideJobStates(
  activeSideJobs: readonly (SideJobState | undefined)[],
  sides: readonly WorkPlanSideInput[],
): Partial<SideJobState>[] {
  return sides.map(
    (side, index) =>
      activeSideJobs[index] || {
        processorState:
          side.encodedSettings && side.encodedSettings.processorState,
        encoderState: side.encodedSettings && side.encodedSettings.encoderState,
      },
  );
}

export function getMainJobState(
  file: File,
  preprocessorState: PreprocessorState,
): MainJobState {
  return { file, preprocessorState };
}

export function getSideJobStates(
  sides: readonly WorkPlanSideInput[],
): SideJobState[] {
  return sides.map((side) => ({
    // If there isn't an encoder selected, processing is intentionally skipped.
    processorState: side.latestSettings.encoderState
      ? side.latestSettings.processorState
      : defaultProcessorState,
    encoderState: side.latestSettings.encoderState,
  }));
}

export function getImageWorkPlan(
  latestMainJobState: Partial<MainJobState>,
  mainJobState: MainJobState,
  latestSideJobStates: readonly Partial<SideJobState>[],
  sideJobStates: readonly SideJobState[],
): ImageWorkPlan {
  const needsDecoding = latestMainJobState.file !== mainJobState.file;
  const needsPreprocessing =
    needsDecoding ||
    latestMainJobState.preprocessorState !== mainJobState.preprocessorState;
  const sideWorksNeeded = sideJobStates.map((sideJobState, index) => {
    const latestSideJobState = latestSideJobStates[index] || {};
    const outputTypeChanged =
      Boolean(latestSideJobState.encoderState) !==
      Boolean(sideJobState.encoderState);
    const processorChanged =
      !latestSideJobState.processorState ||
      !processorStateEquivalent(
        latestSideJobState.processorState,
        sideJobState.processorState,
      );
    const needsProcessing =
      needsPreprocessing || outputTypeChanged || processorChanged;

    return {
      processing: needsProcessing,
      encoding:
        needsProcessing ||
        latestSideJobState.encoderState !== sideJobState.encoderState,
    };
  });
  const sideJobNeeded = sideWorksNeeded.some(
    (sideWorkNeeded) => sideWorkNeeded.processing || sideWorkNeeded.encoding,
  );

  return {
    needsDecoding,
    needsPreprocessing,
    sideWorksNeeded,
    jobNeeded: needsDecoding || needsPreprocessing || sideJobNeeded,
  };
}

export function getImageWorkStarts(
  workPlan: ImageWorkPlan,
  mainJobState: MainJobState,
  sideJobStates: readonly SideJobState[],
): ImageWorkStarts {
  return {
    mainJobState:
      workPlan.needsDecoding || workPlan.needsPreprocessing
        ? mainJobState
        : undefined,
    sideJobStates: workPlan.sideWorksNeeded.map((sideWorkNeeded, index) =>
      sideWorkNeeded.processing || sideWorkNeeded.encoding
        ? sideJobStates[index]
        : undefined,
    ),
  };
}

export function getImageWorkAbortPlan(
  workStarts: ImageWorkStarts,
): ImageWorkAbortPlan {
  return {
    main: Boolean(workStarts.mainJobState),
    sides: workStarts.sideJobStates.map(Boolean),
  };
}

export function getActiveImageJobsAfterStarts(
  activeJobs: ActiveImageJobs,
  workStarts: ImageWorkStarts,
): ActiveImageJobs {
  return {
    mainJob: workStarts.mainJobState || activeJobs.mainJob,
    sideJobs: activeJobs.sideJobs.map(
      (sideJob, index) => workStarts.sideJobStates[index] || sideJob,
    ),
  };
}

export function getRunnableSideJobIndexes(
  sideWorksNeeded: readonly SideWorkNeeded[],
): number[] {
  return sideWorksNeeded.flatMap((sideWorkNeeded, index) =>
    sideWorkNeeded.encoding ? [index] : [],
  );
}

export function getSideEncodingPlan({
  cacheResult,
  currentProcessed,
  jobState,
  sideWorkNeeded,
  sourceFile,
  sourcePreprocessed,
}: SideEncodingPlanInput): SideEncodingPlan {
  if (!sideWorkNeeded.encoding) return { kind: 'skip' };

  if (!jobState.encoderState) {
    return {
      kind: 'original',
      result: {
        file: sourceFile,
        data: sourcePreprocessed,
      },
    };
  }

  if (cacheResult) {
    return {
      kind: 'cache',
      result: cacheResult,
    };
  }

  return {
    kind: 'encode',
    encoderState: jobState.encoderState,
    needsProcessing: sideWorkNeeded.processing,
    processed: sideWorkNeeded.processing ? undefined : currentProcessed,
    processorState: jobState.processorState,
  };
}

export function getSideJobExecutionPlan({
  currentProcessed,
  getCacheResult,
  jobState,
  sideWorkNeeded,
  sourceFile,
  sourcePreprocessed,
}: SideJobExecutionPlanInput): SideEncodingPlan {
  const cacheResult = jobState.encoderState
    ? getCacheResult(
        sourcePreprocessed,
        jobState.processorState,
        jobState.encoderState,
      )
    : undefined;

  return getSideEncodingPlan({
    cacheResult,
    currentProcessed,
    jobState,
    sideWorkNeeded,
    sourceFile,
    sourcePreprocessed,
  });
}

export function getSideJobEncodedResult(
  jobState: SideJobState,
  result: SideEncodingResult,
): SideJobEncodedResult {
  return {
    data: result.data,
    file: result.file,
    processed: result.processed,
    processorState: jobState.processorState,
    encoderState: jobState.encoderState,
  };
}

export function getSideJobCacheEntry(
  sidePlan: SideEncodingPlan,
  result: SideEncodingResult,
  preprocessed: ImageData,
): SideJobCacheEntry | undefined {
  if (sidePlan.kind !== 'encode') return undefined;
  if (!result.processed) return undefined;

  return {
    data: result.data,
    file: result.file,
    processed: result.processed,
    preprocessed,
    encoderState: sidePlan.encoderState,
    processorState: sidePlan.processorState,
  };
}

export function getPlannedImageWork(
  activeMainJob: MainJobState | undefined,
  activeSideJobs: readonly (SideJobState | undefined)[],
  sourceFile: File,
  state: ImageWorkState,
): PlannedImageWork {
  const latestMainJobState = getLatestMainJobState(
    activeMainJob,
    state.source && state.source.file,
    state.encodedPreprocessorState,
  );
  const latestSideJobStates = getLatestSideJobStates(
    activeSideJobs,
    state.sides,
  );
  const mainJobState = getMainJobState(sourceFile, state.preprocessorState);
  const sideJobStates = getSideJobStates(state.sides);
  const workPlan = getImageWorkPlan(
    latestMainJobState,
    mainJobState,
    latestSideJobStates,
    sideJobStates,
  );

  return {
    mainJobState,
    sideJobStates,
    workStarts: getImageWorkStarts(workPlan, mainJobState, sideJobStates),
    workPlan,
  };
}
