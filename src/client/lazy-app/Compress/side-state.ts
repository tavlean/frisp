import { cleanMerge } from '../util/clean-modify';

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
