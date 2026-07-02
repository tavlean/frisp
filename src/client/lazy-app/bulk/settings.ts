import type {
  EncoderState,
  ProcessorState,
} from 'client/lazy-app/feature-meta/shared';

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
  processorState?: DeepPartial<ProcessorState>;
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

function stableStringify(value: unknown): string {
  if (!isRecord(value)) return JSON.stringify(value);

  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);

  return `{${entries.join(',')}}`;
}

function cloneOrNull<T>(value: T): T {
  return structuredClone(value);
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
      ? cloneOrNull(processorState.quantize)
      : null,
    resize: resizeCounts(processorState.resize, sourceDimensions)
      ? cloneOrNull(processorState.resize)
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
          options: cloneOrNull(settings.encoderState.options),
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
  return {
    encoderState: overrides.encoderState ?? globalSettings.encoderState,
    processorState: mergeDeep(
      globalSettings.processorState,
      overrides.processorState,
    ),
    resizeReference: hasResizeOverride
      ? undefined
      : globalSettings.resizeReference,
  };
}

export function hasSettingsOverrides(
  overrides: BulkImageOverrides | undefined,
): boolean {
  if (!overrides) return false;
  return Boolean(
    overrides.encoderState || hasDefinedOverride(overrides.processorState),
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
