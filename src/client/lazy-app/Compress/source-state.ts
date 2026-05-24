import type { ProcessorState } from '../feature-meta';
import { cleanMerge } from '../util/clean-modify';

export interface SourceDimensions {
  width: number;
  height: number;
}

export interface ResizeSettingsSide {
  latestSettings: {
    processorState: {
      resize: ProcessorState['resize'];
    };
  };
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
