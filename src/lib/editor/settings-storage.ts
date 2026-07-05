import { IDENTITY, OUTPUT_FORMATS, type SideFormat } from '$lib/compress';
import type { ProcessorState } from 'client/lazy-app/feature-meta';

/**
 * The editor's localStorage persistence: the auto-saved encoder settings (both
 * sides' format + per-format options, written on a debounce as the user edits)
 * and the explicit per-side "save settings" slots the Save/Import buttons use.
 *
 * Pure parse / validate / serialize / read / write helpers only — no reactive
 * state, no Svelte runes (this is a plain `.ts` module by design). The debounce
 * timers and snackbar UX stay in EditorSession.
 *
 * HARD RULE: these keys are deliberately brand-free namespace strings. They are
 * storage schema, not branding, and never follow a rebrand; frozen from here on.
 * Renamed one final time 2026-07-05, days after the production domain cutover,
 * while the origin change had already reset all client storage (user base ≈
 * zero), so nothing was lost. No migration shim wanted.
 */

// A side of the auto-saved settings payload (STORAGE_KEY). The `sides` array
// stores just the encoder recipe — format + per-format options — per side.
export type SavedSide = {
  format?: string;
  optionsByFormat?: Record<string, Record<string, unknown>>;
};

type SideIndex = 0 | 1;

// Bumped v2 → v3 when the default WebP options changed (quality 80 / method 6)
// and to discard pre-existing persisted side settings that would otherwise mask
// the new defaults (e.g. a stale AVIF-on-both-sides config). Old keys are simply
// ignored; a fresh default (left = Original, right = WebP) loads instead.
const STORAGE_KEY = 'app:settings:v3';
const SAVE_VERSION = 1;

const sideSaveKey = (index: SideIndex) =>
  `app:side-settings:${index === 0 ? 'left' : 'right'}`;

function canUseLocalStorage(): boolean {
  return typeof localStorage !== 'undefined';
}

function isValidFormat(format: unknown): format is SideFormat {
  return (
    format === IDENTITY || OUTPUT_FORMATS.some((option) => option.id === format)
  );
}

function isValidProcessorState(value: unknown): value is ProcessorState {
  const state = value as ProcessorState | undefined;
  return (
    !!state &&
    typeof state === 'object' &&
    !!state.resize &&
    typeof state.resize.enabled === 'boolean' &&
    // Match the original: every inner value must be present (reject a partial
    // payload like { enabled: true, width: null }).
    Object.values(state.resize).every((v) => v != null) &&
    !!state.quantize &&
    typeof state.quantize.enabled === 'boolean' &&
    Object.values(state.quantize).every((v) => v != null)
  );
}

function readSaved(): { sides?: SavedSide[] } {
  if (!canUseLocalStorage()) return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') ?? {};
  } catch {
    return {};
  }
}

type ParsedSide = {
  format: SideFormat;
  optionsByFormat?: Record<string, Record<string, unknown>>;
  processorState: ProcessorState;
};

/** Parse + validate a stored side payload; null if absent, corrupt, or invalid. */
function parseSavedSide(raw: string | null): ParsedSide | null {
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const data = parsed as {
    version?: number;
    settings?: Record<string, unknown>;
  } & Record<string, unknown>;
  const incoming = (data?.settings ?? data) as {
    format?: unknown;
    optionsByFormat?: Record<string, Record<string, unknown>>;
    processorState?: unknown;
  };
  if (
    !isValidFormat(incoming.format) ||
    !isValidProcessorState(incoming.processorState)
  ) {
    return null;
  }
  return {
    format: incoming.format,
    optionsByFormat: incoming.optionsByFormat,
    processorState: incoming.processorState,
  };
}

function hasSavedSide(index: SideIndex): boolean {
  // Validate the payload (not just key presence) so a corrupt entry correctly
  // reports as not-importable and the Import button stays disabled.
  if (!canUseLocalStorage()) return false;
  return parseSavedSide(localStorage.getItem(sideSaveKey(index))) !== null;
}

/**
 * Coerce saved option values back to whole numbers wherever the format's
 * default for that field is an integer. Older builds let the magnetic sliders
 * persist fractional values (e.g. WebP `quality: 88.7`); the current sliders
 * round on input, but a stale decimal already in localStorage would otherwise
 * load and render as a decimal forever. Fields whose default is genuinely
 * fractional are left untouched.
 */
function sanitizeSavedOptions(
  defaults: Record<string, unknown>,
  saved: Record<string, unknown>,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...defaults, ...saved };
  for (const [key, value] of Object.entries(merged)) {
    const fallback = defaults[key];
    if (
      typeof value === 'number' &&
      !Number.isInteger(value) &&
      typeof fallback === 'number' &&
      Number.isInteger(fallback)
    ) {
      merged[key] = Math.round(value);
    }
  }
  return merged;
}

/**
 * Write the auto-saved settings payload. The caller (EditorSession.flushSettings)
 * owns the debounce and builds the payload string; this only absorbs the write's
 * try/catch — storage may be unavailable in private browsing modes.
 */
function writeSettings(payload: string): void {
  if (!canUseLocalStorage()) return;
  try {
    localStorage.setItem(STORAGE_KEY, payload);
  } catch {
    // Storage may be unavailable in private browsing modes.
  }
}

/**
 * Write one explicit per-side save slot. Returns false on failure so the caller
 * (EditorSession.saveSide) can pick which snackbar to show.
 */
function writeSideSettings(index: SideIndex, payload: string): boolean {
  try {
    localStorage.setItem(sideSaveKey(index), payload);
    return true;
  } catch {
    // Storage may be unavailable in private browsing modes.
    return false;
  }
}

export {
  SAVE_VERSION,
  canUseLocalStorage,
  hasSavedSide,
  isValidFormat,
  parseSavedSide,
  readSaved,
  sanitizeSavedOptions,
  sideSaveKey,
  writeSettings,
  writeSideSettings,
};
export type { SideIndex };
