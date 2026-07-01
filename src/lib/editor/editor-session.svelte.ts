import { untrack } from 'svelte';
import {
  compressFile,
  getDefaultOptions,
  IDENTITY,
  OUTPUT_FORMATS,
  type CompressOutcome,
  type SideFormat,
} from '$lib/compress';
import { ResultCache } from '$lib/result-cache';
import SvelteKitWorkerBridge from '$lib/sveltekit-worker-bridge';
import type { ResizeOptionsState } from './options/processor-types';
import { EditorHistory } from './editor-history.svelte';
import { snackbar } from './snackbar-store.svelte';
import { isAbortError } from 'client/lazy-app/abort';
import {
  defaultPreprocessorState,
  defaultProcessorState,
} from 'client/lazy-app/feature-meta';
import type {
  PreprocessorState,
  ProcessorState,
} from 'client/lazy-app/feature-meta';

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

/**
 * The editor's editable "document": both sides' encoder recipes plus the shared
 * preprocessor (rotation). This — and only this — is what undo/redo captures and
 * restores. The source file, encoded results, and transient status all live
 * outside it (a result is derived from a document, not part of it).
 */
export interface DocSnapshot {
  sides: [SideState, SideState];
  preprocessorState: PreprocessorState;
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
// How long the document must sit unchanged before a new undo step is committed.
// Slightly longer than the encode debounce so a slider DRAG coalesces into ONE
// undo step (its settled value) rather than dozens of intermediate ones.
const HISTORY_COMMIT_DELAY = 350;

const sideSaveKey = (index: SideIndex) =>
  `sqush:side-settings:${index === 0 ? 'left' : 'right'}`;

const sideLabel = (index: SideIndex) => (index === 0 ? 'Left' : 'Right');

/**
 * JSON.stringify with sorted object keys, so logically-equal objects produce
 * identical signatures regardless of key insertion order (imported/saved
 * payloads arrive in an order we don't control; plain JSON.stringify would
 * silently turn them into permanent cache misses). Signatures are in-memory
 * only — cache keys and history dedupe — never persisted.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value))
    return '[' + value.map(stableStringify).join(',') + ']';
  const record = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(record)
      .sort()
      .map((key) => JSON.stringify(key) + ':' + stableStringify(record[key]))
      .join(',') +
    '}'
  );
}

/**
 * The canonical OUTPUT-AFFECTING projection of one side's document state: only
 * the active format's options matter (inactive formats can't be edited from
 * the UI), and a resize that doesn't change the output folds to null (disabled
 * resize in the history path; identity resize in the encode path). BOTH the
 * cache/encode signature and the history signature are built from this one
 * projection — that shared origin is what guarantees "undo lands on a cache
 * hit". If the two ever disagreed about what matters, undo would silently
 * degrade into re-encodes; change the projection here and nowhere else.
 */
function sideRecipe(
  format: SideFormat,
  options: unknown,
  processorState: ProcessorState,
  resizeCounts: boolean,
) {
  return {
    format,
    options: options ?? {},
    quantize: processorState.quantize,
    resize: resizeCounts ? processorState.resize : null,
  };
}

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
        savedForFormat
          ? sanitizeSavedOptions(defaults, savedForFormat)
          : defaults,
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

  // Undo/redo over the editable document (see DocSnapshot). The UI reads
  // `history.canUndo` / `history.canRedo` to drive the toolbar buttons.
  history = new EditorHistory<DocSnapshot>();

