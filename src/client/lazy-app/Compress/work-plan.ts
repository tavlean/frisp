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
