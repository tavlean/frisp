// Reactive production bulk store — the thin Svelte 5 layer over the
// framework-neutral bulk engine.
//
// The engine is IMMUTABLE: every reducer returns a NEW BulkSession, so the
// store holds it in `$state.raw` and REASSIGNS on each action (coarse
// reactivity is fine for the focused batch UI). View-models are derived via
// the engine's own selectors, so the components never reach into the session
// shape directly. Thumbnails + natural dimensions live in a SvelteMap keyed by
// job id, decoded lazily off the source File. Object URLs (thumbnails AND
// engine output download URLs) are revoked on reset, or after a remove settles
// without snackbar Undo.
//
// The bulk home is built on top of this store. The focused image itself is
// rendered by a real EditorSession in the route.

import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { pushState } from '$app/navigation';
import { page } from '$app/state';
import {
  getDefaultOptions,
  OUTPUT_FORMATS,
  type SideFormat,
} from '$lib/compress';
import type { SideState } from '$lib/editor/editor-session.svelte';
import {
  addBulkImportToSession,
  canExportBulkSession,
  createBulkExportPlan,
  createBulkSessionFromImport,
  createImageJobs,
  getBulkOutputFileName,
  getBulkSelectedJobDetail,
  getBulkSessionSummary,
  getBulkStripItems,
  effectiveRecipe,
  getJobSourceDimensions,
  getSelectedJob,
  editJobRecipes,
  jobRecipeHash,
  markBulkExportPlanExported,
  normalizeBulkSessionCounters,
  removeJobs,
  restoreJob,
  revokeJobObjectUrls,
  revokeSessionObjectUrls,
  resetJobForQueue,
  selectJob,
  selectNextJob,
  selectPreviousJob,
  setJobOwnRecipe,
  updateSharedRecipe,
  updateSharedSvgOptions,
  type BulkSelectedJobDetail,
  type BulkSession,
  type BulkSessionSummary,
  type BulkStripItem,
  type ImageJob,
  type ImageOutput,
} from 'client/lazy-app/bulk';
import {
  defaultProcessorState,
  encoderMap,
  type ProcessorState,
} from 'client/lazy-app/feature-meta';
import type { ImageRecipe, SvgOutputOptions } from 'client/lazy-app/recipe';
import { applyRecipeToSide, recipeFromSide } from '$lib/editor/side-recipe';
import { DEFAULT_SVG_OPTIONS } from '$lib/svg/optimize-options';
import { stableStringify } from 'shared/stable-stringify';
import { snackbar } from '$lib/editor/snackbar-store.svelte';
import type { ImportedFile } from './import-sources';
import { createLimiter } from './limiter';
import { BulkOutputCache } from './output-cache';
import { BulkRuntime } from './runtime';
import { buildZipBlob, triggerBlobDownload } from './zip';

/** Thumbnail + natural (source) dimensions for one job. */
export interface BulkThumb {
  /** Object URL of the downscaled thumbnail (owned by the store; revoked). */
  url: string;
  /** Natural (decoded) source width in pixels. */
  w: number;
  /** Natural (decoded) source height in pixels. */
  h: number;
}

export type BulkPanelScope = 'global' | 'image';
/** Bulk thumbnail size for the focus strip. */
export type StripSize = 's' | 'm' | 'l';

/** A ready-to-download output for one job: the URL the engine minted + the
 *  export-safe filename. `undefined` while the job has no current output. */
export interface JobDownload {
  url: string;
  fileName: string;
}

interface PendingRemovalItem {
  job: ImageJob;
  index: number;
}

interface PendingRemoval {
  items: PendingRemovalItem[];
}

/** Longest edge of the generated thumbnail canvas. */
const THUMB_MAX = 320;
/** Thumbnails decoded at once; each decode holds the full-size source. */
const THUMB_CONCURRENCY = 2;

let sessionCounter = 0;

export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function normalizeProcessorSub<T extends { enabled?: unknown }>(
  value: T,
): T | { enabled: false } {
  return value.enabled === true ? value : { enabled: false };
}

/**
 * Whether two shared recipes differ in anything the user set, ignoring the
 * parameters of disabled processors. Seeding a disabled resize's dimensions
 * must not count as an edit (it would reseed the focus view for nothing).
 */
function sameForBulkDiff(left: ImageRecipe, right: ImageRecipe): boolean {
  const key = (recipe: ImageRecipe) => ({
    ...recipe,
    processors: {
      grain: normalizeProcessorSub(recipe.processors.grain),
      quantize: normalizeProcessorSub(recipe.processors.quantize),
      resize: normalizeProcessorSub(recipe.processors.resize),
    },
  });
  return deepEqual(key(left), key(right));
}

/** WebP defaults from the codec meta: bulk's default shared output. */
function defaultSharedRecipe(): ImageRecipe {
  return {
    rotate: 0,
    processors: structuredClone(defaultProcessorState),
    output: {
      kind: 'raster',
      encoder: {
        type: 'webP',
        options: structuredClone(encoderMap.webP.meta.defaultOptions),
      },
    },
  };
}

