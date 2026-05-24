import { hasSavedSideSettings } from '../saved-settings';
import type { SideIndex } from '../side-state';

export interface SavedSideSettingsAvailability {
  hasLeftSideSettings: boolean;
  hasRightSideSettings: boolean;
}

export type SavedSideSettingsEventKey =
  | 'leftSideSettings'
  | 'rightSideSettings';

export function getSavedSideSettingsAvailability(
  hasSettings = hasSavedSideSettings,
): SavedSideSettingsAvailability {
  return {
    hasLeftSideSettings: hasSettings('leftSideSettings'),
    hasRightSideSettings: hasSettings('rightSideSettings'),
  };
}

export function canImportSavedSideSettings(
  availability: SavedSideSettingsAvailability,
  index: SideIndex,
): boolean {
  return index === 0
    ? availability.hasLeftSideSettings
    : availability.hasRightSideSettings;
}

export function getSavedSideSettingsAvailabilityUpdate(
  eventKey: SavedSideSettingsEventKey,
  availability = getSavedSideSettingsAvailability(),
): Partial<SavedSideSettingsAvailability> {
  if (eventKey === 'leftSideSettings') {
    return {
      hasLeftSideSettings: availability.hasLeftSideSettings,
    };
  }

  return {
    hasRightSideSettings: availability.hasRightSideSettings,
  };
}
