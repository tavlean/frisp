import { defaultPreprocessorState } from '../feature-meta';
import type { PreprocessorState } from '../feature-meta';
import type { SavedSideSettings } from './saved-settings';
import { getInitialSideStates, type InitialSideState } from './side-state';
import { getViewportState } from './viewport-state';

export interface InitialCompressionState {
  source: undefined;
  sides: [InitialSideState, InitialSideState];
  loading: false;
  mobileView: boolean;
  preprocessorState: PreprocessorState;
  encodedPreprocessorState?: PreprocessorState;
}

export function getInitialCompressionState(
  savedSettings: readonly [
    SavedSideSettings | undefined,
    SavedSideSettings | undefined,
  ],
  matchesMobileWidth: boolean,
): InitialCompressionState {
  return {
    source: undefined,
    loading: false,
    preprocessorState: defaultPreprocessorState,
    sides: getInitialSideStates(savedSettings),
    ...getViewportState(matchesMobileWidth),
  };
}
