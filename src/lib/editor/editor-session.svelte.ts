import { untrack } from 'svelte';
import {
  compressFile,
  getDefaultOptions,
  IDENTITY,
  OUTPUT_FORMATS,
  type CompressOutcome,
  type SideFormat,
} from '$lib/compress';
import type { ResizeOptionsState } from './options/processor-types';
import { snackbar } from './snackbar-store.svelte';
import {
  defaultPreprocessorState,
  defaultProcessorState,
} from 'client/lazy-app/feature-meta';
import type { ProcessorState } from 'client/lazy-app/feature-meta';

export type SideIndex = 0 | 1;
export type SideStatus = 'idle' | 'working' | 'done' | 'error';
// What a side's current pass is doing, for the badge wording. 'resize' when the
// pass was triggered by a resize-control change; 'optimize' for everything else
// (quality, format, palette, rotate). A pass always re-encodes regardless — this
// only labels the user's *action*, not the internal stages.
export type SideActivity = 'optimize' | 'resize';

export interface SideState {
  format: SideFormat;
  optionsByFormat: Record<string, Record<string, unknown>>;
  processorState: ProcessorState;
}

type SavedSide = {
  format?: string;
  optionsByFormat?: Record<string, Record<string, unknown>>;
};

// Bumped v2 → v3 when the default WebP options changed (quality 80 / method 6)
// and to discard pre-existing persisted side settings that would otherwise mask
// the new defaults (e.g. a stale AVIF-on-both-sides config). Old keys are simply
// ignored; a fresh default (left = Original, right = WebP) loads instead.
const STORAGE_KEY = 'sqush:settings:v3';
const SAVE_VERSION = 1;
const IMAGE_UPDATE_DELAY = 100;
const SPINNER_DELAY = 500;
const SETTINGS_PERSIST_DELAY = 200;

const sideSaveKey = (index: SideIndex) =>
  `sqush:side-settings:${index === 0 ? 'left' : 'right'}`;

const sideLabel = (index: SideIndex) => (index === 0 ? 'Left' : 'Right');

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

function buildSide(
  saved: SavedSide | undefined,
  fallback: SideFormat,
): SideState {
  const optionsByFormat = Object.fromEntries(
    OUTPUT_FORMATS.map((format) => {
      const defaults = getDefaultOptions(format.id);
      const savedForFormat = saved?.optionsByFormat?.[format.id];
      return [
        format.id,
        savedForFormat ? { ...defaults, ...savedForFormat } : defaults,
      ];
    }),
  );

  return {
    format: isValidFormat(saved?.format)
      ? (saved!.format as SideFormat)
      : fallback,
    optionsByFormat,
    processorState: structuredClone(defaultProcessorState),
  };
}

function snapshotProcessorStateForEncode(
  state: ProcessorState,
): ProcessorState {
  // `enabled` is read tracked (toggling resize must re-encode). When resize is
  // OFF, snapshot its width/height UNtracked: those values don't affect a
  // disabled-resize output, and `seedResizeDimensions()` writes them once a
  // result lands — so tracking them here would make the encode `$effect` depend
  // on width/height and fire a redundant re-encode right after the first one.
  const resizeEnabled = state.resize.enabled;
  return {
    quantize: $state.snapshot(state.quantize),
    resize: resizeEnabled
      ? $state.snapshot(state.resize)
      : untrack(() => $state.snapshot(state.resize)),
  };
}

function buildInitialSides(): [SideState, SideState] {
  // Read persisted settings once (not per side) and hydrate both sides.
  const saved = readSaved();
  return [
    buildSide(saved.sides?.[0], IDENTITY),
    buildSide(saved.sides?.[1], 'webP'),
  ];
}

export class EditorSession {
  sides = $state<[SideState, SideState]>(buildInitialSides());

  preprocessorState = $state(structuredClone(defaultPreprocessorState));
  file = $state<File | null>(null);
  loadId = $state(0);
  // Raw, not deeply proxied: each CompressOutcome holds heavy browser host
  // objects (File, ImageData, and a Blob object URL) that must stay out of
  // reactive state. Updates trigger by reassigning the array (see encodeSide),
  // not by mutating an element in place.
  results = $state.raw<[CompressOutcome | null, CompressOutcome | null]>([
    null,
    null,
  ]);
  statuses = $state<[SideStatus, SideStatus]>(['idle', 'idle']);
  // What each side's in-flight pass is doing, for the ProcessingBadge wording.
  // Set at encode start by diffing the resize recipe against the previous pass.
  activities = $state<[SideActivity, SideActivity]>(['optimize', 'optimize']);
  // The 500ms delayed loading spinner. `spinnerDelayPassed` is flipped true by
  // the updateSpinner effect once a side has been working for 500ms; showSpinner
  // AND-gates it with the live status so the spinner can never show outside a
  // 'working' spell and hides the instant a side stops working.
  spinnerDelayPassed = $state<[boolean, boolean]>([false, false]);
  showSpinner = $derived([
    this.statuses[0] === 'working' && this.spinnerDelayPassed[0],
    this.statuses[1] === 'working' && this.spinnerDelayPassed[1],
  ] as [boolean, boolean]);
  errors = $state<[string, string]>(['', '']);
  canImport = $state<[boolean, boolean]>([hasSavedSide(0), hasSavedSide(1)]);