  // Finished encode results keyed by their input signature, so stepping back to
  // a previous recipe (or just reverting a toggle) shows its image INSTANTLY
  // instead of re-running the pipeline. Owns the object-URL lifecycle for every
  // result it holds — revoked on eviction and on clear().
  private cache = new ResultCache();
  // The signature of the result currently displayed per side (set whenever a
  // result lands on screen, from a fresh encode OR a cache hit). Replaces the old
  // single-slot `encodedSig`: a pass whose signature still matches is redundant.
  private displayedSig: [string | null, string | null] = [null, null];
  // Encodes currently running, keyed by the same signature as the cache, so a
  // side whose recipe matches the other side's in-flight pass piggybacks on it
  // instead of burning the identical multi-second encode twice ("Copy settings
  // across" makes this a one-click situation). Not reactive; cleared with the
  // cache on a new file (the signature doesn't include file identity).
  private inflight = new Map<string, Promise<CompressOutcome>>();
  // True only while restoreDocument() is writing the document back during an
  // undo/redo, so the history watcher ignores its own restore writes.
  private restoringHistory = false;
  // Debounced commit timer for the history watcher (see watchHistory).
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
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
  // One persistent codec-worker bridge per side, created lazily on first encode
  // and kept for the session's lifetime. The bridge runtime is built for this:
  // lazy worker start, idle-timeout reclaim, terminate-on-abort with lazy
  // restart — so consecutive passes reuse a warm worker (WASM instantiated,
  // pthread pool spawned) instead of paying full startup per debounced tweak.
  // Per SIDE (not shared) so one side's abort never kills the other's pass.
  private bridges: [
    SvelteKitWorkerBridge | null,
    SvelteKitWorkerBridge | null,
  ] = [null, null];
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
      // One watcher commits debounced undo steps as the document changes.
      $effect(() => this.watchHistory());
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

    // A resize only counts as a *real* resize when it targets a size different from
    // the (preprocessed) source. At the source's own dimensions the default
    // interpolating filters are an identity pass, so "enabled at 100%" changes
    // nothing — it shouldn't run, nor read as "Resizing". Source dims are read
    // untracked so this never makes the encode depend on `results`.
    const resize = request.processorState.resize;
    const [srcW, srcH] = untrack(() => [this.naturalWidth, this.naturalHeight]);
    const resizeIsReal =
      resize.enabled &&
      srcW > 0 &&
      srcH > 0 &&
      (resize.width !== srcW || resize.height !== srcH);

    // Label the badge by WHAT changed this pass: diff the *effective* resize recipe
    // against the previous pass. A real resize-control change → "Resizing"; anything
    // else (quality/format/palette/rotate, or an identity resize) → "Optimizing".
    // Collapsing "no real resize" to a constant means toggling resize on at 100% —
    // or flipping Premultiply/Linear RGB, which only matter while actually scaling —
    // never masquerades as a resize edit. A new file always reads as 'optimize'
    // (fileChanged short-circuits before the diff can fire).
    const resizeSig = resizeIsReal ? stableStringify(resize) : 'off';
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

    // The signature of this pass's inputs: the preprocessor plus the canonical
    // side recipe (the complete input to compressFile, the source file aside —
    // that's guarded by fileChanged), with the resize folded in only when it
    // actually changes the image. It both (a) detects a redundant pass and
    // (b) keys the result cache. Built from the SAME sideRecipe projection as
    // docSig, so a history restore always recomputes to a cache-hitting key.
    const encodeSig = stableStringify({
      preprocessor: request.preprocessorState,
      recipe: sideRecipe(
        request.format,
        request.options,
        request.processorState,
        resizeIsReal,
      ),
    });

    // Already on screen for this side? Re-encoding would reproduce identical
    // bytes, so we don't: no wasted work, no badge flash. This is what makes
    // "enable resize at 100%" (and Premultiply/Linear RGB toggles at 100%) a true
    // no-op. `displayedSig` is set only when a result actually lands, so a prior
    // error or abort still retries.
    if (!fileChanged && this.displayedSig[index] === encodeSig) {
      this.statuses[index] = 'done';
      this.errors[index] = '';
      return;
    }

