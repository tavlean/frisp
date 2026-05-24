import { cleanMerge, cleanSet } from '../util/clean-modify';
import { defaultProcessorState, encoderMap } from '../feature-meta';
import type {
  EncoderOptions,
  EncoderType,
  ProcessorState,
} from '../feature-meta';
import type { SavedSideSettings, SideSettings } from './saved-settings';

export type SideIndex = 0 | 1;
export type SideOutputType = EncoderType | 'identity';

export interface ResettableSideState {
  file?: unknown;
  downloadUrl?: string;
  data?: unknown;
  processed?: unknown;
  encodedSettings?: unknown;
}

export interface ResettableTwoSideState<Side extends ResettableSideState> {
  sides: [Side, Side];
}

export interface PreprocessedSourceState<Side extends ResettableSideState>
  extends ResettableTwoSideState<Side> {
  loading: boolean;
  source?: unknown;
  encodedPreprocessorState?: unknown;
}

export interface SavedSettingsSide {
  latestSettings: unknown;
  encodedSettings?: unknown;
}

export interface LatestSettingsSide {
  latestSettings: SideSettings;
}

export interface LoadableSide {
  loading: boolean;
}

export interface ProcessingSideState extends SavedSettingsSide {
  encodedSettings?: Partial<SideSettings>;
  processed?: unknown;
  data?: unknown;
}

export interface EncodedSideState extends ProcessingSideState, LoadableSide {
  file?: unknown;
  downloadUrl?: string;
}

export interface InitialSideState {
  latestSettings: SideSettings;
  encodedSettings?: SideSettings;
  loading: boolean;
}

export interface SavedSideSettingsUpdate<Side extends SavedSettingsSide> {
  sides: [Side, Side];
  oldSide: Side;
}

export function getDefaultSideState(index: SideIndex): InitialSideState {
  return {
    latestSettings: {
      processorState: defaultProcessorState,
      encoderState:
        index === 0
          ? undefined
          : {
              type: 'mozJPEG',
              options: encoderMap.mozJPEG.meta.defaultOptions,
            },
    },
    loading: false,
  };
}

export function getInitialSideState(
  index: SideIndex,
  savedSettings?: SavedSideSettings,
): InitialSideState {
  return {
    ...getDefaultSideState(index),
    ...savedSettings,
    loading: false,
  };
}

export function resetSidesForNewSourceData<
  Side extends ResettableSideState,
  State extends ResettableTwoSideState<Side>,
>(
  state: State,
  revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
): State {
  let nextState = { ...state };

  for (const i of [0, 1]) {
    const downloadUrl = nextState.sides[i].downloadUrl;
    if (downloadUrl) revokeObjectUrl(downloadUrl);

    nextState = cleanMerge(nextState, `sides.${i}`, {
      processed: undefined,
      file: undefined,
      downloadUrl: undefined,
      data: undefined,
      encodedSettings: undefined,
    });
  }

  return nextState;
}

export function setPreprocessedSourceState<
  Side extends ResettableSideState,
  State extends PreprocessedSourceState<Side>,
>(
  state: State,
  source: unknown,
  preprocessorState: unknown,
  preprocessedData: unknown,
  revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
): State {
  const nextState = {
    ...state,
    loading: false,
    source,
    encodedPreprocessorState: preprocessorState,
    sides: state.sides.map((side) => ({
      ...side,
      data: preprocessedData,
      processed: undefined,
      encodedSettings: undefined,
    })) as [Side, Side],
  };

  return resetSidesForNewSourceData(nextState, revokeObjectUrl);
}

export function applySavedSideSettings<Side extends SavedSettingsSide>(
  sides: [Side, Side],
  index: 0 | 1,
  savedSettings: SavedSettingsSide,
): SavedSideSettingsUpdate<Side> {
  const oldSide = sides[index];
  return {
    sides: cleanSet(sides, index, {
      ...oldSide,
      ...savedSettings,
    }),
    oldSide,
  };
}

export function restoreSide<Side>(
  sides: [Side, Side],
  index: SideIndex,
  side: Side,
): [Side, Side] {
  return cleanSet(sides, index, side);
}

export function setSideEncoderType<Side extends LatestSettingsSide>(
  sides: [Side, Side],
  index: SideIndex,
  newType: SideOutputType,
): [Side, Side] {
  return cleanSet(
    sides,
    `${index}.latestSettings.encoderState`,
    newType === 'identity'
      ? undefined
      : {
          type: newType,
          options: encoderMap[newType].meta.defaultOptions,
        },
  );
}

export function setSideEncoderOptions<Side extends LatestSettingsSide>(
  sides: [Side, Side],
  index: SideIndex,
  options: EncoderOptions,
): [Side, Side] {
  return cleanSet(
    sides,
    `${index}.latestSettings.encoderState.options`,
    options,
  );
}

export function setSideProcessorState<Side extends LatestSettingsSide>(
  sides: [Side, Side],
  index: SideIndex,
  processorState: ProcessorState,
): [Side, Side] {
  return cleanSet(
    sides,
    `${index}.latestSettings.processorState`,
    processorState,
  );
}

export function setSideLoading<Side extends LoadableSide>(
  sides: [Side, Side],
  index: SideIndex,
  loading: boolean,
): [Side, Side] {
  return cleanMerge(sides, index, { loading });
}

export function setSideProcessedResult<Side extends ProcessingSideState>(
  sides: [Side, Side],
  index: SideIndex,
  processed: unknown,
  processorState: ProcessorState,
): [Side, Side] {
  const currentSide = sides[index];
  return cleanSet(sides, index, {
    ...currentSide,
    processed,
    data: processed,
    encodedSettings: {
      ...currentSide.encodedSettings,
      processorState,
    },
  });
}

export function setSideEncodedResult<Side extends EncodedSideState>(
  sides: [Side, Side],
  index: SideIndex,
  result: {
    data: unknown;
    file: unknown;
    processed: unknown;
    processorState: ProcessorState;
    encoderState: SideSettings['encoderState'];
  },
  createObjectUrl: (file: unknown) => string = (file) =>
    URL.createObjectURL(file as Blob),
  revokeObjectUrl: (url: string) => void = URL.revokeObjectURL,
): [Side, Side] {
  const currentSide = sides[index];

  if (currentSide.downloadUrl) {
    revokeObjectUrl(currentSide.downloadUrl);
  }

  return cleanSet(sides, index, {
    ...currentSide,
    data: result.data,
    file: result.file,
    downloadUrl: createObjectUrl(result.file),
    loading: false,
    processed: result.processed,
    encodedSettings: {
      processorState: result.processorState,
      encoderState: result.encoderState,
    },
  });
}