  private lastUrls: [string | null, string | null] = [null, null];
  // Bookkeeping keyed to `loadId` (bumped on every new file). Comparing against
  // the live loadId replaces the old mutable prevFiles/dimsSeeded guards, so a
  // new file is detected automatically with no hand-reset in pickFiles/clearFile:
  //  - encodedLoadId: loadId each side last (re)started an encode at — a new
  //    file therefore encodes immediately, while option tweaks stay debounced.
  //  - seededLoadId: loadId the resize dims were last seeded at (one-shot/file).
  private encodedLoadId: [number, number] = [-1, -1];
  private seededLoadId = -1;
  // Resize recipe signature each side last encoded with, to tell a resize edit
  // apart from any other re-encode (see encodeSide / activities).
  private lastResizeSig: [string | null, string | null] = [null, null];
  // Disposes the per-side encode/spinner effects this instance owns (constructor).
  private stopEffects: (() => void) | null = null;
  // Debounced localStorage write for persistSettings (see flushSettings).
  private settingsTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSettings: string | null = null;

  naturalWidth = $derived(
    this.results[0]?.preprocessedWidth ??
      this.results[1]?.preprocessedWidth ??
      0,
  );

  naturalHeight = $derived(
    this.results[0]?.preprocessedHeight ??
      this.results[1]?.preprocessedHeight ??
      0,
  );

  isVectorSource = $derived(this.file?.type === 'image/svg+xml');

  // Every encoder is an always-available WASM codec, so the list is static.
  availableFormats = OUTPUT_FORMATS;

  leftContain = $derived(this.sideContains(0));
  rightContain = $derived(this.sideContains(1));
  firstError = $derived(this.errors.find((error) => error) ?? '');

  docTitle = $derived(
    (this.statuses.some((status) => status === 'working') ? '⏳ ' : '') +
      (this.file ? `${this.file.name} - ` : '') +
      'Sqush — Compress an image',
  );

  constructor() {
    // The class owns its per-side encode + spinner reactivity rather than having
    // +page.svelte create these effects and forward their cleanup-returning
    // methods. A component-detached $effect.root lets the instance set them up
    // here and tear them down in dispose().
    this.stopEffects = $effect.root(() => {
      for (const index of [0, 1] as const) {
        $effect(() => this.encodeSide(index));
        $effect(() => this.updateSpinner(index));
      }
    });
  }

  encodeSide(index: SideIndex): (() => void) | void {
    const current = this.file;
    const side = this.sides[index];
    const request = {
      format: side.format,
      options: $state.snapshot(side.optionsByFormat[side.format] ?? {}),
      processorState: snapshotProcessorStateForEncode(side.processorState),
      preprocessorState: $state.snapshot(this.preprocessorState),
    };
    // A new file bumps loadId; compare against the loadId this side last encoded
    // at, so a fresh image encodes immediately and option tweaks stay debounced.
    const fileChanged = this.loadId !== this.encodedLoadId[index];
    this.encodedLoadId[index] = this.loadId;

    // Label the badge by WHAT changed this pass, not by what's enabled: diff the
    // resize recipe against the previous pass. A resize-control change → "Resizing";
    // anything else (quality/format/palette/rotate) → "Optimizing". While resize is
    // OFF its width/height are irrelevant (and get seeded after the first result),
    // so collapse the disabled state to a constant signature — otherwise those
    // background dim writes would masquerade as a resize edit. A new file always
    // reads as 'optimize' (fileChanged short-circuits before the diff can fire).
    const resize = request.processorState.resize;
    const resizeSig = resize.enabled ? JSON.stringify(resize) : 'off';
    const prevSig = this.lastResizeSig[index];
    this.lastResizeSig[index] = resizeSig;
    this.activities[index] =
      !fileChanged && prevSig !== null && prevSig !== resizeSig
        ? 'resize'
        : 'optimize';

    if (!current) {
      this.statuses[index] = 'idle';
      return;
    }

    this.statuses[index] = 'working';
    this.errors[index] = '';

    const controller = new AbortController();
    const run = () => {
      this.statuses[index] = 'working';
      this.errors[index] = '';
      compressFile(current, request, controller.signal)
        .then((outcome) => {
          if (controller.signal.aborted) {
            URL.revokeObjectURL(outcome.outputUrl);
            return;
          }
          this.revokeSideUrl(index);
          this.lastUrls[index] = outcome.outputUrl;
          // results is $state.raw, so reassign the array rather than mutating an
          // element in place — only reassignment triggers reactive updates.
          const nextResults: [CompressOutcome | null, CompressOutcome | null] =
            [this.results[0], this.results[1]];
          nextResults[index] = outcome;
          this.results = nextResults;
          this.statuses[index] = 'done';
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          this.errors[index] =
            error instanceof Error ? error.message : String(error);
          this.statuses[index] = 'error';
        });
    };

    if (fileChanged) {
      run();
      return () => controller.abort();
    }

    const timer = setTimeout(run, IMAGE_UPDATE_DELAY);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }

