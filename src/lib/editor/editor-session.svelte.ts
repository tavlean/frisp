import { untrack } from 'svelte';
import {
  compressPreprocessed,
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
import { abortable, isAbortError } from 'client/lazy-app/abort';
import { APP_NAME } from 'shared/brand';
import { stableStringify } from 'shared/stable-stringify';
import {
  encodeSignature,
  resizeSignature,
  sideRecipe,
} from './encode-signature';
import {
  decodeSourceImage,
  preprocessImage,
  type DecodedSourceImage,
  type SourceImage,
} from 'client/lazy-app/image-pipeline';
import {
  defaultPreprocessorState,
  defaultProcessorState,
} from 'client/lazy-app/feature-meta';
import type {
  PreprocessorState,
  ProcessorState,
} from 'client/lazy-app/feature-meta';
import {
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
  type SavedSide,
  type SideIndex,
} from './settings-storage';

export type { SideIndex };
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

const IMAGE_UPDATE_DELAY = 100;
const SPINNER_DELAY = 500;
const SETTINGS_PERSIST_DELAY = 200;
// How long the document must sit unchanged before a new undo step is committed.
// Slightly longer than the encode debounce so a slider DRAG coalesces into ONE
// undo step (its settled value) rather than dozens of intermediate ones.
const HISTORY_COMMIT_DELAY = 350;

const sideLabel = (index: SideIndex) => (index === 0 ? 'Left' : 'Right');

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

/**
 * Per-side transient encode state, grouped so a side is one object instead of
 * an index into eight parallel tuples. Reactive fields are individually
 * $state/$derived (the containing tuple is a plain, never-reassigned pair —
 * class instances are not proxied; their fields carry the reactivity).
 */
export class SideRuntime {
  status = $state<SideStatus>('idle');
  // Set at encode start by diffing the resize recipe against the previous pass.
  activity = $state<SideActivity>('optimize');
  // Flipped true by the updateSpinner effect once 'working' for 500ms.
  spinnerDelayPassed = $state(false);
  error = $state('');
  // Raw: a CompressOutcome holds heavy host objects (File, ImageData, object
  // URL) that must stay out of the reactive graph. Reassign-only.
  result = $state.raw<CompressOutcome | null>(null);
  // The delayed-spinner AND-gate: never shows outside a 'working' spell.
  showSpinner = $derived(this.status === 'working' && this.spinnerDelayPassed);

  // Non-reactive bookkeeping (see encodeSide).
  displayedSig: string | null = null;
  encodedLoadId = -1;
  lastResizeSig: string | null = null;

  /** New-file / editor-close reset — exactly the fields pickFiles cleared. */
  reset(): void {
    this.status = 'idle';
    this.error = '';
    this.spinnerDelayPassed = false;
    this.result = null;
    this.displayedSig = null;
  }
}

export class EditorSession {
  sides = $state<[SideState, SideState]>(buildInitialSides());

  preprocessorState = $state(structuredClone(defaultPreprocessorState));
  file = $state<File | null>(null);
  loadId = $state(0);
  // Per-side transient encode state. A PLAIN tuple, never reassigned: each
  // SideRuntime is internally reactive (its $state/$derived fields carry the
  // reactivity), so wrapping the tuple in $state would double-proxy for nothing.
  readonly runtime: [SideRuntime, SideRuntime] = [
    new SideRuntime(),
    new SideRuntime(),
  ];
  canImport = $state<[boolean, boolean]>([hasSavedSide(0), hasSavedSide(1)]);

  // Undo/redo over the editable document (see DocSnapshot). The UI reads
  // `history.canUndo` / `history.canRedo` to drive the toolbar buttons.
  history = new EditorHistory<DocSnapshot>();

  // Finished encode results keyed by their input signature, so stepping back to
  // a previous recipe (or just reverting a toggle) shows its image INSTANTLY
  // instead of re-running the pipeline. Owns the object-URL lifecycle for every
  // result it holds — revoked on eviction and on clear().
  private cache = new ResultCache();
  // Encodes currently running, keyed by the same signature as the cache, so a
  // side whose recipe matches the other side's in-flight pass piggybacks on it
  // instead of burning the identical multi-second encode twice ("Copy settings
  // across" makes this a one-click situation). Not reactive; cleared with the
  // cache on a new file (the signature doesn't include file identity).
  private inflight = new Map<string, Promise<CompressOutcome>>();
  // Session-level source prep shared by both sides and by successive passes for
  // the same open file. Pass aborts are wrapped around the await, not wired into
  // this controller, so a debounced option change never poisons the shared decode.
  #sourceAbort: AbortController | null = null;
  #decodedPromise: Promise<DecodedSourceImage> | null = null;
  #decodedLoadId = -1;
  // One rotated frame is cached alongside the decoded frame. Rotation 0 reuses
  // decoded pixels exactly like preprocessImage does today (no copy).
  #preprocessedPromise: Promise<ImageData> | null = null;
  #preprocessedLoadId = -1;
  #preprocessedRotate: 0 | 90 | 180 | 270 = 0;
  // Debounced commit timer for the history watcher (see watchHistory).
  private historyTimer: ReturnType<typeof setTimeout> | null = null;
  // Bookkeeping keyed to `loadId` (bumped on every new file). Comparing against
  // the live loadId replaces the old mutable prevFiles/dimsSeeded guards, so a
  // new file is detected automatically with no hand-reset in pickFiles/clearFile.
  // The per-side counterpart (`SideRuntime.encodedLoadId`, the loadId each side
  // last (re)started an encode at) lives on the runtime object; this one tracks
  // the resize-dimension seed (one-shot per file).
  private seededLoadId = -1;
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
    this.runtime[0].result?.preprocessedWidth ??
      this.runtime[1].result?.preprocessedWidth ??
      0,
  );

  naturalHeight = $derived(
    this.runtime[0].result?.preprocessedHeight ??
      this.runtime[1].result?.preprocessedHeight ??
      0,
  );

  isVectorSource = $derived(this.file?.type === 'image/svg+xml');

  // Every encoder is an always-available WASM codec, so the list is static.
  availableFormats = OUTPUT_FORMATS;

  leftContain = $derived(this.sideContains(0));
  rightContain = $derived(this.sideContains(1));
  firstError = $derived(this.runtime[0].error || this.runtime[1].error);

  docTitle = $derived(
    (this.runtime.some((r) => r.status === 'working') ? '⏳ ' : '') +
      (this.file ? `${this.file.name} - ` : '') +
      `${APP_NAME} - Compress images`,
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
    const runtime = this.runtime[index];
    const request = {
      format: side.format,
      options: $state.snapshot(side.optionsByFormat[side.format] ?? {}),
      processorState: snapshotProcessorStateForEncode(side.processorState),
      preprocessorState: $state.snapshot(this.preprocessorState),
    };
    // A new file bumps loadId; compare against the loadId this side last encoded
    // at, so a fresh image encodes immediately and option tweaks stay debounced.
    const fileChanged = this.loadId !== runtime.encodedLoadId;
    runtime.encodedLoadId = this.loadId;

    // Source dims are read untracked so the resize-is-real fold (see
    // encode-signature.ts) never makes the encode effect depend on `results`.
    const [srcW, srcH] = untrack(() => [this.naturalWidth, this.naturalHeight]);

    // Label the badge by WHAT changed this pass: diff the *effective* resize recipe
    // against the previous pass. A real resize-control change → "Resizing"; anything
    // else (quality/format/palette/rotate, or an identity resize) → "Optimizing".
    // A new file always reads as 'optimize' (fileChanged short-circuits before
    // the diff can fire).
    const resizeSig = resizeSignature(request.processorState, srcW, srcH);
    const prevSig = runtime.lastResizeSig;
    runtime.lastResizeSig = resizeSig;
    runtime.activity =
      !fileChanged && prevSig !== null && prevSig !== resizeSig
        ? 'resize'
        : 'optimize';

    if (!current) {
      runtime.status = 'idle';
      return;
    }

    // The signature of this pass's inputs (file identity aside — that's guarded
    // by fileChanged). It both (a) detects a redundant pass and (b) keys the
    // result cache. Built from the SAME sideRecipe projection as docSig, so a
    // history restore always recomputes to a cache-hitting key.
    const encodeSig = encodeSignature(
      request.preprocessorState,
      request.format,
      request.options,
      request.processorState,
      srcW,
      srcH,
    );

    // Already on screen for this side? Re-encoding would reproduce identical
    // bytes, so we don't: no wasted work, no badge flash. This is what makes
    // "enable resize at 100%" (and Premultiply/Linear RGB toggles at 100%) a true
    // no-op. `displayedSig` is set only when a result actually lands, so a prior
    // error or abort still retries.
    if (!fileChanged && runtime.displayedSig === encodeSig) {
      runtime.status = 'done';
      runtime.error = '';
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

    runtime.status = 'working';
    runtime.error = '';

    const controller = new AbortController();
    const bridge = this.bridgeFor(index);

    // A pass this side OWNS: runs the pipeline on this side's bridge and
    // publishes itself in `inflight` so the other side can piggyback.
    const startOwnPass = () => {
      const pass = abortable(
        controller.signal,
        // The pass's OWN preprocessor snapshot decides the prepared frame —
        // never a live re-read after the decode await, which could disagree
        // with `request` in the abort window and cache a result under the
        // wrong signature.
        this.#preparedSource(bridge, request.preprocessorState),
      ).then((prepared) =>
        compressPreprocessed(prepared, request, controller.signal, bridge),
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
          runtime.error =
            error instanceof Error ? error.message : String(error);
          runtime.status = 'error';
        });
    };

    const run = () => {
      runtime.status = 'working';
      runtime.error = '';

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
            runtime.error =
              error instanceof Error ? error.message : String(error);
            runtime.status = 'error';
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

  #clearPreparedSource(): void {
    this.#sourceAbort?.abort();
    this.#sourceAbort = null;
    this.#decodedPromise = null;
    this.#decodedLoadId = -1;
    this.#preprocessedPromise = null;
    this.#preprocessedLoadId = -1;
    this.#preprocessedRotate = 0;
  }

  async #preparedSource(
    bridge: SvelteKitWorkerBridge,
    preprocessorState: PreprocessorState,
  ): Promise<SourceImage> {
    const file = this.file;
    if (!file) throw Error('No image loaded');
    const loadId = this.loadId;

    if (this.#decodedLoadId !== loadId || !this.#decodedPromise) {
      this.#sourceAbort?.abort();
      const sourceAbort = new AbortController();
      this.#sourceAbort = sourceAbort;
      this.#decodedLoadId = loadId;
      this.#preprocessedPromise = null;
      this.#preprocessedLoadId = -1;

      let decodedPromise!: Promise<DecodedSourceImage>;
      decodedPromise = decodeSourceImage(
        sourceAbort.signal,
        file,
        bridge,
      ).catch((error: unknown) => {
        // A bad source should surface to every current waiter, but the rejected
        // promise must not become the file's permanent decode cache entry.
        if (this.#decodedPromise === decodedPromise) {
          this.#decodedPromise = null;
          this.#decodedLoadId = -1;
          this.#preprocessedPromise = null;
          this.#preprocessedLoadId = -1;
        }
        throw error;
      });
      this.#decodedPromise = decodedPromise;
    }

    const decoded = await this.#decodedPromise;
    const rotate = preprocessorState.rotate.rotate as 0 | 90 | 180 | 270;
    if (rotate === 0) {
      this.#preprocessedPromise = null;
      this.#preprocessedLoadId = loadId;
      this.#preprocessedRotate = rotate;
      return { ...decoded, preprocessed: decoded.decoded };
    }

    if (
      this.#preprocessedLoadId !== loadId ||
      this.#preprocessedRotate !== rotate ||
      !this.#preprocessedPromise
    ) {
      if (!this.#sourceAbort)
        throw new DOMException('AbortError', 'AbortError');
      this.#preprocessedLoadId = loadId;
      this.#preprocessedRotate = rotate;
      this.#preprocessedPromise = preprocessImage(
        this.#sourceAbort.signal,
        decoded.decoded,
        preprocessorState,
        bridge,
      );
    }

    const preprocessed = await this.#preprocessedPromise;
    return { ...decoded, preprocessed };
  }

  /**
   * Put a result (fresh or cached) on screen for a side and record what produced
   * it. `displayedSig` is the signature of the result now on screen (set only
   * when a result actually lands, from a fresh encode OR a cache hit), so a pass
   * whose signature still matches is detected as redundant.
   */
  private showResult(
    index: SideIndex,
    outcome: CompressOutcome,
    sig: string,
  ): void {
    const runtime = this.runtime[index];
    runtime.result = outcome;
    runtime.displayedSig = sig;
    runtime.status = 'done';
    runtime.error = '';
    this.pinDisplayedResults();
  }

  /**
   * Tell the cache which results are currently on screen so it never evicts (and
   * revokes the URL of) something the editor is still showing.
   */
  private pinDisplayedResults(): void {
    const keys: string[] = [];
    for (const runtime of this.runtime) {
      if (runtime.displayedSig !== null) keys.push(runtime.displayedSig);
    }
    // A Set in ResultCache dedupes the two when both sides show the same recipe.
    this.cache.setPinned(keys);
  }

  updateSpinner(index: SideIndex): (() => void) | void {
    const runtime = this.runtime[index];
    // Manages only the 500ms delay; showSpinner is the $derived AND-gate on
    // SideRuntime.
    if (runtime.status !== 'working') {
      runtime.spinnerDelayPassed = false;
      return;
    }

    const timer = setTimeout(() => {
      runtime.spinnerDelayPassed = true;
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
   * so slider drags re-run this. The commit itself is deferred and de-duped by
   * signature, so it never loops: the watcher DOES re-run on restoreDocument's
   * own writes, but the recomputed sig matches the entry undo/redo just moved
   * to, and EditorHistory.commit() no-ops on a matching signature.
   */
  private watchHistory(): (() => void) | void {
    const doc = this.captureDocument();
    // Undo is scoped to an open image.
    if (!this.file) return;
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

  /**
   * Write a snapshot back into the live document. Doesn't re-enter history:
   * the watcher reacts to these writes, but its debounced commit recomputes a
   * signature equal to the entry undo/redo just moved to, so it no-ops.
   */
  private restoreDocument(doc: DocSnapshot): void {
    this.applySide(0, doc.sides[0]);
    this.applySide(1, doc.sides[1]);
    this.preprocessorState = structuredClone(doc.preprocessorState);
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
    const result = this.runtime[0].result ?? this.runtime[1].result;
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
    writeSettings(payload);
  }

  pickFiles(
    list: ArrayLike<File> | null | undefined,
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
    this.#clearPreparedSource();
    this.file = next;
    this.loadId += 1;
    // Reset each side's transient runtime (result, status, error, displayedSig,
    // and the spinner delay so the new file re-earns the 500ms grace). loadId
    // (bumped above) re-arms the encode + seed bookkeeping with no manual reset.
    for (const runtime of this.runtime) runtime.reset();

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
    for (const runtime of this.runtime) runtime.reset();
    this.preprocessorState = structuredClone(defaultPreprocessorState);
    this.cache.clear();
    this.inflight.clear();
    this.#clearPreparedSource();
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
    this.inflight.clear();
    this.#clearPreparedSource();
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

    const payload = JSON.stringify({
      version: SAVE_VERSION,
      settings: {
        format: this.sides[index].format,
        optionsByFormat: $state.snapshot(this.sides[index].optionsByFormat),
        processorState: $state.snapshot(this.sides[index].processorState),
      },
    });

    if (writeSideSettings(index, payload)) {
      this.canImport[index] = true;
      snackbar.show(`${label} side settings saved`, { timeout: 1500 });
    } else {
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
