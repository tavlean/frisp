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
  clearJobOverrides,
  createBulkExportPlan,
  createBulkSessionFromImport,
  createImageJobs,
  getBulkOutputFileName,
  getBulkSelectedJobDetail,
  getBulkSessionSummary,
  getBulkStripItems,
  getEffectiveSettings,
  getJobSourceDimensions,
  getSelectedJob,
  getSettingsOverridePaths,
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
  settingsHash,
  updateGlobalSettings,
  updateJobOverrides,
  type BulkImageOverrides,
  type BulkImageSettings,
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
  type EncoderState,
  type EncoderType,
} from 'client/lazy-app/feature-meta';
import {
  getMatchingResizePreset,
  getResizePresetSize,
} from 'features/processors/resize/client/preset-state';
import { stableStringify } from 'shared/stable-stringify';
// Bulk is WebP-locked for the first production pass, so use the CONCRETE WebP option type (which has
// `quality`/`method`) rather than the wide `EncoderOptions` union (whose members
// share no common keys — it can't be indexed by encoder-specific fields, and
// `encoderState.options` for `type:'webP'` wants exactly this type).
import type { EncodeOptions as WebpEncodeOptions } from 'features/encoders/webP/shared/meta';
import { snackbar } from '$lib/editor/snackbar-store.svelte';
import type { ImportedFile } from './import-sources';
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

/** The two overridable WebP option leaves the bulk UI exposes as controls. */
export type BulkOverridablePath = 'quality' | 'method';

/** Longest edge of the generated thumbnail canvas. */
const THUMB_MAX = 320;

let sessionCounter = 0;

export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

function isProcessorSubEnabled(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { enabled?: unknown }).enabled === true
  );
}

function normalizeProcessorSub<T extends { enabled?: unknown }>(
  value: T,
): T | { enabled: false } {
  if (!isProcessorSubEnabled(value)) return { enabled: false };
  return structuredClone(value);
}

export function normalizeProcessorStateForBulkDiff(
  processorState: BulkImageSettings['processorState'],
): BulkImageSettings['processorState'] {
  return {
    ...structuredClone(processorState),
    resize: normalizeProcessorSub(processorState.resize),
    quantize: normalizeProcessorSub(processorState.quantize),
  } as BulkImageSettings['processorState'];
}

export function normalizeBulkSettingsForBulkDiff(
  settings: BulkImageSettings,
): BulkImageSettings {
  return {
    encoderState: settings.encoderState
      ? structuredClone(settings.encoderState)
      : undefined,
    processorState: normalizeProcessorStateForBulkDiff(settings.processorState),
  };
}

export function bulkSettingsEqualForBulkDiff(
  left: BulkImageSettings,
  right: BulkImageSettings,
): boolean {
  return deepEqual(
    normalizeBulkSettingsForBulkDiff(left),
    normalizeBulkSettingsForBulkDiff(right),
  );
}

/** WebP defaults from the codec meta — bulk's first-pass global format. */
function defaultGlobalSettings(): BulkImageSettings {
  return {
    encoderState: {
      type: 'webP',
      options: structuredClone(encoderMap.webP.meta.defaultOptions),
    },
    processorState: structuredClone(defaultProcessorState),
  };
}

function defaultOptionsByFormat(): Record<string, Record<string, unknown>> {
  return Object.fromEntries(
    OUTPUT_FORMATS.map((format) => [format.id, getDefaultOptions(format.id)]),
  );
}

function sideFromSettings(settings: BulkImageSettings): SideState {
  const optionsByFormat = defaultOptionsByFormat();
  const encoderState = settings.encoderState;
  const format = (encoderState?.type ?? 'webP') as SideFormat;

  if (encoderState) {
    optionsByFormat[encoderState.type] = structuredClone(
      encoderState.options as Record<string, unknown>,
    );
  }

  return {
    format,
    optionsByFormat,
    processorState: structuredClone(settings.processorState),
  };
}

function emptySession(): BulkSession {
  sessionCounter += 1;
  return createBulkSessionFromImport(
    `bulk-${sessionCounter}`,
    defaultGlobalSettings(),
    createImageJobs([]),
  );
}

/** The WebP encode options carried by a settings object (format is locked). */
function webpOptions(settings: BulkImageSettings): WebpEncodeOptions {
  return (settings.encoderState?.options ??
    encoderMap.webP.meta.defaultOptions) as WebpEncodeOptions;
}

/**
 * Rebuild a job's sparse override object WITHOUT one dotted path (e.g.
 * "encoderState" or "processorState.resize.width"). Used by resetOverridePath:
 * take the current overrides, drop the branch the path names, and drop any
 * container that becomes empty, so `hasSettingsOverrides` reads correctly and
 * the per-control dot clears.
 */