function defaultOptionsByFormat(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    OUTPUT_FORMATS.map((format) => [format.id, getDefaultOptions(format.id)]),
  );
}

/** The OptionsPanel-shaped side the global panel binds, built from a recipe. */
function sideFromRecipe(recipe: ImageRecipe): SideState {
  const side: SideState = {
    format: 'webP',
    optionsByFormat: defaultOptionsByFormat(),
    processorState: structuredClone(defaultProcessorState) as ProcessorState,
  };
  applyRecipeToSide(recipe, side);
  return side;
}

function emptySession(): BulkSession {
  sessionCounter += 1;
  return createBulkSessionFromImport(
    `bulk-${sessionCounter}`,
    defaultSharedRecipe(),
    createImageJobs([]),
    structuredClone(DEFAULT_SVG_OPTIONS) as unknown as SvgOutputOptions,
  );
}

export class BulkStore {
  // The immutable engine session; reassigned on every reducer call.
  session = $state.raw<BulkSession>(emptySession());
  // Focus strip zoom (S/M/L). Session-scoped: persists across selections but
  // not reloads, matching the store's other in-memory bulk state.
  stripSize = $state<StripSize>('m');
  // Multi-select layer over the engine's single selectedJobId. The engine value
  // remains the ANCHOR; this set is the batch editing surface.
  readonly selectedIds = new SvelteSet<string>();
  #selectionOrder: string[] = [];
  // Which settings scope the right panel edits.
  panelScope = $state<BulkPanelScope>('global');
  keepOriginalWhenLarger = $state(true);
  exporting = $state(false);
  // OptionsPanel-compatible pseudo-side the global panel edits; it converts to
  // the shared recipe on apply.
  globalSide = $state<SideState>(sideFromRecipe(this.session.sharedRecipe));

  // Thumbnails + natural dims, keyed by job id. SvelteMap entries are replaced
  // (never deeply mutated) so its shallow reactivity is sufficient.
  readonly thumbs = new SvelteMap<string, BulkThumb>();

  // Full-size object URLs of the source Files, keyed by job id. Minted lazily
  // for StackStage's visible cards (top + capped peeks) because the thumbnails
  // are ~320px and read as low quality at stage size. Revoked alongside the
  // thumbnails on job removal / bulk reset, so they never leak on card cycling or
  // teardown. Deliberately a PLAIN Map, not a SvelteMap: `sourceUrlFor` is
  // called from a `$derived` and creates + caches the URL in the SAME
  // synchronous call, returning it directly. A reactive map would be MUTATED
  // during that derivation — an unsafe reactive write inside a derived that
  // stalls Svelte's scheduler. The URL is returned
  // immediately, so no reactive re-run is needed.
  readonly #sourceUrls = new Map<string, string>();

  // The processing driver (two persistent bridges + abort control).
  readonly runtime = new BulkRuntime();
  readonly #outputCache = new BulkOutputCache({ maxEntriesPerJob: 3 });
  readonly #thumbLimit = createLimiter(THUMB_CONCURRENCY);
  #pendingRemoval: PendingRemoval | null = null;

  // ── Derived view-models (engine selectors) ────────────────────────────────
  readonly stripItems = $derived<BulkStripItem[]>(
    getBulkStripItems(this.session),
  );
  readonly summary = $derived<BulkSessionSummary>(
    getBulkSessionSummary(this.session),
  );
  readonly selectedDetail = $derived<BulkSelectedJobDetail | undefined>(
    getBulkSelectedJobDetail(this.session),
  );

