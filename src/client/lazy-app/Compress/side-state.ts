import { cleanMerge, cleanSet } from '../util/clean-modify';

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

export interface SavedSettingsSide {
  latestSettings: unknown;
  encodedSettings?: unknown;
}

export interface SavedSideSettingsUpdate<Side extends SavedSettingsSide> {
  sides: [Side, Side];
  oldSide: Side;
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