function omitOverridePath(
  overrides: BulkImageOverrides | undefined,
  path: string,
): BulkImageOverrides {
  if (!overrides) return {};
  const segments = path.split('.');
  const [head] = segments;

  if (head === 'encoderState') {
    // Format/encoder override is a single visible leaf in the current UI;
    // dropping it also drops the sparse engine companion.
    const {
      encoderState: _droppedEncoder,
      encoderControls: _droppedControls,
      ...rest
    } = overrides;
    return rest;
  }

  if (head !== 'processorState' || !overrides.processorState) {
    return { ...overrides };
  }

  // Deep-clone the processorState branch, delete the addressed leaf, then prune
  // empty ancestors on the way back up.
  const clone = structuredClone(overrides.processorState) as Record<
    string,
    unknown
  >;
  const chain = segments.slice(1);
  const parents: Record<string, unknown>[] = [clone];
  let cursor: Record<string, unknown> = clone;

  for (let i = 0; i < chain.length - 1; i += 1) {
    const next = cursor[chain[i]];
    if (typeof next !== 'object' || next === null) break;
    cursor = next as Record<string, unknown>;
    parents.push(cursor);
  }
  delete cursor[chain[chain.length - 1]];

  for (let i = parents.length - 1; i > 0; i -= 1) {
    if (Object.keys(parents[i]).length === 0) {
      const parentKey = chain[i - 1];
      delete parents[i - 1][parentKey];
    }
  }

  const next: BulkImageOverrides = { ...overrides };
  if (Object.keys(clone).length === 0) {
    delete next.processorState;
  } else {
    next.processorState = clone as BulkImageOverrides['processorState'];
  }
  return next;
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
  // Production OptionsPanel-compatible pseudo-side for GLOBAL bulk settings.
  globalSide = $state<SideState>(sideFromSettings(this.session.globalSettings));

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
    this.selectedJobs.some((job) => this.overridePaths(job.id).length > 0),
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
  #globalApplyTimer: ReturnType<typeof setTimeout> | null = null;
  #selectedApplyTimer: ReturnType<typeof setTimeout> | null = null;
  #pendingSelectedApply: {
    ids: string[];
    allJobsSelected: boolean;
    overrides: BulkImageOverrides;
    onApplied?: () => void;
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
      void this.#ensureThumb(job.id, job.sourceFile);
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
   * Update GLOBAL WebP encode options (merged onto the current global options).
   * Routes through the cache-aware global settings applicator so only genuinely
   * stale jobs queue, then kicks a run to encode the misses.
   */
  updateGlobal(partial: Partial<WebpEncodeOptions>): void {
    const current = webpOptions(this.session.globalSettings);
    const nextSettings: BulkImageSettings = {
      ...this.session.globalSettings,
      encoderState: {
        type: 'webP',
        options: { ...current, ...partial } as WebpEncodeOptions,
      },
    };
    if (
      bulkSettingsEqualForBulkDiff(nextSettings, this.session.globalSettings)
    ) {
      return;
    }
    this.#applyGlobalSettings(nextSettings);
  }

  /**
   * Override WebP options for the SELECTED job. The UI still writes the legacy
   * full option object; the engine reducer records the sparse control companion.
   * Start from the job's effective options and layer the changed keys on top.
   * Requeues the job if its output went stale, then kicks a run.
   */
  overrideSelected(partial: Partial<WebpEncodeOptions>): void {
    const id = this.session.selectedJobId;
    if (!id) return;
    const job = this.session.jobs.find((item) => item.id === id);
    if (!job) return;

    const effective = getEffectiveSettings(
      this.session.globalSettings,
      job.overrides,
    );
    const base = webpOptions(effective);
    const overrides: BulkImageOverrides = {
      ...job.overrides,
      encoderState: {
        type: 'webP',
        options: { ...base, ...partial } as WebpEncodeOptions,
      },
    };
    this.#applyJobOverrides(id, overrides);
  }

  /**
   * Clear ONE overridden leaf on a job (the per-control reset affordance). For
   * the WebP option leaves (quality/method) still use the current UI path, so
   * resetting one option means recomputing the encoder override from the global
   * with only the OTHER overridden options kept, and dropping it entirely if
   * that leaves nothing deviating from the global.
   */
  resetOverridePath(id: string, path: string): void {
    const job = this.session.jobs.find((item) => item.id === id);
    if (!job) return;

    let next: BulkImageOverrides;
    if (path === 'quality' || path === 'method') {
      next = this.#clearEncoderOption(job, path);
    } else {
      next = omitOverridePath(job.overrides, path);
    }

    this.#applyJobOverrides(id, next);
  }

  /**
   * Recompute a job's encoder override with ONE WebP option leaf reset back to
   * the global value; drop the whole encoderState override if nothing deviates.
   */
  #clearEncoderOption(
    job: ImageJob,
    leaf: BulkOverridablePath,
  ): BulkImageOverrides {
    const globalOptions = webpOptions(this.session.globalSettings);
    const jobOptions = webpOptions(
      getEffectiveSettings(this.session.globalSettings, job.overrides),
    );

    const merged: WebpEncodeOptions = {
      ...jobOptions,
      [leaf]: globalOptions[leaf],
    };
    const stillDeviates = (['quality', 'method'] as const).some(
      (key) => merged[key] !== globalOptions[key],
    );

    const next: BulkImageOverrides = { ...job.overrides };
    if (stillDeviates) {
      next.encoderState = { type: 'webP', options: merged };
    } else {
      delete next.encoderState;
    }
    return next;
  }

  /** Clear ALL overrides on a job ("Reset all to global"). */
  resetAllOverrides(id: string): void {
    this.#clearJobOverrides(id);
  }

  applyAnchorOverrides(overrides: BulkImageOverrides): void {
    const id = this.session.selectedJobId;
    if (!id) return;

    this.#applyJobOverrides(id, overrides);
  }

  clearAnchorOverrides(): void {
    const id = this.session.selectedJobId;
    if (!id) return;

    this.#clearJobOverrides(id);
  }

  applySelectedOverrides(overrides: BulkImageOverrides): void {
    const ids = this.#selectedJobIds();
    if (ids.length === 0) return;

    if (this.allJobsSelected) {
      const nextSettings = getEffectiveSettings(
        this.session.globalSettings,
        overrides,
      );
      if (
        bulkSettingsEqualForBulkDiff(nextSettings, this.session.globalSettings)
      ) {
        return;
      }
      this.#applyGlobalSettings(nextSettings);
      return;
    }

    let nextSession = this.session;
    for (const id of ids) {
      nextSession = updateJobOverrides(
        nextSession,
        id,
        structuredClone(overrides),
      );
    }
    this.#adoptSettingsSession(nextSession);
  }

  clearSelectedOverrides(): void {
    const ids = this.#selectedJobIds();
    if (ids.length === 0) return;

    let nextSession = this.session;
    for (const id of ids) {
      nextSession = clearJobOverrides(nextSession, id);
    }
    this.#adoptSettingsSession(nextSession);
  }

  queueSelectedOverridesApply(
    overrides: BulkImageOverrides,
    onApplied?: () => void,
  ): void {
    const ids = this.#selectedJobIds();
    if (ids.length === 0) return;

    this.#pendingSelectedApply = {
      ids,
      allJobsSelected: this.allJobsSelected,
      overrides: structuredClone(overrides),
      onApplied,
    };

    if (this.#selectedApplyTimer !== null) {
      clearTimeout(this.#selectedApplyTimer);
    }
    this.#selectedApplyTimer = setTimeout(() => {
      this.#selectedApplyTimer = null;
      this.#flushSelectedApply();
    }, 200);
  }

  #flushSelectedApply(): void {
    const pending = this.#pendingSelectedApply;
    this.#pendingSelectedApply = null;
    if (!pending) return;

    const liveIds = new Set(this.session.jobs.map((job) => job.id));
    const ids = pending.ids.filter((id) => liveIds.has(id));
    if (ids.length === 0) return;

    if (pending.allJobsSelected && ids.length === this.session.jobs.length) {
      const nextSettings = getEffectiveSettings(
        this.session.globalSettings,
        pending.overrides,
      );
      if (
        bulkSettingsEqualForBulkDiff(nextSettings, this.session.globalSettings)
      ) {
        return;
      }
      this.#applyGlobalSettings(nextSettings);
      pending.onApplied?.();
      return;
    }

    let nextSession = this.session;
    for (const id of ids) {
      nextSession = updateJobOverrides(
        nextSession,
        id,
        structuredClone(pending.overrides),
      );
    }
    this.#adoptSettingsSession(nextSession);
    pending.onApplied?.();
  }

  #applyGlobalSettings(globalSettings: BulkImageSettings): void {
    this.#adoptSettingsSession(
      updateGlobalSettings(this.session, globalSettings),
    );
  }

  #applyJobOverrides(jobId: string, overrides: BulkImageOverrides): void {
    this.#adoptSettingsSession(
      updateJobOverrides(this.session, jobId, overrides),
    );
  }

  #clearJobOverrides(jobId: string): void {
    this.#adoptSettingsSession(clearJobOverrides(this.session, jobId));
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

  settingsHashForJob(job: ImageJob): string {
    return this.#settingsHashForJob(this.session, job);
  }

  refreshGlobalSideFromSession(): void {
    const next = sideFromSettings(this.session.globalSettings);
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

  processingGlobalSettingsForJob(job: ImageJob): BulkImageSettings {
    const settings = structuredClone(this.session.globalSettings);
    const resize = settings.processorState.resize;
    const reference = this.#globalResizeReference;
    const thumb = this.thumbs.get(job.id);
    const hasResizeOverride =
      job.overrides?.processorState?.resize !== undefined;

    if (!resize.enabled || !reference || !thumb || hasResizeOverride) {
      return settings;
    }

    const preset = getMatchingResizePreset(
      { width: resize.width, height: resize.height },
      reference.width,
      reference.height,
    );
    if (preset === 'custom') return settings;

    const size = getResizePresetSize(thumb.w, thumb.h, preset);
    resize.width = size.width;
    resize.height = size.height;
    return settings;
  }

  setGlobalFormat(format: SideFormat): void {
    if (format === 'identity') return;
    this.globalSide.format = format;
  }

  queueGlobalSideApply(onApplied?: () => void): void {
    const snapshot = $state.snapshot(this.globalSide) as SideState;
    if (this.#syncingGlobalSide || snapshot.format === 'identity') return;

    if (this.#globalApplyTimer !== null) clearTimeout(this.#globalApplyTimer);
    this.#globalApplyTimer = setTimeout(() => {
      this.#globalApplyTimer = null;
      const format = snapshot.format as EncoderType;
      const nextSettings: BulkImageSettings = {
        encoderState: {
          type: format,
          options: structuredClone(snapshot.optionsByFormat[format] ?? {}),
        } as EncoderState,
        processorState: structuredClone(snapshot.processorState),
        resizeReference: this.#globalResizeReference
          ? {
              width: this.#globalResizeReference.width,
              height: this.#globalResizeReference.height,
            }
          : undefined,
      };

      if (
        bulkSettingsEqualForBulkDiff(nextSettings, this.session.globalSettings)
      ) {
        return;
      }

      this.#applyGlobalSettings(nextSettings);
      onApplied?.();
    }, 200);
  }

  /** Effective (global + override) WebP options for a job, or the global. */
  effectiveOptionsFor(jobId: string | undefined): WebpEncodeOptions {
    const job = jobId
      ? this.session.jobs.find((item) => item.id === jobId)
      : undefined;
    return webpOptions(
      getEffectiveSettings(this.session.globalSettings, job?.overrides),
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

  /** All overridden dotted paths for a job (for the corner dot / tooltip). */
  overridePaths(jobId: string | undefined): string[] {
    const job = jobId
      ? this.session.jobs.find((item) => item.id === jobId)
      : undefined;
    return getSettingsOverridePaths(job?.overrides);
  }

  isSelected(id: string): boolean {
    return this.selectedIds.has(id);
  }

  /**
   * Whether a specific WebP option leaf deviates from the global for a job.
   * The Phase-3 UI wiring is not consuming control ids yet, so compare the
   * effective value against the global.
   */
  isPathOverridden(
    jobId: string | undefined,
    leaf: BulkOverridablePath,
  ): boolean {
    const job = jobId
      ? this.session.jobs.find((item) => item.id === jobId)
      : undefined;
    if (!job?.overrides?.encoderState) return false;
    const globalOptions = webpOptions(this.session.globalSettings);
    const jobOptions = webpOptions(
      getEffectiveSettings(this.session.globalSettings, job.overrides),
    );
    return jobOptions[leaf] !== globalOptions[leaf];
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
    return settingsHash(
      getEffectiveSettings(session.globalSettings, job.overrides),
      getJobSourceDimensions(job) ?? this.#thumbDimensions(job.id),
    );
  }

  #thumbDimensions(jobId: string):
    | {
        width: number;
        height: number;
      }
    | undefined {
    const thumb = this.thumbs.get(jobId);
    if (!thumb) return;
    return {
      width: thumb.w,
      height: thumb.h,
    };
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

  /** Tear down the whole bulk session: cancel, revoke every URL, start fresh. */
  reset(): void {
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

  // ── Output URL ownership ──────────────────────────────────────────────────
  // The engine's processor calls this to mint a download URL for each output;
  // it is revoked via revokeSessionObjectUrls on reset (output.downloadUrl is
  // one of the URLs that helper collects).
  createOutputDownloadUrl(file: File): string {
    return URL.createObjectURL(file);
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
    if (this.thumbs.has(id)) return;
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
    if (this.#globalApplyTimer !== null) {
      clearTimeout(this.#globalApplyTimer);
      this.#globalApplyTimer = null;
    }
    this.runtime.disposeBridges();
    this.#finalizePendingRemoval();
    this.#revokeAll();
  }
}

// Module-level singleton for the client-side bulk surface.
export const bulkStore = new BulkStore();