    // Computed before? Show it instantly from cache — the heart of "return to a
    // previous snapshot without re-optimizing". Settings the user revisits (undo,
    // redo, or toggling lossless off again) land here. The key is the signature
    // ALONE — no side index — because a result is purely a function of its inputs;
    // an encode the RIGHT side already produced is byte-identical on the LEFT, so
    // matching the other side's recipe loads instantly too.
    const cacheKey = encodeSig;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      this.showResult(index, cached, encodeSig);
      return;
    }

    this.statuses[index] = 'working';
    this.errors[index] = '';

    const controller = new AbortController();

    // A pass this side OWNS: runs the pipeline on this side's bridge and
    // publishes itself in `inflight` so the other side can piggyback.
    const startOwnPass = () => {
      const pass = compressFile(
        current,
        request,
        controller.signal,
        this.bridgeFor(index),
      );
      this.inflight.set(cacheKey, pass);
      const settle = () => {
        if (this.inflight.get(cacheKey) === pass)
          this.inflight.delete(cacheKey);
      };
      pass
        .then((outcome) => {
          settle();
          // Cache even when this side has already moved on (aborted between
          // completion and here): the finished result is valid, a piggybacking
          // side may be about to display it, and undo can reuse it. Revoking
          // here would race the other side; the cache owns the URL lifecycle.
          const existing = this.cache.get(cacheKey);
          if (existing) {
            // A concurrent identical pass cached this key first; drop ours.
            URL.revokeObjectURL(outcome.outputUrl);
            if (!controller.signal.aborted)
              this.showResult(index, existing, encodeSig);
            return;
          }
          this.cache.set(cacheKey, outcome);
          if (!controller.signal.aborted)
            this.showResult(index, outcome, encodeSig);
        })
        .catch((error: unknown) => {
          settle();
          if (controller.signal.aborted) return;
          this.errors[index] =
            error instanceof Error ? error.message : String(error);
          this.statuses[index] = 'error';
        });
    };

    const run = () => {
      this.statuses[index] = 'working';
      this.errors[index] = '';

      // The other side already computing this exact recipe? Await its pass. If
      // the OWNER aborts (its recipe changed) while this side still wants the
      // result, fall back to a pass of our own; a genuine encode error would
      // reproduce identically, so surface it instead of retrying.
      const shared = this.inflight.get(cacheKey);
      if (shared) {
        shared
          .then((outcome) => {
            if (controller.signal.aborted) return;
            this.showResult(index, outcome, encodeSig);
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            if (isAbortError(error)) {
              startOwnPass();
              return;
            }
            this.errors[index] =
              error instanceof Error ? error.message : String(error);
            this.statuses[index] = 'error';
          });
        return;
      }

      startOwnPass();
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

  /** The side's persistent bridge, created on first use (see `bridges`). */
  private bridgeFor(index: SideIndex): SvelteKitWorkerBridge {
    return (this.bridges[index] ??= new SvelteKitWorkerBridge());
  }

  /**
   * Put a result (fresh or cached) on screen for a side and record what produced
   * it. `results` is `$state.raw`, so we reassign the array rather than mutate an
   * element in place — only reassignment triggers reactive updates.
   */
  private showResult(
    index: SideIndex,
    outcome: CompressOutcome,
    sig: string,
  ): void {
    const nextResults: [CompressOutcome | null, CompressOutcome | null] = [
      this.results[0],
      this.results[1],
    ];
    nextResults[index] = outcome;
    this.results = nextResults;
    this.displayedSig[index] = sig;
    this.statuses[index] = 'done';
    this.errors[index] = '';
    this.pinDisplayedResults();
  }

  /**
   * Tell the cache which results are currently on screen so it never evicts (and
   * revokes the URL of) something the editor is still showing.
   */
  private pinDisplayedResults(): void {
    const keys: string[] = [];
    if (this.displayedSig[0] !== null) keys.push(this.displayedSig[0]);
    if (this.displayedSig[1] !== null) keys.push(this.displayedSig[1]);
    // A Set in ResultCache dedupes the two when both sides show the same recipe.
    this.cache.setPinned(keys);
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

  // ── Undo / redo ──────────────────────────────────────────────────────────
  // The document (DocSnapshot) is captured into `history` as it settles, and
  // written back on undo/redo. Restoring re-runs the encode effect, which finds
  // the matching result in `cache` and shows it instantly — so stepping through
  // history never waits on a re-encode.

  /** A detached, immutable snapshot of the current document. */
  private captureDocument(): DocSnapshot {
    return {
      sides: [this.snapshotSide(0), this.snapshotSide(1)],
      preprocessorState: $state.snapshot(
        this.preprocessorState,
      ) as PreprocessorState,
    };
  }

  private snapshotSide(index: SideIndex): SideState {
    const side = this.sides[index];
    return {
      format: side.format,
      optionsByFormat: $state.snapshot(side.optionsByFormat) as Record<
        string,
        Record<string, unknown>
      >,
      processorState: $state.snapshot(side.processorState) as ProcessorState,
    };
  }

  /**
   * A fingerprint of the document's OUTPUT-AFFECTING fields, used to dedupe undo
   * steps. Deliberately narrower than the raw snapshot: only the active format's
   * options matter (inactive formats can't be edited from the UI), and a disabled
   * resize folds to null so seeding its width/height — which doesn't change the
   * output — never spawns a phantom undo step.
   */
  private docSig(doc: DocSnapshot): string {
    // resizeCounts = `enabled` here (not the encode path's "real resize"):
    // history can't know the source dims, and an enabled-at-100% step is still
    // a document state the user can undo to. The encode path folds it to the
    // same key as resize-off anyway, so the restore still lands on a cache hit.
    return stableStringify({
      preprocessor: doc.preprocessorState,
      sides: doc.sides.map((side) =>
        sideRecipe(
          side.format,
          side.optionsByFormat[side.format] ?? {},
          side.processorState,
          side.processorState.resize.enabled,
        ),
      ),
    });
  }

  /**
   * Reactive watcher: commits a debounced undo step whenever the document
   * settles. The synchronous `captureDocument()` read registers every nested
   * field as a dependency (Svelte effects don't track deep mutations otherwise),
   * so slider drags re-run this. The commit itself is deferred — and skipped
   * during a restore, and de-duped by signature — so it never loops.
   */
  private watchHistory(): (() => void) | void {
    const doc = this.captureDocument();
    // Undo is scoped to an open image, and must ignore our own restore writes.
    if (!this.file || this.restoringHistory) return;
    const sig = this.docSig(doc);

    if (this.historyTimer !== null) clearTimeout(this.historyTimer);
    this.historyTimer = setTimeout(() => {
      this.historyTimer = null;
      this.history.commit(doc, sig);
    }, HISTORY_COMMIT_DELAY);

    return () => {
      if (this.historyTimer !== null) {
        clearTimeout(this.historyTimer);
        this.historyTimer = null;
      }
    };
  }

  /**
   * Force any pending debounced step to commit NOW. Called before undo/redo so an
   * edit the user just made (still inside the debounce window) is captured first
   * and remains reachable via redo.
   */
  private flushHistory(): void {
    if (this.historyTimer !== null) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    if (!this.file) return;
    const doc = this.captureDocument();
    this.history.commit(doc, this.docSig(doc));
  }

  /** Seed a fresh history baseline for a newly loaded image. */
  private resetHistory(): void {
    if (this.historyTimer !== null) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    const doc = this.captureDocument();
    this.history.reset(doc, this.docSig(doc));
  }

  /** Write a snapshot back into the live document without re-entering history. */
  private restoreDocument(doc: DocSnapshot): void {
    this.restoringHistory = true;
    this.applySide(0, doc.sides[0]);
    this.applySide(1, doc.sides[1]);
    this.preprocessorState = structuredClone(doc.preprocessorState);
    // Clear the guard in a microtask, after the watcher effect has reacted to the
    // writes above (effects flush in a microtask). The signature dedupe is the
    // real safety net; this just avoids a wasted debounce cycle.
    queueMicrotask(() => {
      this.restoringHistory = false;
    });
  }

  undo(): void {
    this.flushHistory();
    const doc = this.history.undo();
    if (doc) this.restoreDocument(doc);
  }

  redo(): void {
    this.flushHistory();
    const doc = this.history.redo();
    if (doc) this.restoreDocument(doc);
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
    // Drop the previous image's cached results (and revoke their URLs); a new
    // source invalidates every one of them. The in-flight map goes with it —
    // its keys don't include file identity either (the old passes still abort
    // via the encode effects' cleanup; their settle() guard tolerates this).
    this.cache.clear();
    this.inflight.clear();
    this.displayedSig = [null, null];
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

    // Seed undo with this image's starting recipe as the baseline. Per-image
    // scope: loading a new image discards the previous one's history.
    this.resetHistory();

    if (opening) pushEditorHistory();
  }

  clearFile(): void {
    this.file = null;
    this.results = [null, null];
    this.errors = ['', ''];
    this.statuses = ['idle', 'idle'];
    this.spinnerDelayPassed = [false, false];
    this.preprocessorState = structuredClone(defaultPreprocessorState);
    this.displayedSig = [null, null];
    this.cache.clear();
    this.inflight.clear();
    this.history.clear();
  }

  dispose(): void {
    // Tear down the encode/spinner effects this instance set up in its
    // constructor.
    this.stopEffects?.();
    this.stopEffects = null;
    if (this.historyTimer !== null) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
    // Persist any pending settings change before teardown so the debounce never
    // drops the user's last edit.
    this.flushSettings();
    this.cache.clear();
    for (const bridge of this.bridges) bridge?.dispose();
    this.bridges = [null, null];
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
}
