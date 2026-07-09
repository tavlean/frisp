import type {
  EncoderOptions,
  EncoderState,
  EncoderType,
  ProcessorState,
} from 'client/lazy-app/feature-meta/shared';
import { stableStringify } from 'shared/stable-stringify';
import { controlsForEncoderType, type BulkControl } from './controls';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K];
};

export interface BulkImageSettings {
  encoderState?: EncoderState;
  processorState: ProcessorState;
  resizeReference?: BulkSourceDimensions;
}

export interface BulkSourceDimensions {
  width?: number;
  height?: number;
}

export interface BulkImageOverrides {
  encoderState?: EncoderState;
  encoderControls?: BulkEncoderControlOverrides;
  processorState?: DeepPartial<ProcessorState>;
}

export interface BulkEncoderControlOverrides {
  type: EncoderType;
  controlIds: string[];
  values: Record<string, Record<string, unknown>>;
}

const resizePresets = [0.25, 0.5, 1] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function mergeDeep<T>(base: T, override: DeepPartial<T> | undefined | null): T {
  if (override === undefined || override === null) return base;
  if (!isRecord(base) || !isRecord(override)) return override as T;

  const result: Record<string, unknown> = { ...base };

  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;
    result[key] = mergeDeep(result[key], value);
  }

  return result as T;
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function fieldValues<T extends object>(
  source: T,
  fields: readonly string[],
): Record<string, unknown> {
  const sourceRecord = source as Record<string, unknown>;
  const values: Record<string, unknown> = {};
  for (const field of fields) {
    values[field] = sourceRecord[field];
  }
  return values;
}

function controlEqual<T extends object>(
  control: BulkControl<T>,
  a: T,
  b: T,
): boolean {
  return control.equal
    ? control.equal(a, b)
    : control.fields.every((field) => a[field] === b[field]);
}

function toEncoderOptions(options: EncoderOptions): EncoderOptions {
  return structuredClone(options);
}

function sparseEncoderControlsFromState(
  globalEncoderState: EncoderState | undefined,
  overrideEncoderState: EncoderState | undefined,
): BulkEncoderControlOverrides | undefined {
  if (
    !globalEncoderState ||
    !overrideEncoderState ||
    globalEncoderState.type !== overrideEncoderState.type
  ) {
    return;
  }

  const controls = controlsForEncoderType(globalEncoderState.type);
  if (controls.length === 0) return;

  const controlIds: string[] = [];
  const values: BulkEncoderControlOverrides['values'] = {};
  const globalOptions = globalEncoderState.options as EncoderOptions;
  const overrideOptions = overrideEncoderState.options as EncoderOptions;

  for (const control of controls) {
    if (controlEqual(control, globalOptions, overrideOptions)) continue;
    controlIds.push(control.id);
    values[control.id] = fieldValues(overrideOptions, control.fields);
  }

  if (controlIds.length === 0) return;
  return {
    type: globalEncoderState.type,
    controlIds,
    values,
  };
}

export function normalizeImageOverrides(
  globalSettings: BulkImageSettings,
  overrides: BulkImageOverrides,
): BulkImageOverrides {
  if (overrides.encoderState) {
    const encoderControls = sparseEncoderControlsFromState(
      globalSettings.encoderState,
      overrides.encoderState,
    );
    if (encoderControls) return { ...overrides, encoderControls };

    const { encoderControls: _dropped, ...rest } = overrides;
    return rest;
  }

  return overrides;
}

function hasPositiveDimensions(
  dimensions: BulkSourceDimensions | undefined,
): dimensions is Required<BulkSourceDimensions> {
  if (!dimensions) return false;
  const { width, height } = dimensions;
  return Boolean(
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width !== undefined &&
    height !== undefined &&
    width > 0 &&
    height > 0,
  );
}

function getMatchingResizePreset(
  width: number,
  height: number,
  inputWidth: number,
  inputHeight: number,
): number | 'custom' {
  for (const preset of resizePresets) {
    if (
      width === Math.round(inputWidth * preset) &&
      height === Math.round(inputHeight * preset)
    ) {
      return preset;
    }
  }
  return 'custom';
}

function resizeCounts(
  resize: ProcessorState['resize'],
  sourceDimensions?: BulkSourceDimensions,
): boolean {
  if (!resize.enabled) return false;
  if (!hasPositiveDimensions(sourceDimensions)) return true;
  return (
    resize.width !== sourceDimensions.width ||
    resize.height !== sourceDimensions.height
  );
}

function normalizedProcessorRecipe(
  processorState: ProcessorState,
  sourceDimensions?: BulkSourceDimensions,
): {
  quantize: ProcessorState['quantize'] | null;
  resize: ProcessorState['resize'] | null;
} {
  return {
    quantize: processorState.quantize.enabled
      ? clone(processorState.quantize)
      : null,
    resize: resizeCounts(processorState.resize, sourceDimensions)
      ? clone(processorState.resize)
      : null,
  };
}