  // ── Conveniences ──────────────────────────────────────────────────────────
  readonly selectedId = $derived<string | undefined>(
    this.session.selectedJobId,
  );
  readonly selectedJob = $derived<ImageJob | undefined>(
    getSelectedJob(this.session),
  );
  readonly selectedThumb = $derived<BulkThumb | undefined>(
    this.selectedId ? this.thumbs.get(this.selectedId) : undefined,
  );
  readonly selectedFile = $derived<File | undefined>(
    this.selectedJob?.sourceFile,
  );
  readonly selectedCount = $derived(this.selectedIds.size);
  readonly selectedJobs = $derived<ImageJob[]>(
    this.session.jobs.filter((job) => this.selectedIds.has(job.id)),
  );
  readonly selectedHasOverrides = $derived(
    this.selectedJobs.some((job) => job.ownRecipe !== undefined),
  );
  readonly allJobsSelected = $derived(
    this.session.jobs.length > 0 &&
      this.selectedIds.size === this.session.jobs.length,
  );
  readonly hasJobs = $derived(this.session.jobs.length > 0);
  /**
   * The images the STACK resting stage fans out, anchor-first. Nothing selected
   * → every job (anchor = the first image). A multi-selection (N>1) → exactly
   * the selected jobs, anchor = the engine's selected/anchor job, so "3 selected
   * = a stack of those 3" and the top card is the one you'd focus. Returns the
   * strip view-models (name/size/delta/status/overrides) already computed by the
   * engine selector, reordered to put the anchor on top. Empty for a single
   * selection (that's the normal focus view, handled elsewhere).
   */
  readonly stackItems = $derived<BulkStripItem[]>(this.#computeStackItems());
  /** True while any job is decoding/processing (or the runtime loop is live). */
  readonly processing = $derived(
    this.summary.progress.active > 0 || this.summary.actions.hasActiveJobs,
  );
  readonly canSaveAll = $derived(
    canExportBulkSession(this.session) && !this.processing && !this.exporting,
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  #syncingGlobalSide = false;
  #sharedApplyTimer: ReturnType<typeof setTimeout> | null = null;
  #pendingShared: { recipe: ImageRecipe; onApplied?: () => void } | null = null;
  #selectedApplyTimer: ReturnType<typeof setTimeout> | null = null;
  #pendingSelectedEdit: {
    ids: string[];
    allJobsSelected: boolean;
    edit: (recipe: ImageRecipe) => ImageRecipe;
  } | null = null;
  #globalResizeSeededJobId: string | null = null;
  #globalResizeReference: {
    jobId: string;
    width: number;
    height: number;
  } | null = null;

  /**
   * Import files into the session, decode thumbnails, auto-select the first job
   * (the engine's addJobs does this when nothing is selected), and kick
   * processing. Files that aren't images are dropped by the import filter.
   */
  async importFiles(imported: ImportedFile[]): Promise<void> {
    if (imported.length === 0) return;

    const hadSelection = this.session.selectedJobId !== undefined;
    const previousJobCount = this.session.jobs.length;
    const relativePaths = new Map(
      imported.map(({ file, relativePath }) => [file, relativePath]),
    );
    const files = imported.map((item) => item.file);
    const result = createImageJobs(files, (file) => relativePaths.get(file));
    // addBulkImportToSession keeps existing jobs; auto-selects first if none.
    this.session = addBulkImportToSession(this.session, result);
    if (!hadSelection) this.deselect();
    else this.#pruneSelection();

    // Decode thumbnails for the newly accepted jobs (fire-and-forget each).
    // Use the POST-add ids, because the engine may suffix duplicate file ids.
    for (const job of this.session.jobs.slice(previousJobCount)) {
      void this.#thumbLimit(() => this.#ensureThumb(job.id, job.sourceFile));
    }

    void this.runtime.run(this);
  }

  setStripSize(next: StripSize): void {
    this.stripSize = next;
  }

  select(id: string): void {
    this.#replaceSelection([id], id);
  }

