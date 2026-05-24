import type { EncoderState, ProcessorState } from '../feature-meta';
import { encoderMap } from '../feature-meta';
import { readLocalStorage, writeLocalStorage } from '../storage';
import type { LocalStorageKey } from '../storage';
import type { SideIndex } from './side-state';

export interface SideSettings {
  processorState: ProcessorState;
  encoderState?: EncoderState;
}

export interface SavedSideSettings {
  encodedSettings?: SideSettings;
  latestSettings: SideSettings;
}

export const savedSideSettingsVersion = 1;

export const savedSideSettingsKeys: readonly [
  LocalStorageKey,
  LocalStorageKey,
] = ['leftSideSettings', 'rightSideSettings'];

interface VersionedSavedSideSettings {
  version: typeof savedSideSettingsVersion;
  settings: SavedSideSettings;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isEncoderState(value: unknown): value is EncoderState | undefined {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (typeof value.type !== 'string') return false;
  return (
    isRecord(value.options) &&
    Object.values(value.options).every((option) => option != null) &&
    Object.prototype.hasOwnProperty.call(encoderMap, value.type)
  );
}

function isProcessorState(value: unknown): value is ProcessorState {
  if (!isRecord(value)) return false;
  if (!isRecord(value.resize) || !isRecord(value.quantize)) return false;
  return (
    typeof value.resize.enabled === 'boolean' &&
    typeof value.quantize.enabled === 'boolean' &&
    Object.values(value.resize).every((option) => option != null) &&
    Object.values(value.quantize).every((option) => option != null)
  );
}

export function isSideSettings(value: unknown): value is SavedSideSettings {
  if (!isRecord(value) || !isRecord(value.latestSettings)) return false;
  const encodedSettings = value.encodedSettings;
  return (
    isProcessorState(value.latestSettings.processorState) &&
    isEncoderState(value.latestSettings.encoderState) &&
    (encodedSettings === undefined ||
      (isRecord(encodedSettings) &&
        isProcessorState(encodedSettings.processorState) &&
        isEncoderState(encodedSettings.encoderState)))
  );
}

function isVersionedSideSettings(
  value: unknown,
): value is VersionedSavedSideSettings {
  return (
    isRecord(value) &&
    value.version === savedSideSettingsVersion &&
    isSideSettings(value.settings)
  );
}

export function parseSavedSideSettings(
  serializedSettings: string,
): SavedSideSettings | undefined {
  try {
    const parsedSettings = JSON.parse(serializedSettings);
    if (isSideSettings(parsedSettings)) return parsedSettings;
    if (isVersionedSideSettings(parsedSettings)) return parsedSettings.settings;
  } catch (err) {
    return;
  }
}

export function getSavedSideSettingsKey(index: SideIndex): LocalStorageKey {
  return savedSideSettingsKeys[index];
}

export function getSideLabel(index: SideIndex): 'Left' | 'Right' {
  return index === 0 ? 'Left' : 'Right';
}

export function readSavedSideSettings(
  key: LocalStorageKey,
): SavedSideSettings | undefined {
  const serializedSettings = readLocalStorage(key);
  if (!serializedSettings) return;

  return parseSavedSideSettings(serializedSettings);
}

export function hasSavedSideSettings(key: LocalStorageKey): boolean {
  return readSavedSideSettings(key) !== undefined;
}

export function writeSavedSideSettings(
  key: LocalStorageKey,
  settings: SavedSideSettings,
): boolean {
  return writeLocalStorage(key, serializeSavedSideSettings(settings));
}

export function serializeSavedSideSettings(
  settings: SavedSideSettings,
): string {
  const versionedSettings: VersionedSavedSideSettings = {
    version: savedSideSettingsVersion,
    settings,
  };
  return JSON.stringify(versionedSettings);
}