  updateSpinner(index: SideIndex): (() => void) | void {
    // Manages only the 500ms delay; showSpinner is the $derived AND-gate above.
    if (this.statuses[index] !== 'working') {
      this.spinnerDelayPassed[index] = false;
      return;
    }

    const timer = setTimeout(() => {
      this.spinnerDelayPassed[index] = true;
    }, SPINNER_DELAY);

    return () => clearTimeout(timer);
  }

  syncRouteState(editorOpen: boolean): void {
    if (this.file && !editorOpen) this.clearFile();
  }

  seedResizeDimensions(): void {
    const result = this.results[0] ?? this.results[1];
    if (!result || this.seededLoadId === this.loadId) return;

    this.seededLoadId = this.loadId;
    for (const side of this.sides) {
      if (side.processorState.resize.enabled) continue;
      side.processorState.resize.width = result.preprocessedWidth;
      side.processorState.resize.height = result.preprocessedHeight;
    }
  }

  persistSettings(): void {
    if (!canUseLocalStorage()) return;
    // Serialise synchronously so the calling $effect tracks `format` and
    // `optionsByFormat` as dependencies (reads inside the deferred timer would
    // not be tracked)...
    this.pendingSettings = JSON.stringify({
      sides: this.sides.map((side) => ({
        format: side.format,
        optionsByFormat: $state.snapshot(side.optionsByFormat),
      })),
    });

    // ...but coalesce the actual write: dragging a slider would otherwise
    // serialise and hit localStorage on every reactive tick (~60×/s).
    if (this.settingsTimer !== null) clearTimeout(this.settingsTimer);
    this.settingsTimer = setTimeout(
      () => this.flushSettings(),
      SETTINGS_PERSIST_DELAY,
    );
  }

  private flushSettings(): void {
    if (this.settingsTimer !== null) {
      clearTimeout(this.settingsTimer);
      this.settingsTimer = null;
    }
    if (this.pendingSettings === null) return;
    const payload = this.pendingSettings;
    this.pendingSettings = null;
    try {
      localStorage.setItem(STORAGE_KEY, payload);
    } catch {
      // Storage may be unavailable in private browsing modes.
    }
  }

  pickFiles(
    list: FileList | null | undefined,
    pushEditorHistory: () => void,
  ): void {
    const next = list?.[0];
    if (!next) return;

    if (!next.type.startsWith('image/')) {
      snackbar.show(`"${next.name}" doesn't look like an image.`);
      return;
    }

    const opening = !this.file;
    this.revokeAllUrls();
    this.file = next;
    this.loadId += 1;
    this.results = [null, null];
    this.errors = ['', ''];
    this.statuses = ['idle', 'idle'];
    // Reset the spinner delay so the new file re-earns the 500ms grace; loadId
    // (bumped above) re-arms the encode + seed bookkeeping with no manual reset.
    this.spinnerDelayPassed = [false, false];

    // New-file reset policy — applies to a fresh open AND an in-place drag-drop
    // replace. The ENCODER recipe is KEPT: each side's `format` + `optionsByFormat`
    // (quality, effort, …) are left untouched, so swapping photos preserves your
    // compression target. The per-image settings are RESET below: rotation (a new
    // photo's orientation is unrelated to the last one) and the whole
    // processorState — resize (its dims re-seed to the new image anyway) and
    // palette reduction. Palette reduction is per-image and often *increases* size,
    // so silently carrying it onto an unrelated image is a footgun; deliberate
    // cross-image palette work belongs in bulk edit. This is an intentional
    // divergence from upstream Squoosh, which preserved rotation + palette across a
    // replace — don't "restore" that without revisiting this decision.
    this.preprocessorState = structuredClone(defaultPreprocessorState);

    const isVector = next.type === 'image/svg+xml';
    for (const side of this.sides) {
      side.processorState = structuredClone(defaultProcessorState);
      // Match the original: vector (SVG) sources default the resize method to
      // "vector" so re-rasterising at a new size stays crisp.
      if (isVector) {
        (side.processorState.resize as unknown as ResizeOptionsState).method =
          'vector';
      }
    }

    if (opening) pushEditorHistory();
  }