  selectNext(): void {
    this.session = selectNextJob(this.session);
    if (this.session.selectedJobId) {
      this.#replaceSelection(
        [this.session.selectedJobId],
        this.session.selectedJobId,
      );
    }
  }

  selectPrevious(): void {
    this.session = selectPreviousJob(this.session);
    if (this.session.selectedJobId) {
      this.#replaceSelection(
        [this.session.selectedJobId],
        this.session.selectedJobId,
      );
    }
  }

  toggleSelection(id: string): void {
    if (!this.session.jobs.some((job) => job.id === id)) return;

    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
      this.#selectionOrder = this.#selectionOrder.filter((item) => item !== id);
      if (this.selectedIds.size === 0) {
        this.deselect();
        return;
      }

      if (this.session.selectedJobId === id) {
        const nextAnchor = this.#selectionOrder.at(-1);
        if (nextAnchor) this.#setAnchor(nextAnchor);
      }
      return;
    }

    this.selectedIds.add(id);
    this.#selectionOrder = [
      ...this.#selectionOrder.filter((item) => item !== id),
      id,
    ];
    this.#setAnchor(id);
    this.panelScope = 'image';
  }

  selectRangeTo(id: string): void {
    const anchor = this.session.selectedJobId;
    if (!anchor) {
      this.select(id);
      return;
    }

    const ids = this.#rangeIds(anchor, id);
    if (ids.length === 0) return;
    this.#replaceSelection(ids, anchor);
  }

  selectDragRange(startId: string, endId: string): void {
    const ids = this.#rangeIds(startId, endId);
    if (ids.length === 0) return;
    this.#replaceSelection(ids, startId);
  }

  deselect(): void {
    this.selectedIds.clear();
    this.#selectionOrder = [];
    this.session = { ...this.session, selectedJobId: undefined };
    this.panelScope = 'global';
  }

  removeOne(id: string): void {
    this.#removeJobIds([id]);
  }

  removeSelected(): void {
    this.#removeJobIds(this.#selectedJobIds());
  }

  /**
   * Global-scope edit: replace the shared recipe. Coalesced over 200 ms so a
   * slider drag does not requeue the batch on every input event. `onApplied`
   * runs only when the change is more than a disabled processor's parameters.
   */
  setSharedRecipe(recipe: ImageRecipe, onApplied?: () => void): void {
    this.#pendingShared = { recipe: structuredClone(recipe), onApplied };
    if (this.#sharedApplyTimer !== null) clearTimeout(this.#sharedApplyTimer);
    this.#sharedApplyTimer = setTimeout(() => {
      this.#sharedApplyTimer = null;
      this.#flushShared();
    }, 200);
  }

  #flushShared(): void {
    const pending = this.#pendingShared;
    this.#pendingShared = null;
    if (!pending) return;
    const reference = this.#globalResizeReference
      ? {
          width: this.#globalResizeReference.width,
          height: this.#globalResizeReference.height,
        }
      : undefined;
    const current = this.session;
    if (
      deepEqual(pending.recipe, current.sharedRecipe) &&
      deepEqual(reference, current.resizeReference)
    ) {
      return;
    }
    const meaningful = !sameForBulkDiff(pending.recipe, current.sharedRecipe);
    this.#adoptSettingsSession(
      updateSharedRecipe(current, pending.recipe, reference),
    );
    if (meaningful) pending.onApplied?.();
  }

  setSharedSvgOptions(options: SvgOutputOptions): void {
    if (deepEqual(options, this.session.sharedSvgOptions)) return;
    this.#adoptSettingsSession(
      updateSharedSvgOptions(this.session, structuredClone(options)),
    );
  }

  /**
   * Image-scope edit: apply `edit` to each selected job's effective recipe and
   * store the result as its own recipe; a result equal (by signature) to what
   * the job would inherit clears the own recipe instead. With every image
   * selected the edit lands on the shared recipe. Coalesced like
   * setSharedRecipe; edits queued inside one window compose in order.
   */
  editSelected(edit: (recipe: ImageRecipe) => ImageRecipe): void {
    const ids = this.#selectedJobIds();
    if (ids.length === 0) return;

    const previous = this.#pendingSelectedEdit;
    if (previous && !deepEqual(previous.ids, ids)) this.#flushSelectedEdit();
    const earlier = this.#pendingSelectedEdit?.edit;
    this.#pendingSelectedEdit = {
      ids,
      allJobsSelected: this.allJobsSelected,
      edit: earlier ? (recipe) => edit(earlier(recipe)) : edit,
    };

    if (this.#selectedApplyTimer !== null) {
      clearTimeout(this.#selectedApplyTimer);
    }
    this.#selectedApplyTimer = setTimeout(() => {
      this.#selectedApplyTimer = null;
      this.#flushSelectedEdit();
    }, 200);
  }

  #flushSelectedEdit(): void {
    const pending = this.#pendingSelectedEdit;
    this.#pendingSelectedEdit = null;
    if (!pending) return;

    const liveIds = new Set(this.session.jobs.map((job) => job.id));
    const ids = pending.ids.filter((id) => liveIds.has(id));
    if (ids.length === 0) return;

    if (pending.allJobsSelected && ids.length === this.session.jobs.length) {
      this.#applyEditToShared(pending.edit);
      return;
    }

    this.#adoptSettingsSession(
      editJobRecipes(this.session, ids, pending.edit, (job) =>
        this.#jobDimensions(job),
      ),
    );
  }

  /** Every image selected: the image-scope edit becomes a shared edit. An
   *  SVG output edit (an SVG anchor) lands on the shared SVG options. */
  #applyEditToShared(edit: (recipe: ImageRecipe) => ImageRecipe): void {
    const current = this.session.sharedRecipe;
    const svgBase: ImageRecipe = {
      ...current,
      output: { kind: 'svg', options: this.session.sharedSvgOptions },
    };
    const editedSvg = edit(structuredClone(svgBase)).output;
    const edited = edit(structuredClone(current));
    let nextSession = this.session;
    if (editedSvg.kind === 'svg') {
      nextSession = updateSharedSvgOptions(nextSession, editedSvg.options);
    }
    const next: ImageRecipe =
      edited.output.kind === 'svg'
        ? { ...edited, output: current.output }
        : edited;
    if (!sameForBulkDiff(next, current)) {
      nextSession = updateSharedRecipe(nextSession, next);
    }
    if (nextSession !== this.session) this.#adoptSettingsSession(nextSession);
  }

  /** Return every selected image to the shared recipe. */
  resetSelectedToShared(): void {
    const ids = this.#selectedJobIds();
    if (ids.length === 0) return;
    // A queued image-scope edit predates the reset; flushing it later would
    // silently re-create the own recipes just cleared.
    if (this.#selectedApplyTimer !== null) {
      clearTimeout(this.#selectedApplyTimer);
      this.#selectedApplyTimer = null;
    }
    this.#pendingSelectedEdit = null;

    let nextSession = this.session;
    for (const id of ids) {
      nextSession = setJobOwnRecipe(nextSession, id, undefined);
    }
    this.#adoptSettingsSession(nextSession);
  }

  effectiveRecipeFor(jobId: string): ImageRecipe | undefined {
    const job = this.session.jobs.find((item) => item.id === jobId);
    if (!job) return;
    return effectiveRecipe(this.session, job, this.#jobDimensions(job));
  }

  #adoptSettingsSession(session: BulkSession): void {
    const nextSession = this.#restoreCachedOrQueueStale(session);
    if (nextSession === this.session) return;

    this.session = nextSession;
    this.#pinCurrentOutputs();
    if (this.session.jobs.some((job) => job.status === 'queued')) {
      void this.runtime.run(this);
    }
  }

  #restoreCachedOrQueueStale(
    session: BulkSession,
    requeueMissingJobIds = new Set<string>(),
  ): BulkSession {
    const normalizedSession = normalizeBulkSessionCounters(session);
    let changed = false;

    const jobs = normalizedSession.jobs.map((job) => {
      const hash = this.#settingsHashForJob(normalizedSession, job);
      if (job.output?.settingsHash === hash) return job;

      if (job.output) {
        this.#outputCache.put(job.id, job.output.settingsHash, job.output);
      }

      const cached = this.#outputCache.get(job.id, hash);
      if (cached) {
        changed = true;
        return {
          ...job,
          status: 'encoded' as const,
          output: cached,
          error: undefined,
        };
      }

      if (!job.output) {
        if (!requeueMissingJobIds.has(job.id) || job.status === 'queued') {
          return job;
        }

        changed = true;
        return resetJobForQueue(job);
      }

      changed = true;
      return resetJobForQueue(job);
    });

    return changed
      ? normalizeBulkSessionCounters({ ...normalizedSession, jobs })
      : normalizedSession;
  }

  rememberOutput(jobId: string, output: ImageOutput): void {
    this.#outputCache.put(jobId, output.settingsHash, output);
    this.#pinCurrentOutputs();
  }

  cachedOutputFor(job: ImageJob): ImageOutput | undefined {
    return this.#outputCache.get(
      job.id,
      this.#settingsHashForJob(this.session, job),
    );
  }

  requeueStale(): void {
    const next = this.#restoreCachedOrQueueStale(this.session);
    if (next === this.session) return;
    this.session = next;
    this.#pinCurrentOutputs();
  }

  settingsHashForJob(job: ImageJob): string {
    return this.#settingsHashForJob(this.session, job);
  }

  refreshGlobalSideFromSession(): void {
    const next = sideFromRecipe(this.session.sharedRecipe);
    if (deepEqual($state.snapshot(this.globalSide), next)) return;

    this.#syncingGlobalSide = true;
    this.globalSide.format = next.format;
    this.globalSide.optionsByFormat = next.optionsByFormat;
    this.globalSide.processorState = next.processorState;
    queueMicrotask(() => {
      this.#syncingGlobalSide = false;
    });
  }

  seedGlobalResizeDimensions(width: number, height: number): void {
    const firstJobId = this.session.jobs[0]?.id;
    if (
      !firstJobId ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width < 1 ||
      height < 1
    ) {
      return;
    }

    const resize = this.globalSide.processorState.resize;
    const alreadySeeded = this.#globalResizeSeededJobId === firstJobId;
    const stillDefaultSize = resize.width === 1 && resize.height === 1;
    if (alreadySeeded && !stillDefaultSize) return;
    if (resize.enabled && !stillDefaultSize) return;

    resize.width = Math.round(width);
    resize.height = Math.round(height);
    this.#globalResizeSeededJobId = firstJobId;
    this.#globalResizeReference = {
      jobId: firstJobId,
      width: Math.round(width),
      height: Math.round(height),
    };
  }

  setGlobalFormat(format: SideFormat): void {
    // The shared recipe is raster; SVG sources get the SVG lane on their own.
    if (format === 'identity' || format === 'svg') return;
    this.globalSide.format = format;
  }

  /** Apply the global panel's side to the shared recipe (see setSharedRecipe). */
  queueGlobalSideApply(onApplied?: () => void): void {
    const snapshot = $state.snapshot(this.globalSide) as SideState;
    if (
      this.#syncingGlobalSide ||
      snapshot.format === 'identity' ||
      snapshot.format === 'svg'
    ) {
      return;
    }
    this.setSharedRecipe(
      recipeFromSide(snapshot, { rotate: { rotate: 0 } }),
      onApplied,
    );
  }

  /**
   * The ready-to-download output for a job (the engine-minted URL + an
   * export-safe filename), or `undefined` while the job has no current output.
   * Powers the strip's per-thumb hover-download affordance.
   */
  downloadFor(jobId: string): JobDownload | undefined {
    const job = this.session.jobs.find((item) => item.id === jobId);
    if (!job?.output) return undefined;
    return {
      url: job.output.downloadUrl,
      fileName: getBulkOutputFileName(job),
    };
  }

  /**
   * A full-size object URL for a job's SOURCE File, minted on first request and
   * cached in `#sourceUrls`. StackStage uses this for its visible cards so they
   * render at full quality instead of the ~320px thumbnail. Owned by the store:
   * revoked in `#revokeRemovedJobs` (card removal) and `#revokeAll`
   * (reset/dispose), so cycling the fan or removing images never leaks a URL.
   * Safe to call from a `$derived`: the cache is a plain (non-reactive) Map and
   * the URL is minted + returned synchronously, so nothing reactive is mutated
   * mid-derivation (a reactive write there would stall Svelte's scheduler).
   */
  sourceUrlFor(jobId: string | undefined): string | undefined {
    if (!jobId) return undefined;
    const existing = this.#sourceUrls.get(jobId);
    if (existing) return existing;
    const job = this.session.jobs.find((item) => item.id === jobId);
    if (!job) return undefined;
    const url = URL.createObjectURL(job.sourceFile);
    this.#sourceUrls.set(jobId, url);
    return url;
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  /**
   * Order the stack's images anchor-first. Reads `stripItems` (the reactive
   * engine view-models) so cards get live size/delta/status without a second
   * pass. A single selection returns [] — that case is the real focus view.
   */
  #computeStackItems(): BulkStripItem[] {
    const items = this.stripItems;
    if (items.length === 0) return [];

    // Multi-select: exactly the selection, in selection order, anchor on top.
    if (this.selectedIds.size > 1) {
      const selectedItems = this.#selectionOrder
        .filter((id) => this.selectedIds.has(id))
        .map((id) => items.find((item) => item.id === id))
        .filter((item): item is BulkStripItem => item !== undefined);
      if (selectedItems.length === 0) return [];
      const anchorId = this.session.selectedJobId;
      const anchorIndex = selectedItems.findIndex(
        (item) => item.id === anchorId,
      );
      if (anchorIndex > 0) {
        const [anchor] = selectedItems.splice(anchorIndex, 1);
        selectedItems.unshift(anchor);
      }
      return selectedItems;
    }

    // Single selection is the focus view, not the stack.
    if (this.selectedIds.size === 1) return [];

    // Nothing selected: the whole batch, first image on top (document order).
    return items;
  }

  #settingsHashForJob(session: BulkSession, job: ImageJob): string {
    return jobRecipeHash(session, job, this.#jobDimensions(job));
  }

  #jobDimensions(
    job: ImageJob,
  ): { width?: number; height?: number } | undefined {
    const recorded = getJobSourceDimensions(job);
    if (recorded) return recorded;
    const thumb = this.thumbs.get(job.id);
    return thumb ? { width: thumb.w, height: thumb.h } : undefined;
  }

  #pinCurrentOutputs(): void {
    this.#outputCache.setPinned(
      this.session.jobs
        .map((job) => job.output)
        .filter((output): output is ImageOutput => output !== undefined),
    );
  }

  /** Cancel any in-flight processing (returns active jobs to the queue). */
  cancelProcessing(): void {
    this.runtime.cancelProcessing(this);
  }

  #removeJobIds(ids: string[]): void {
    const removeIds = Array.from(new Set(ids)).filter((id) =>
      this.session.jobs.some((job) => job.id === id),
    );
    if (removeIds.length === 0) return;

    this.#finalizePendingRemoval();

    const removeSet = new Set(removeIds);
    const jobsBefore = this.session.jobs;
    const removedJobs = jobsBefore.filter((job) => removeSet.has(job.id));
    const removedActive = removedJobs.some(
      (job) => job.status === 'decoding' || job.status === 'processing',
    );
    const fallbackAnchor = this.#anchorAfterRemoval(removeSet);

    if (removedActive) {
      this.runtime.cancelProcessing(this);
    }

    const items = this.session.jobs
      .map((job, index) => ({ job, index }))
      .filter((item) => removeSet.has(item.job.id));
    const holder: PendingRemoval = { items };
    this.#pendingRemoval = holder;

    this.session = {
      ...removeJobs(this.session, removeIds),
      selectedJobId: fallbackAnchor,
    };
    this.#selectionOrder = this.#selectionOrder.filter(
      (id) =>
        !removeSet.has(id) && this.session.jobs.some((job) => job.id === id),
    );
    this.selectedIds.clear();
    for (const id of this.#selectionOrder) this.selectedIds.add(id);

    if (fallbackAnchor && !this.selectedIds.has(fallbackAnchor)) {
      this.selectedIds.add(fallbackAnchor);
      this.#selectionOrder = [...this.#selectionOrder, fallbackAnchor];
    }
    if (!fallbackAnchor) {
      this.selectedIds.clear();
      this.#selectionOrder = [];
      this.panelScope = 'global';
    } else {
      this.panelScope = 'image';
    }
    this.#pinCurrentOutputs();

    void this.#offerRemovalUndo(holder);

    if (this.session.jobs.some((job) => job.status === 'queued')) {
      void this.runtime.run(this);
    }
  }

  async #offerRemovalUndo(holder: PendingRemoval): Promise<void> {
    const { items } = holder;
    const label =
      items.length === 1
        ? `Removed ${items[0].job.sourceFile.name}`
        : `Removed ${items.length} images`;

    // Cmd/Ctrl+Z stays reserved for the focused editor's history. Removal undo
    // is offered only through the snackbar action.
    const action = await snackbar.show(label, { actions: ['Undo'] });
    if (this.#pendingRemoval !== holder) return;

    if (action === 'Undo') this.#restorePendingRemoval();
    else this.#finalizePendingRemoval();
  }

  #finalizePendingRemoval(): void {
    const pending = this.#pendingRemoval;
    if (!pending) return;

    this.#pendingRemoval = null;
    this.#revokeRemovedJobs(pending.items.map((item) => item.job));
    if (this.session.jobs.length === 0) {
      this.runtime.disposeBridges();
    }
  }

  #restorePendingRemoval(): void {
    const pending = this.#pendingRemoval;
    if (!pending) return;

    // Removing the final image makes +page.svelte's bulk mirror unwind the
    // editor history entry. Restore that shallow-route state before jobs come
    // back, or its next effect pass sees hasJobs without editor state and
    // immediately resets the restored batch.
    if (!page.state.editor) pushState('', { editor: true });

    let nextSession = this.session;
    for (const { job, index } of pending.items) {
      nextSession = restoreJob(nextSession, job, index);
    }
    this.session = this.#restoreCachedOrQueueStale(
      nextSession,
      new Set(pending.items.map((item) => item.job.id)),
    );
    this.#pinCurrentOutputs();
    this.#pendingRemoval = null;

    // Thumbnails and source URLs were deliberately never revoked, so their map
    // entries are already live again after restore.
    if (this.session.jobs.some((job) => job.status === 'queued')) {
      void this.runtime.run(this);
    }
  }

  #anchorAfterRemoval(removeSet: Set<string>): string | undefined {
    const anchor = this.session.selectedJobId;
    const remainingJobs = this.session.jobs.filter(
      (job) => !removeSet.has(job.id),
    );
    if (remainingJobs.length === 0) return undefined;
    if (anchor && !removeSet.has(anchor)) return anchor;
    if (!anchor) return undefined;

    const anchorIndex = this.session.jobs.findIndex((job) => job.id === anchor);
    const selectedSurvivors = remainingJobs.filter((job) =>
      this.selectedIds.has(job.id),
    );
    const candidates =
      selectedSurvivors.length > 0 ? selectedSurvivors : remainingJobs;
    return (
      candidates.find((job) => {
        const index = this.session.jobs.findIndex((item) => item.id === job.id);
        return index > anchorIndex;
      })?.id ?? candidates.at(-1)?.id
    );
  }

  #revokeRemovedJobs(jobs: ImageJob[]): void {
    const revoked = new Set<string>();
    for (const job of jobs) {
      const thumb = this.thumbs.get(job.id);
      if (thumb) {
        URL.revokeObjectURL(thumb.url);
        this.thumbs.delete(job.id);
      }
      const sourceUrl = this.#sourceUrls.get(job.id);
      if (sourceUrl) {
        URL.revokeObjectURL(sourceUrl);
        this.#sourceUrls.delete(job.id);
      }
      revokeJobObjectUrls(job, (url) => {
        if (revoked.has(url)) return;
        URL.revokeObjectURL(url);
        revoked.add(url);
      });
      this.#outputCache.deleteJob(job.id, revoked);
    }
  }

  /** Drop both debounced settings applies (their snapshots are pre-reset/-teardown state). */
  #clearApplyTimers(): void {
    if (this.#sharedApplyTimer !== null) {
      clearTimeout(this.#sharedApplyTimer);
      this.#sharedApplyTimer = null;
    }
    this.#pendingShared = null;
    if (this.#selectedApplyTimer !== null) {
      clearTimeout(this.#selectedApplyTimer);
      this.#selectedApplyTimer = null;
    }
    this.#pendingSelectedEdit = null;
  }

  /** Tear down the whole bulk session: cancel, revoke every URL, start fresh. */
  reset(): void {
    this.#clearApplyTimers();
    this.runtime.cancelProcessing(this);
    this.#finalizePendingRemoval();
    this.#revokeAll();
    this.session = emptySession();
    this.selectedIds.clear();
    this.#selectionOrder = [];
    this.panelScope = 'global';
    this.#globalResizeSeededJobId = null;
    this.#globalResizeReference = null;
    this.refreshGlobalSideFromSession();
  }

  async saveAll(): Promise<void> {
    if (this.exporting) return;
    const plan = createBulkExportPlan(this.session, undefined, {
      keepOriginalWhenLarger: this.keepOriginalWhenLarger,
    });
    if (plan.entries.length === 0) return;
    this.exporting = true;
    try {
      const blob = await buildZipBlob(plan);
      triggerBlobDownload(blob, `${plan.archiveName}.zip`);
      this.session = markBulkExportPlanExported(this.session, plan);
      void snackbar.show(`Saved ${plan.entries.length} images as ZIP.`);
    } catch (err) {
      void snackbar.show('ZIP export failed.');
      throw err;
    } finally {
      this.exporting = false;
    }
  }

  #setAnchor(id: string | undefined): void {
    if (!id) {
      this.deselect();
      return;
    }
    if (!this.session.jobs.some((job) => job.id === id)) return;
    if (!this.selectedIds.has(id)) {
      this.selectedIds.add(id);
      this.#selectionOrder = [
        ...this.#selectionOrder.filter((item) => item !== id),
        id,
      ];
    }
    this.session = selectJob(this.session, id);
  }

  #replaceSelection(ids: string[], anchor: string | undefined): void {
    const validIds = ids.filter((id) =>
      this.session.jobs.some((job) => job.id === id),
    );
    if (validIds.length === 0 || !anchor) {
      this.deselect();
      return;
    }

    const nextAnchor = validIds.includes(anchor) ? anchor : validIds[0];
    this.selectedIds.clear();
    for (const id of validIds) this.selectedIds.add(id);
    this.#selectionOrder = validIds;
    this.session = selectJob(this.session, nextAnchor);
    this.panelScope = 'image';
  }

  #rangeIds(fromId: string, toId: string): string[] {
    const start = this.session.jobs.findIndex((job) => job.id === fromId);
    const end = this.session.jobs.findIndex((job) => job.id === toId);
    if (start === -1 || end === -1) return [];

    const [lo, hi] = start < end ? [start, end] : [end, start];
    return this.session.jobs.slice(lo, hi + 1).map((job) => job.id);
  }

  #selectedJobIds(): string[] {
    const liveIds = new Set(this.session.jobs.map((job) => job.id));
    return this.#selectionOrder.filter(
      (id) => liveIds.has(id) && this.selectedIds.has(id),
    );
  }

  #pruneSelection(): void {
    const ids = this.#selectedJobIds();
    const anchor = this.session.selectedJobId;
    if (ids.length === 0) {
      this.deselect();
      return;
    }
    this.#replaceSelection(
      ids,
      anchor && ids.includes(anchor) ? anchor : ids.at(-1),
    );
  }

  // ── Thumbnails ────────────────────────────────────────────────────────────

  /**
   * Decode the source File to an ImageBitmap (capturing natural w/h), draw it
   * scaled to ~THUMB_MAX on a canvas, encode a small blob, and store the object
   * URL + natural dimensions. Bitmaps are closed immediately. No-op if a thumb
   * already exists for the id.
   */
  async #ensureThumb(id: string, file: File): Promise<void> {
    // Queued behind the limiter, so the job may be gone by its turn.
    if (this.thumbs.has(id) || !this.session.jobs.some((job) => job.id === id))
      return;
    let bitmap: ImageBitmap | undefined;
    try {
      bitmap = await createImageBitmap(file);
      const natW = bitmap.width;
      const natH = bitmap.height;
      const scale = Math.min(1, THUMB_MAX / Math.max(natW, natH));
      const w = Math.max(1, Math.round(natW * scale));
      const h = Math.max(1, Math.round(natH * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0, w, h);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, 'image/webp', 0.72);
      });
      if (!blob) return;

      // A job may have been removed/reset while decoding — don't leak a URL.
      if (!this.session.jobs.some((job) => job.id === id)) return;
      this.#recordJobDimensions(id, natW, natH);
      this.thumbs.set(id, {
        url: URL.createObjectURL(blob),
        w: natW,
        h: natH,
      });
    } catch {
      // Undecodable source: leave the strip to show a placeholder.
    } finally {
      bitmap?.close();
    }
  }

  #recordJobDimensions(id: string, width: number, height: number): void {
    this.session = {
      ...this.session,
      jobs: this.session.jobs.map((job) =>
        job.id === id
          ? {
              ...job,
              sourceWidth: width,
              sourceHeight: height,
            }
          : job,
      ),
    };
  }

  /** Revoke every thumbnail URL and every engine-owned output/preview URL. */
  #revokeAll(): void {
    for (const thumb of this.thumbs.values()) URL.revokeObjectURL(thumb.url);
    this.thumbs.clear();
    for (const url of this.#sourceUrls.values()) URL.revokeObjectURL(url);
    this.#sourceUrls.clear();
    this.#outputCache.clear();
    revokeSessionObjectUrls(this.session);
  }

  /** Full teardown (workers + URLs). Call from the route's onMount cleanup. */
  dispose(): void {
    this.#clearApplyTimers();
    this.runtime.disposeBridges();
    this.#finalizePendingRemoval();
    this.#revokeAll();
  }
}

// Module-level singleton for the client-side bulk surface.
export const bulkStore = new BulkStore();
