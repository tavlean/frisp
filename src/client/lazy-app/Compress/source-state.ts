import type { PreprocessorState, ProcessorState } from '../feature-meta';
import { cleanMerge } from '../util/clean-modify';

export interface SourceDimensions {
  width: number;
  height: number;
}

export interface SourceDecodeStartState {
  source: undefined;
  loading: true;
}

export interface SourcePreprocessStartState {
  loading: true;
}

export interface SourcePreprocessErrorState {
  loading: false;
}

export interface ResizeSettingsSide {
  latestSettings: {
    processorState: {
      resize: ProcessorState['resize'];
    };
  };
}

export interface PreprocessorChangeState<Side extends ResizeSettingsSide> {
  source?: unknown;
  sides: [Side, Side];
  loading: boolean;
  preprocessorState: PreprocessorState;
}

export function didOrientationChange(
  oldRotate: number,
  newRotate: number,
): boolean {
  return oldRotate % 180 !== newRotate % 180;
}

export function getDefaultResizeState(
  source: SourceDimensions,
  hasVectorSource: boolean,
): Partial<ProcessorState['resize']> {
  return {
    width: source.width,
    height: source.height,
    method: hasVectorSource ? 'vector' : 'lanczos3',
    // A new source should show its real dimensions before the user opts into resizing.
    enabled: false,
  };
}

export function getDefaultResizeSides<Side extends ResizeSettingsSide>(
  sides: [Side, Side],
  source: SourceDimensions,
  hasVectorSource: boolean,
): [Side, Side] {
  const resizeState = getDefaultResizeState(source, hasVectorSource);
  return sides.map((side) =>
    cleanMerge(side, 'latestSettings.processorState.resize', resizeState),
  ) as [Side, Side];
}

export function getOrientationAdjustedResizeState(
  resizeState: SourceDimensions,
): Partial<ProcessorState['resize']> {
  return {
    width: resizeState.height,
    height: resizeState.width,
  };
}

export function getOrientationAdjustedSides<Side extends ResizeSettingsSide>(
  sides: [Side, Side],
): [Side, Side] {
  return sides.map((side) => {
    const currentResizeSettings = side.latestSettings.processorState.resize;
    return cleanMerge(
      side,
      'latestSettings.processorState.resize',
      getOrientationAdjustedResizeState(currentResizeSettings),
    );
  }) as [Side, Side];
}

export function getSourceDecodeStartState(): SourceDecodeStartState {
  return {
    source: undefined,
    loading: true,
  };
}

export function getSourcePreprocessStartState(): SourcePreprocessStartState {
  return {
    loading: true,
  };
}

export function getSourcePreprocessErrorState(): SourcePreprocessErrorState {
  return {
    loading: false,
  };
}

export function getPreprocessorChangeState<
  Side extends ResizeSettingsSide,
  State extends PreprocessorChangeState<Side>,
>(
  state: State,
  preprocessorState: PreprocessorState,
): Pick<State, 'loading' | 'preprocessorState' | 'sides'> | undefined {
  if (!state.source) return undefined;

  const orientationChanged = didOrientationChange(
    state.preprocessorState.rotate.rotate,
    preprocessorState.rotate.rotate,
  );

  return {
    loading: true,
    preprocessorState,
    sides: orientationChanged
      ? getOrientationAdjustedSides(state.sides)
      : state.sides,
  };
}