  clearFile(): void {
    this.file = null;
    this.results = [null, null];
    this.errors = ['', ''];
    this.statuses = ['idle', 'idle'];
    this.spinnerDelayPassed = [false, false];
    this.preprocessorState = structuredClone(defaultPreprocessorState);
    this.revokeAllUrls();
  }

  dispose(): void {
    // Tear down the encode/spinner effects this instance set up in its
    // constructor.
    this.stopEffects?.();
    this.stopEffects = null;
    // Persist any pending settings change before teardown so the debounce never
    // drops the user's last edit.
    this.flushSettings();
    this.revokeAllUrls();
  }

  rotate(): void {
    const previous = this.preprocessorState.rotate.rotate;
    const next = ((previous + 90) % 360) as 0 | 90 | 180 | 270;
    this.preprocessorState.rotate.rotate = next;

    // Match the original: on an orientation-changing rotate (90/270), swap each
    // side's resize width/height so the Resize fields + preset stay aligned with
    // the now-rotated source. Done for both sides regardless of resize.enabled.
    if (previous % 180 !== next % 180) {
      for (const side of this.sides) {
        const resize = side.processorState.resize;
        const { width, height } = resize;
        resize.width = height;
        resize.height = width;
      }
    }
  }

  setFormat(index: SideIndex, format: SideFormat): void {
    this.sides[index].format = format;
  }

  copyToOther(from: SideIndex): void {
    const to: SideIndex = from === 0 ? 1 : 0;
    const previous = $state.snapshot(this.sides[to]) as SideState;
    this.applySide(to, $state.snapshot(this.sides[from]) as SideState);
    snackbar
      .show('Settings copied across', { actions: ['undo'], timeout: 5000 })
      .then((action) => {
        if (action === 'undo') this.applySide(to, previous);
      });
  }

  saveSide(index: SideIndex): void {
    if (!canUseLocalStorage()) return;
    const label = sideLabel(index);

    try {
      localStorage.setItem(
        sideSaveKey(index),
        JSON.stringify({
          version: SAVE_VERSION,
          settings: {
            format: this.sides[index].format,
            optionsByFormat: $state.snapshot(this.sides[index].optionsByFormat),
            processorState: $state.snapshot(this.sides[index].processorState),
          },
        }),
      );
      this.canImport[index] = true;
      snackbar.show(`${label} side settings saved`, { timeout: 1500 });
    } catch {
      snackbar.show(`${label} side settings could not be saved`, {
        timeout: 3000,
      });
    }
  }

  importSide(index: SideIndex): void {
    if (!canUseLocalStorage()) return;
    const label = sideLabel(index);
    const raw = localStorage.getItem(sideSaveKey(index));
    if (!raw) return;

    // Same parse + validation the Import button's enabled state uses, so the
    // two cannot drift.
    const incoming = parseSavedSide(raw);
    if (!incoming) {
      snackbar.show(`${label} side settings are invalid`, { timeout: 3000 });
      return;
    }

    const previous = $state.snapshot(this.sides[index]) as SideState;
    this.sides[index].format = incoming.format;
    if (incoming.optionsByFormat) {
      this.sides[index].optionsByFormat = {
        ...this.sides[index].optionsByFormat,
        ...structuredClone(incoming.optionsByFormat),
      };
    }
    this.sides[index].processorState = structuredClone(incoming.processorState);
    snackbar
      .show(`${label} side settings imported`, {
        actions: ['undo'],
        timeout: 5000,
      })
      .then((action) => {
        if (action === 'undo') this.applySide(index, previous);
      });
  }

  downloadName(index: SideIndex): string {
    if (!this.file) return 'image';
    const side = this.sides[index];
    if (side.format === IDENTITY) return this.file.name;
    const extension =
      OUTPUT_FORMATS.find((format) => format.id === side.format)?.ext ?? 'bin';
    return this.file.name.replace(/\.[^.]+$/, '') + '.' + extension;
  }

  private applySide(index: SideIndex, snapshot: SideState): void {
    this.sides[index].format = snapshot.format;
    this.sides[index].optionsByFormat = structuredClone(
      snapshot.optionsByFormat,
    );
    this.sides[index].processorState = structuredClone(snapshot.processorState);
  }

  private sideContains(index: SideIndex): boolean {
    return (
      this.sides[index].processorState.resize.enabled &&
      this.sides[index].processorState.resize.fitMethod === 'contain'
    );
  }

  private revokeSideUrl(index: SideIndex): void {
    const url = this.lastUrls[index];
    if (!url) return;
    URL.revokeObjectURL(url);
    this.lastUrls[index] = null;
  }

  private revokeAllUrls(): void {
    this.revokeSideUrl(0);
    this.revokeSideUrl(1);
  }
}