export function normalizedSettingsRecipe(
  settings: BulkImageSettings,
  sourceDimensions?: BulkSourceDimensions,
): {
  encoderState: {
    type: EncoderState['type'];
    options: EncoderState['options'];
  } | null;
  processorState: ReturnType<typeof normalizedProcessorRecipe>;
} {
  return {
    encoderState: settings.encoderState
      ? {
          type: settings.encoderState.type,
          options: clone(settings.encoderState.options),
        }
      : null,
    processorState: normalizedProcessorRecipe(
      settings.processorState,
      sourceDimensions,
    ),
  };
}

export function getEffectiveSettings(
  globalSettings: BulkImageSettings,
  overrides: BulkImageOverrides = {},
): BulkImageSettings {
  const hasResizeOverride = overrides.processorState?.resize !== undefined;
  const encoderState = getEffectiveEncoderState(globalSettings, overrides);
  return {
    encoderState,
    processorState: mergeDeep(
      globalSettings.processorState,
      overrides.processorState,
    ),
    resizeReference: hasResizeOverride
      ? undefined
      : globalSettings.resizeReference,
  };
}

function getEffectiveEncoderState(
  globalSettings: BulkImageSettings,
  overrides: BulkImageOverrides,
): EncoderState | undefined {
  if (!globalSettings.encoderState) return overrides.encoderState;
  if (
    overrides.encoderState &&
    overrides.encoderState.type !== globalSettings.encoderState.type
  ) {
    return overrides.encoderState;
  }

  const sparse =
    overrides.encoderControls ??
    sparseEncoderControlsFromState(
      globalSettings.encoderState,
      overrides.encoderState,
    );
  if (!sparse || sparse.type !== globalSettings.encoderState.type) {
    return globalSettings.encoderState;
  }

  const controls = controlsForEncoderType(sparse.type);
  if (controls.length === 0)
    return overrides.encoderState ?? globalSettings.encoderState;

  const targetOptions = toEncoderOptions(
    globalSettings.encoderState.options as EncoderOptions,
  );
  for (const controlId of sparse.controlIds) {
    const control = controls.find((item) => item.id === controlId);
    const values = sparse.values[controlId];
    if (!control || !values) continue;
    const sourceOptions = {
      ...(targetOptions as Record<string, unknown>),
      ...values,
    } as EncoderOptions;
    control.apply(sourceOptions, targetOptions);
  }

  return {
    type: globalSettings.encoderState.type,
    options: targetOptions,
  } as EncoderState;
}

export function hasSettingsOverrides(
  overrides: BulkImageOverrides | undefined,
): boolean {
  if (!overrides) return false;
  return Boolean(
    overrides.encoderState ||
    hasDefinedOverride(overrides.encoderControls?.values) ||
    hasDefinedOverride(overrides.processorState),
  );
}

function hasDefinedOverride(value: unknown): boolean {
  if (value === undefined) return false;
  if (!isRecord(value)) return true;
  return Object.values(value).some(hasDefinedOverride);
}

function collectDefinedOverridePaths(
  value: unknown,
  parentPath: string,
  paths: string[],
): void {
  if (value === undefined) return;
  if (!isRecord(value)) {
    if (parentPath) paths.push(parentPath);
    return;
  }

  for (const [key, childValue] of Object.entries(value)) {
    collectDefinedOverridePaths(
      childValue,
      parentPath ? `${parentPath}.${key}` : key,
      paths,
    );
  }
}

export function getSettingsOverridePaths(
  overrides: BulkImageOverrides | undefined,
): string[] {
  if (!overrides) return [];
  const paths: string[] = [];
  if (overrides.encoderState) paths.push('encoderState');
  if (!overrides.encoderState && overrides.encoderControls) {
    paths.push(...overrides.encoderControls.controlIds);
  }
  collectDefinedOverridePaths(
    overrides.processorState,
    'processorState',
    paths,
  );
  return paths;
}

export function resolveSettingsForSource(
  settings: BulkImageSettings,
  sourceDimensions?: BulkSourceDimensions,
): BulkImageSettings {
  if (
    !settings.processorState.resize.enabled ||
    !hasPositiveDimensions(settings.resizeReference) ||
    !hasPositiveDimensions(sourceDimensions)
  ) {
    return settings;
  }

  const resize = settings.processorState.resize;
  const preset = getMatchingResizePreset(
    resize.width,
    resize.height,
    settings.resizeReference.width,
    settings.resizeReference.height,
  );
  if (preset === 'custom') return settings;
  const size = {
    width: Math.round(sourceDimensions.width * preset),
    height: Math.round(sourceDimensions.height * preset),
  };

  return {
    ...settings,
    processorState: {
      ...settings.processorState,
      resize: {
        ...resize,
        width: size.width,
        height: size.height,
      },
    },
  };
}

export function settingsHash(
  settings: BulkImageSettings,
  sourceDimensions?: BulkSourceDimensions,
): string {
  return stableStringify(
    normalizedSettingsRecipe(
      resolveSettingsForSource(settings, sourceDimensions),
      sourceDimensions,
    ),
  );
}
