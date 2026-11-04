import { untrack } from 'svelte';
import {
  getDefaultOptions,
  IDENTITY,
  OUTPUT_FORMATS,
  type CompressOutcome,
  type SideFormat,
} from '$lib/compress';
import { optimizeImage, type OptimizeSource } from '$lib/optimize-image';
import { ResultCache } from '$lib/result-cache';
import SvelteKitWorkerBridge from '$lib/sveltekit-worker-bridge';
import type { ResizeOptionsState } from './options/processor-types';
import { isSvgSource } from '$lib/svg/detect';
import { rasterizeSvg, type SvgRaster } from '$lib/svg/raster';
import { SVG_FORMAT } from './format-label';
import { EditorHistory } from './editor-history.svelte';
import { snackbar } from './snackbar-store.svelte';
import { isAbortError } from 'client/lazy-app/abort';
import { APP_NAME } from 'shared/brand';
import { stableStringify } from 'shared/stable-stringify';
import {
  encodeSignature,
  resizeIsReal,
  resizeSignature,
  unrotatedSource,
} from './encode-signature';
import {
  normalizedRecipe,
  recipeChangesPixels,
  recipeSignature,
  type ImageRecipe,
  type Rotation,
} from 'client/lazy-app/recipe';
import { getPercentChange } from 'client/lazy-app/bulk/size';
import { recipeFromSide } from './side-recipe';
import {
  AUTO_QUALITY_BOUNDS,
  AUTO_QUALITY_LABELS,
  AUTO_QUALITY_TARGETS,
  autoQualityBudgetMs,
  isBudgetGuess,
  searchQuality,
  type AutoQualityTarget,
} from './auto-quality';
import { applyGrainToPixels } from 'features/processors/grain/shared/apply';
import {
  defaultPreprocessorState,
  defaultProcessorState,
  grainIsReal,
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

type GrainState = ProcessorState['grain'];

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

interface AutoQualityRun {
  controller: AbortController;
  sig: string;
}

const formatScore = (score: number) => score.toFixed(1);

function buildSide(
  saved: SavedSide | undefined,
  fallback: SideFormat,
): SideState {
  const formats: SideFormat[] = [
    ...OUTPUT_FORMATS.map((format) => format.id),
    'svg',
  ];
  const optionsByFormat = Object.fromEntries(
    formats.map((format) => {
      const defaults = getDefaultOptions(format);
      const savedForFormat = saved?.optionsByFormat?.[format];
      return [
        format,
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
    grain: $state.snapshot(state.grain),
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
  // Live grain scrub frame (see updateGrainPreview): the preprocessed source
  // with the CURRENT grain applied, shown while the true encode is in flight.
  // Raw for the same reason as `result`. The viewer prefers it over `result`.
  grainPreview = $state.raw<ImageData | null>(null);
  // The delayed-spinner AND-gate: never shows outside a 'working' spell.
  showSpinner = $derived(this.status === 'working' && this.spinnerDelayPassed);
  // Whether `result` IS the current recipe, so Save and Share may hand it out.
  // 'working' means the recipe moved on while the old result stays on screen;
  // 'error' means the new recipe failed. Gating on the delayed spinner instead
  // let the previous bytes download under the new format's name.
  exportable = $derived(this.status === 'done' && this.result !== null);

  // Non-reactive bookkeeping (see encodeSide).
  displayedSig: string | null = null;
  // The grain recipe baked into `result` (null = none) — what the live grain
  // preview diffs the current grain state against.
  displayedGrainSig: string | null = null;
  encodedLoadId = -1;
  lastResizeSig: string | null = null;

  /** New-file / editor-close reset — exactly the fields pickFiles cleared. */
  reset(): void {
    this.status = 'idle';
    this.error = '';
    this.spinnerDelayPassed = false;
    this.result = null;
    this.grainPreview = null;
    this.displayedSig = null;
    this.displayedGrainSig = null;
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
  // Whether each side has an auto-quality search running (drives the panel's
  // busy row). See autoQuality.
  autoQualityRunning = $state<[boolean, boolean]>([false, false]);
  // The running search per side: its controller, and the side's recipe
  // signature when it started, which the watcher compares against to cancel
  // it the moment the user changes anything the search snapshotted.
  #autoQuality: [AutoQualityRun | null, AutoQualityRun | null] = [null, null];

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
  // The source as the main thread sees it, for the Original side, the grain
  // preview, and adopted results. Encodes never wait on it: the codec workers
  // decode the file themselves. One rotated frame per load, decoded on its
  // own bridge (below) under its own controller, so it never queues behind an
  // encode and a debounced option change never aborts it.
  #sourceAbort: AbortController | null = null;
  #sourceBridge: SvelteKitWorkerBridge | null = null;
  #frame: {
    loadId: number;
    rotate: Rotation;
    promise: Promise<ImageData>;
  } | null = null;
  // An SVG source's raster (DOM-only, so it is made here, not in a worker).
  #svgRaster: { loadId: number; promise: Promise<SvgRaster> } | null = null;
  #svgTextPromise: Promise<string> | null = null;
  #svgTextLoadId = -1;
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

  isVectorSource = $derived(this.file !== null && isSvgSource(this.file));

  // Drives the JXL panel's transcode toggle: which sources can offer it at all.
  sourceType = $derived(this.file?.type ?? '');

  availableFormats = $derived(
    this.isVectorSource
      ? [
          {
            id: 'svg',
            label: SVG_FORMAT.label,
            tooltip: 'SVGO',
            ext: SVG_FORMAT.extension,
          },
          ...OUTPUT_FORMATS,
        ]
      : OUTPUT_FORMATS,
  );

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
        $effect(() => this.updateGrainPreview(index));
        $effect(() => this.watchAutoQuality(index));
      }
      // One watcher commits debounced undo steps as the document changes.
      $effect(() => this.watchHistory());
    });
  }

  encodeSide(index: SideIndex): (() => void) | void {
    const current = this.file;
    const side = this.sides[index];
    const runtime = this.runtime[index];
    const format =
      side.format === 'svg' && (!current || !isSvgSource(current))
        ? 'webP'
        : side.format;
    const request = {
      format,
      options: $state.snapshot(side.optionsByFormat[format] ?? {}),
      processorState: snapshotProcessorStateForEncode(side.processorState),
      preprocessorState: $state.snapshot(this.preprocessorState),
    };
    // A new file bumps loadId; compare against the loadId this side last encoded
    // at, so a fresh image encodes immediately and option tweaks stay debounced.
    const fileChanged = this.loadId !== runtime.encodedLoadId;
    runtime.encodedLoadId = this.loadId;

    // The grain recipe of THIS pass, recorded when its result lands so the
    // live grain preview knows what's baked into the displayed pixels.
    const grainSig = grainIsReal(request.processorState.grain)
      ? stableStringify(request.processorState.grain)
      : null;

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
    // result cache. Built from the SAME recipe projection as docSig, so a
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
      // Self-heals externally hydrated results (bulk focus view) that didn't
      // record their grain recipe.
      runtime.displayedGrainSig = grainSig;
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
    const cached = this.cache.get(encodeSig);
    if (cached) {
      this.showResult(index, cached, encodeSig, grainSig);
      return;
    }

    runtime.status = 'working';
    runtime.error = '';

    // What optimizeImage runs. The lane it picks (SVG, transcode, pixels) is a
    // function of this recipe and the file, and the JXL transcode flag lives
    // in the options, so it is already inside `encodeSig` above: a transcode
    // result and a pixel result can never collide in the cache.
    const recipe = recipeFromSide(
      {
        format: request.format,
        optionsByFormat: {
          [request.format]: request.options as Record<string, unknown>,
        },
        processorState: request.processorState,
      },
      request.preprocessorState,
    );

    const controller = new AbortController();
    const bridge = this.bridgeFor(index);

    // A pass this side OWNS: runs the pipeline on this side's bridge and
    // publishes itself in `inflight` so the other side can piggyback.
    const startOwnPass = () => {
      // The recipe carries the pass's OWN rotation snapshot, so the frame
      // it encodes can never disagree with `request` in the abort window and
      // cache a result under the wrong signature.
      const pass = optimizeImage(this.#optimizeSource(), recipe, {
        signal: controller.signal,
        bridge,
        preview: true,
        svgText: request.format === 'svg' ? this.#svgSourceText() : undefined,
      }).then((outcome) => {
        if (outcome.transcodeFellBack) {
          void snackbar.show(
            "Couldn't transcode this JPEG losslessly, so it was encoded normally.",
          );
        }
        return outcome;
      });
      this.inflight.set(encodeSig, pass);
      const settle = () => {
        if (this.inflight.get(encodeSig) === pass)
          this.inflight.delete(encodeSig);
      };
      pass
        .then((outcome) => {
          settle();
          // Cache even when this side has already moved on (aborted between
          // completion and here): the finished result is valid, a piggybacking
          // side may be about to display it, and undo can reuse it. Revoking
          // here would race the other side; the cache owns the URL lifecycle.
          const existing = this.cache.get(encodeSig);
          if (existing) {
            // A concurrent identical pass cached this key first; drop ours.
            URL.revokeObjectURL(outcome.outputUrl);
            if (!controller.signal.aborted)
              this.showResult(index, existing, encodeSig, grainSig);
            return;
          }
          this.cache.set(encodeSig, outcome);
          if (!controller.signal.aborted)
            this.showResult(index, outcome, encodeSig, grainSig);
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
      const shared = this.inflight.get(encodeSig);
      if (shared) {
        shared
          .then((outcome) => {
            if (controller.signal.aborted) return;
            this.showResult(index, outcome, encodeSig, grainSig);
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

  /**
   * Offer an encoded file made elsewhere (bulk) as the result for `recipe` on
   * the current source, so the encode effect lands on it instead of encoding
   * again. It goes in as an in-flight pass under the exact key encodeSide will
   * compute for a side holding `recipe` (same projection, same source size,
   * which is 0 until this load's first result lands), so a side that wants it
   * piggybacks and the finished outcome is cached like any other. Building the
   * preview decodes the file once, in a worker; the source size comes from
   * this session's own prepared frame. Any failure rejects as an abort, which makes a
   * waiting side fall back to a pass of its own. Raster outputs only: an SVG
   * result needs the vector lane's text facts. The cache mints and owns its
   * own URL for the file, so the caller's URL is never revoked here.
   */
  adoptResult(recipe: ImageRecipe, outputFile: File): void {
    const file = this.file;
    if (!file || recipe.output.kind !== 'raster') return;
    const key = recipeSignature(
      recipe,
      unrotatedSource(
        { rotate: { rotate: recipe.rotate } },
        this.naturalWidth,
        this.naturalHeight,
      ),
    );
    if (this.cache.get(key) || this.inflight.has(key)) return;

    const loadId = this.loadId;
    const pass = (async (): Promise<CompressOutcome> => {
      const frame = await this.#preparedFrame(recipe.rotate);
      const outputImageData = await this.#sourceBridgeFor().decodeOutput(
        this.#sourceSignal(),
        outputFile,
      );
      if (this.loadId !== loadId) throw Error('The source changed');
      const existing = this.cache.get(key);
      if (existing) return existing;
      const outcome: CompressOutcome = {
        outputFile,
        outputUrl: URL.createObjectURL(outputFile),
        outputSize: outputFile.size,
        originalSize: file.size,
        percentChange:
          Math.round(getPercentChange(file.size, outputFile.size) * 10) / 10,
        outputImageData,
        isOriginal: false,
        preprocessedWidth: frame.width,
        preprocessedHeight: frame.height,
      };
      this.cache.set(key, outcome);
      return outcome;
    })().catch(() => {
      throw new DOMException('Adopted result unavailable', 'AbortError');
    });
    this.inflight.set(key, pass);
    const settle = () => {
      if (this.inflight.get(key) === pass) this.inflight.delete(key);
    };
    pass.then(settle, settle);
  }

  // ── Auto quality ─────────────────────────────────────────────────────────
  // A one-shot action: find the lowest quality whose output meets a
  // SSIMULACRA2 target (auto-quality.ts owns the search), then write it into
  // the side's options like a slider move would. Nothing about it is stored or
  // signed: the committed quality is an ordinary option value.

  /** The side's output-affecting recipe plus the open file, as the watcher
   *  sees it. Reads deeply, so calling it from an effect tracks every field. */
  #autoQualitySig(index: SideIndex): string {
    return stableStringify({
      loadId: this.loadId,
      recipe: normalizedRecipe(
        recipeFromSide(
          this.snapshotSide(index),
          $state.snapshot(this.preprocessorState) as PreprocessorState,
        ),
      ),
    });
  }

  /** Cancels a running search once its side's recipe, format, or file moves
   *  away from what the search snapshotted (a Quality drag included), since
   *  committing `{ ...snapshot, quality }` would then undo the user's edit.
   *  Cancelling writes `autoQualityRunning` from inside this effect on
   *  purpose: it stops async work, which no $derived can do, and the effect
   *  never reads that flag, so the write cannot loop. */
  private watchAutoQuality(index: SideIndex): void {
    const sig = this.#autoQualitySig(index);
    const run = this.#autoQuality[index];
    if (run && run.sig !== sig) this.cancelAutoQuality(index);
  }

  cancelAutoQuality(index: SideIndex): void {
    const run = this.#autoQuality[index];
    if (!run) return;
    this.#autoQuality[index] = null;
    this.autoQualityRunning[index] = false;
    run.controller.abort();
  }

  /**
   * Search this side's quality for `target` and commit the result. Probes run
   * the side's own recipe with only `quality` substituted, on the side's own
   * bridge, through the same optimizeImage call encodeSide makes, with the
   * worker scoring the decoded output against the processed frame (after
   * resize, grain, palette) the encoder received, so the target
   * measures the encoder's loss alone and the sizes always match. Every probe
   * URL is revoked as soon as the search drops it; the winner goes into the
   * result cache under the key encodeSide computes after the commit, so the
   * displayed encode is a cache hit rather than a ninth encode.
   */
  async autoQuality(
    index: SideIndex,
    target: AutoQualityTarget,
  ): Promise<void> {
    this.cancelAutoQuality(index);
    const side = this.sides[index];
    const format = side.format;
    const bounds = AUTO_QUALITY_BOUNDS[format];
    if (!this.file || !bounds) return;

    const options = $state.snapshot(side.optionsByFormat[format]) as Record<
      string,
      unknown
    >;
    const processorState = $state.snapshot(
      side.processorState,
    ) as ProcessorState;
    const preprocessorState = $state.snapshot(
      this.preprocessorState,
    ) as PreprocessorState;
    const loadId = this.loadId;
    const controller = new AbortController();
    const { signal } = controller;
    this.#autoQuality[index] = { controller, sig: this.#autoQualitySig(index) };
    this.autoQualityRunning[index] = true;

    const bridge = this.bridgeFor(index);
    const withQuality = (quality: number) => ({ ...options, quality });
    const probe = async (quality: number) => {
      const recipe = recipeFromSide(
        {
          format,
          optionsByFormat: { [format]: withQuality(quality) },
          processorState,
        },
        preprocessorState,
      );
      // Same source path and bridge as encodeSide, so the worker's hot
      // decoded source serves every probe. The worker scores the decoded
      // output against the processed frame it encoded, which is also the
      // preview, so the winner can be cached as a displayable result.
      const outcome = await optimizeImage(this.#optimizeSource(), recipe, {
        signal,
        bridge,
        preview: true,
        score: true,
      });
      if (outcome.score === undefined) {
        URL.revokeObjectURL(outcome.outputUrl);
        throw Error('The codec worker returned no score.');
      }
      return { score: outcome.score, outcome };
    };

    const started = performance.now();
    try {
      // The budget follows the size every probe encodes: the resize target
      // when a real resize runs, else the prepared source.
      const [srcW, srcH] = untrack(() => [
        this.naturalWidth,
        this.naturalHeight,
      ]);
      const resized = resizeIsReal(processorState, srcW, srcH);
      const found = await searchQuality({
        probe,
        lo: bounds.lo,
        hi: bounds.hi,
        target: AUTO_QUALITY_TARGETS[target],
        signal,
        budgetMs: autoQualityBudgetMs(
          resized ? processorState.resize.width : srcW,
          resized ? processorState.resize.height : srcH,
        ),
        discard: ({ outcome }) => URL.revokeObjectURL(outcome.outputUrl),
      });
      const { outcome } = found.result;
      // searchQuality rejects on an abort at any of its awaits; this guards
      // the synchronous tail as well, so a cancelled search never commits.
      if (signal.aborted || this.loadId !== loadId) {
        URL.revokeObjectURL(outcome.outputUrl);
        return;
      }
      this.#autoQuality[index] = null;
      this.autoQualityRunning[index] = false;

      // Never commit a guess: when time ran out before anything below the
      // ceiling passed, the ceiling was not chosen by the target.
      if (isBudgetGuess(found, bounds.hi)) {
        URL.revokeObjectURL(outcome.outputUrl);
        void snackbar.show(
          'Auto ran out of time on this large image; quality unchanged.',
        );
        return;
      }

      const committed = withQuality(found.quality);
      const key = encodeSignature(
        preprocessorState,
        format,
        committed,
        processorState,
        // Read now, not at search start: the first result may have landed
        // since, and encodeSide will key on the current size.
        untrack(() => this.naturalWidth),
        untrack(() => this.naturalHeight),
      );
      if (this.cache.get(key)) URL.revokeObjectURL(outcome.outputUrl);
      else this.cache.set(key, outcome);
      // A new object, not a mutation, so the panel's {#key options} remounts
      // and the encode effect runs (and lands on the cache entry above).
      side.optionsByFormat[format] = committed;

      const score = formatScore(found.score);
      const label =
        OUTPUT_FORMATS.find((entry) => entry.id === format)?.label ?? format;
      if (!found.met) {
        void snackbar.show(
          `Best ${label} can do here is ${score}; used quality ${found.quality}.`,
        );
      } else if (found.timedOut) {
        const seconds = Math.round((performance.now() - started) / 1000);
        void snackbar.show(
          `Auto: stopped after ${seconds} s at quality ${found.quality} (score ${score}).`,
        );
      } else {
        void snackbar.show(
          `Auto: ${AUTO_QUALITY_LABELS[target]} met at quality ${found.quality} (score ${score}).`,
        );
      }
    } catch (error) {
      if (this.#autoQuality[index]?.controller === controller) {
        this.#autoQuality[index] = null;
        this.autoQualityRunning[index] = false;
      }
      if (signal.aborted || isAbortError(error)) return;
      void snackbar.show(
        `Auto quality failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** The side's persistent bridge, created on first use (see `bridges`). */
  private bridgeFor(index: SideIndex): SvelteKitWorkerBridge {
    return (this.bridges[index] ??= new SvelteKitWorkerBridge());
  }

  /** The bridge for source frames and adopted previews, created on first use. */
  #sourceBridgeFor(): SvelteKitWorkerBridge {
    return (this.#sourceBridge ??= new SvelteKitWorkerBridge());
  }

  /** This load's source controller: aborted only when the file goes away. */
  #sourceSignal(): AbortSignal {
    return (this.#sourceAbort ??= new AbortController()).signal;
  }

  #clearPreparedSource(): void {
    this.#sourceAbort?.abort();
    this.#sourceAbort = null;
    this.#frame = null;
    this.#svgRaster = null;
    this.#svgTextPromise = null;
    this.#svgTextLoadId = -1;
  }

  #svgSourceText(): Promise<string> {
    const file = this.file;
    if (!file || !isSvgSource(file)) throw Error('No SVG loaded');
    if (this.#svgTextLoadId !== this.loadId || !this.#svgTextPromise) {
      this.#svgTextLoadId = this.loadId;
      this.#svgTextPromise = file.text();
    }
    return this.#svgTextPromise;
  }

  /** What optimizeImage needs from this session for the current file. */
  #optimizeSource(): OptimizeSource {
    const file = this.file;
    if (!file) throw Error('No image loaded');
    return {
      file,
      prepared: (rotate) => this.#preparedFrame(rotate),
      svg: isSvgSource(file) ? () => this.#svgSourceRaster() : undefined,
    };
  }

  #svgSourceRaster(): Promise<SvgRaster> {
    const file = this.file;
    if (!file || !isSvgSource(file)) throw Error('No SVG loaded');
    if (this.#svgRaster?.loadId !== this.loadId) {
      const promise = rasterizeSvg(this.#sourceSignal(), file);
      this.#svgRaster = { loadId: this.loadId, promise };
      // A failure surfaces to every current waiter but is not kept.
      promise.catch(() => {
        if (this.#svgRaster?.promise === promise) this.#svgRaster = null;
      });
    }
    return this.#svgRaster.promise;
  }

  /**
   * The current file rotated by `rotate`, on the main thread. Decoded in a
   * worker and transferred out, so the main thread never decodes a raster
   * source. An SVG is rasterized here instead (that needs the DOM), and a
   * worker only rotates a copy of it.
   */
  #preparedFrame(rotate: Rotation): Promise<ImageData> {
    const file = this.file;
    if (!file) throw Error('No image loaded');
    const loadId = this.loadId;
    const cached = this.#frame;
    if (cached?.loadId === loadId && cached.rotate === rotate) {
      return cached.promise;
    }
    const signal = this.#sourceSignal();
    const bridge = this.#sourceBridgeFor();
    const promise = (async () => {
      if (!isSvgSource(file)) {
        const reply = await bridge.prepare(signal, {
          source: { kind: 'file', file },
          rotate,
        });
        return reply.image;
      }
      const { raster } = await this.#svgSourceRaster();
      if (rotate === 0) return raster;
      const copy = new ImageData(
        new Uint8ClampedArray(raster.data),
        raster.width,
        raster.height,
      );
      const reply = await bridge.prepare(signal, {
        source: { kind: 'pixels', image: copy },
        rotate,
      });
      return reply.image;
    })();
    this.#frame = { loadId, rotate, promise };
    promise.catch(() => {
      if (this.#frame?.promise === promise) this.#frame = null;
    });
    return promise;
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
    grainSig: string | null,
  ): void {
    const runtime = this.runtime[index];
    runtime.result = outcome;
    runtime.displayedSig = sig;
    runtime.displayedGrainSig = grainSig;
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

  // ── Live grain preview ─────────────────────────────────────────────────────
  // While the user scrubs the Grain controls, the true (encoded) result lags a
  // debounce + an encode behind. Instead of showing the stale result, show the
  // preprocessed source with the CURRENT grain applied — the exact bytes the
  // encoder is about to receive (same function, same seed), so the scrub is
  // pixel-honest; the settled encode then replaces it with the compressed
  // truth. Engages only while a pass is in flight AND grain is the only step
  // between the preprocessed frame and the encoder (an active resize or
  // palette reduction would make the frame misleading).

  // Latest-wins scheduling: slider input outruns what full-res grain
  // application can render, so a single drain loop per side renders the
  // newest pending state back-to-back, yielding to the event loop between
  // renders. Deliberately NOT requestAnimationFrame: rAF stalls entirely in
  // non-compositing contexts (background tabs, headless runs), which would
  // freeze the preview exactly when automation or a backgrounded encode
  // relies on state staying current.
  #grainPreviewPending: [GrainState | null, GrainState | null] = [null, null];
  #grainPreviewDraining: [boolean, boolean] = [false, false];
  #grainPreviewToken: [number, number] = [0, 0];

  updateGrainPreview(index: SideIndex): void {
    const runtime = this.runtime[index];
    const side = this.sides[index];
    const grain = side.processorState.grain;
    // Tracked reads: status, grain fields, quantize.enabled, file/loadId.
    const [srcW, srcH] = untrack(() => [this.naturalWidth, this.naturalHeight]);
    const engaged =
      this.file !== null &&
      runtime.status === 'working' &&
      grainIsReal(grain) &&
      !side.processorState.quantize.enabled &&
      !untrack(() => resizeIsReal(side.processorState, srcW, srcH));
    const grainSig = engaged ? stableStringify($state.snapshot(grain)) : null;

    if (!engaged || grainSig === runtime.displayedGrainSig) {
      // Nothing to preview (or the displayed result already has this exact
      // grain — e.g. a quality-only tweak while grain is on).
      this.#grainPreviewPending[index] = null;
      runtime.grainPreview = null;
      return;
    }

    this.#grainPreviewPending[index] = $state.snapshot(grain);
    void this.#drainGrainPreview(index);
  }

  async #drainGrainPreview(index: SideIndex): Promise<void> {
    if (this.#grainPreviewDraining[index]) return;
    this.#grainPreviewDraining[index] = true;
    try {
      let pending: GrainState | null;
      while ((pending = this.#grainPreviewPending[index])) {
        this.#grainPreviewPending[index] = null;
        await this.#renderGrainPreview(index, pending);
        // Yield between renders so a fast scrub can't starve the main thread.
        await new Promise((resolve) => setTimeout(resolve));
      }
    } finally {
      this.#grainPreviewDraining[index] = false;
    }
  }

  async #renderGrainPreview(
    index: SideIndex,
    grain: GrainState,
  ): Promise<void> {
    const token = ++this.#grainPreviewToken[index];
    const loadId = this.loadId;
    // The frame the encoder starts from. Usually settled already (the
    // Original side or an earlier scrub asked for it); otherwise this starts
    // it on the source bridge, which no encode can hold up.
    let data: ImageData;
    try {
      data = await this.#preparedFrame(this.preprocessorState.rotate.rotate);
    } catch {
      return; // decode failures surface through the encode path
    }
    if (token !== this.#grainPreviewToken[index] || loadId !== this.loadId)
      return; // superseded while awaiting
    const pixels = new Uint8ClampedArray(data.data);
    applyGrainToPixels(pixels, data.width, grain.amount, grain.size);
    this.runtime[index].grainPreview = new ImageData(
      pixels,
      data.width,
      data.height,
    );
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
   * steps: each side's normalized recipe, the same projection the encode path
   * keys its cache on, so a restored step always recomputes to a cache-hitting
   * key. A disabled resize folds to null, so seeding its width/height (which
   * doesn't change the output) never spawns a phantom undo step.
   */
  private docSig(doc: DocSnapshot): string {
    // No source dims here, so an enabled resize always counts: history can't
    // know the source size, and an enabled-at-100% step is still a document
    // state the user can undo to. The encode path folds it to the same key as
    // resize-off anyway, so the restore still lands on a cache hit.
    return stableStringify(
      doc.sides.map((side) =>
        normalizedRecipe(recipeFromSide(side, doc.preprocessorState)),
      ),
    );
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

    this.clearHistoryTimer();
    this.historyTimer = setTimeout(() => {
      this.historyTimer = null;
      this.history.commit(doc, sig);
    }, HISTORY_COMMIT_DELAY);

    return () => this.clearHistoryTimer();
  }

  private clearHistoryTimer(): void {
    if (this.historyTimer !== null) {
      clearTimeout(this.historyTimer);
      this.historyTimer = null;
    }
  }

  /**
   * Force any pending debounced step to commit NOW. Called before undo/redo so an
   * edit the user just made (still inside the debounce window) is captured first
   * and remains reachable via redo.
   */
  private flushHistory(): void {
    this.clearHistoryTimer();
    if (!this.file) return;
    const doc = this.captureDocument();
    this.history.commit(doc, this.docSig(doc));
  }

  /** Seed a fresh history baseline for a newly loaded image. */
  private resetHistory(): void {
    this.clearHistoryTimer();
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

    if (!next.type.startsWith('image/') && !isSvgSource(next)) {
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
    if (isSvgSource(next)) void this.#svgSourceText();
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

    const isVector = isSvgSource(next);
    if (isVector) {
      this.sides[1].format = 'svg';
    } else {
      for (const side of this.sides) {
        if (side.format === 'svg') side.format = 'webP';
      }
    }
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
    this.cancelAutoQuality(0);
    this.cancelAutoQuality(1);
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
    this.cancelAutoQuality(0);
    this.cancelAutoQuality(1);
    this.clearHistoryTimer();
    // Persist any pending settings change before teardown so the debounce never
    // drops the user's last edit.
    this.flushSettings();
    this.cache.clear();
    this.inflight.clear();
    this.#clearPreparedSource();
    for (const bridge of this.bridges) bridge?.dispose();
    this.bridges = [null, null];
    this.#sourceBridge?.dispose();
    this.#sourceBridge = null;
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

  // copyToOther, saveSide, importSide, and canImport serve only the lab skins
  // now (docs/lab.md). Production dropped the per-side copy/save/import
  // buttons on 2026-11-04; retire these with the labs that still call them.
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
      side.format === 'svg'
        ? SVG_FORMAT.extension
        : (OUTPUT_FORMATS.find((format) => format.id === side.format)?.ext ??
          'bin');
    return this.file.name.replace(/\.[^.]+$/, '') + '.' + extension;
  }

  private applySide(index: SideIndex, snapshot: SideState): void {
    this.sides[index].format = snapshot.format;
    this.sides[index].optionsByFormat = structuredClone(
      snapshot.optionsByFormat,
    );
    this.sides[index].processorState = structuredClone(snapshot.processorState);
  }

  /**
   * Whether a pixel-changing step rules this side's JPEG-to-JXL transcode out,
   * so the panel can disable the toggle with a reason instead of letting it
   * claim a losslessness the encode would not deliver. The engine repeats this
   * check for itself (`chooseLane` in optimize-image.ts) rather than trusting
   * the UI.
   */
  transcodeBlocked(index: SideIndex): boolean {
    return recipeChangesPixels(
      recipeFromSide(this.sides[index], this.preprocessorState),
      unrotatedSource(
        this.preprocessorState,
        this.naturalWidth,
        this.naturalHeight,
      ),
    );
  }

  private sideContains(index: SideIndex): boolean {
    return (
      this.sides[index].processorState.resize.enabled &&
      this.sides[index].processorState.resize.fitMethod === 'contain'
    );
  }
}
