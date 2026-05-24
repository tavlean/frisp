import type { SupportedEncoderMap } from './encoder-support';
import {
  getSavedSideSettingsAvailability,
  type SavedSideSettingsAvailability,
} from './saved-settings-state';

export interface OptionsState extends SavedSideSettingsAvailability {
  supportedEncoderMap?: SupportedEncoderMap;
}

export function getInitialOptionsState(
  availability = getSavedSideSettingsAvailability(),
): OptionsState {
  return {
    supportedEncoderMap: undefined,
    ...availability,
  };
}

export function getSupportedEncoderMapLoadedState(
  supportedEncoderMap: SupportedEncoderMap,
): Pick<OptionsState, 'supportedEncoderMap'> {
  return { supportedEncoderMap };
}
