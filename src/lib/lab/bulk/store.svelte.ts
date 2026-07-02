// Reactive store for the Bulk UI lab — the thin Svelte 5 layer over the
// framework-neutral bulk engine.
//
// The engine is IMMUTABLE: every reducer returns a NEW BulkSession, so the
// store holds it in `$state.raw` and REASSIGNS on each action (coarse
// reactivity is fine — the lab caps at ~30 images). View-models are derived via
// the engine's own selectors, so the components never reach into the session
// shape directly. Thumbnails + natural dimensions live in a SvelteMap keyed by
// job id, decoded lazily off the source File. Object URLs (thumbnails AND
// engine output download URLs) are revoked on remove/reset.
//
// The two layout variants (L1 focus-first, L2 grid) are built on top of this
// store. The store + runtime are the shared scaffold; the focused image itself
// is rendered by a real EditorSession in the route.

import { SvelteMap } from 'svelte/reactivity';
import {
  getDefaultOptions,
  OUTPUT_FORMATS,
  type SideFormat,
} from '$lib/compress';
import type { SideState } from '$lib/editor/editor-session.svelte';
import {
  addBulkImportToSession,
  applyClearJobOverrides,
  applyGlobalSettings,
  applyJobOverrides,
  createBulkSessionFromImport,
  createImageJobs,
  getBulkSelectedJobDetail,
  getBulkSessionSummary,
  getBulkStripItems,
  getEffectiveSettings,
  getSelectedJob,
  getSettingsOverridePaths,
  revokeSessionObjectUrls,
  selectJob,
  selectNextJob,
  selectPreviousJob,
  type BulkImageOverrides,
  type BulkImageSettings,
  type BulkSelectedJobDetail,
  type BulkSession,
  type BulkSessionSummary,
  type BulkStripItem,
  type ImageJob,
} from 'client/lazy-app/bulk';
import {
  defaultProcessorState,
  encoderMap,
  type EncoderState,
  type EncoderType,
} from 'client/lazy-app/feature-meta';
// The lab is WebP-locked, so use the CONCRETE WebP option type (which has
// `quality`/`method`) rather than the wide `EncoderOptions` union (whose members
// share no common keys — it can't be indexed by encoder-specific fields, and
// `encoderState.options` for `type:'webP'` wants exactly this type).
import type { EncodeOptions as WebpEncodeOptions } from 'features/encoders/webP/shared/meta';
import { toast } from './Toast.svelte';
import { LabRuntime } from './runtime';

/** Thumbnail + natural (source) dimensions for one job. */
export interface LabThumb {
  /** Object URL of the downscaled thumbnail (owned by the store; revoked). */
  url: string;
  /** Natural (decoded) source width in pixels. */
  w: number;
  /** Natural (decoded) source height in pixels. */
  h: number;
}

export type LabVariant = 'l1' | 'l2';

/** The two overridable WebP option leaves the lab exposes as controls. */
export type LabOverridablePath = 'quality' | 'method';

/** Longest edge of the generated thumbnail canvas. */
const THUMB_MAX = 320;

let sessionCounter = 0;

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

export function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b);
}

/** WebP defaults from the codec meta — the lab's locked global format. */
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
    `lab-bulk-${sessionCounter}`,
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
    // Format/encoder override is a single leaf; dropping the path drops it.
    const { encoderState: _dropped, ...rest } = overrides;
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

export class LabBulk {
  // The immutable engine session; reassigned on every reducer call.
  session = $state.raw<BulkSession>(emptySession());
  // Which layout variant the lab is showing (bound to the top-bar toggle).
  variant = $state<LabVariant>('l1');
  // Production OptionsPanel-compatible pseudo-side for GLOBAL bulk settings.
  globalSide = $state<SideState>(sideFromSettings(this.session.globalSettings));

  // Thumbnails + natural dims, keyed by job id. SvelteMap entries are replaced
  // (never deeply mutated) so its shallow reactivity is sufficient.
  readonly thumbs = new SvelteMap<string, LabThumb>();

  // The processing driver (two persistent bridges + abort control).
  readonly runtime = new LabRuntime();

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
  readonly selectedThumb = $derived<LabThumb | undefined>(
    this.selectedId ? this.thumbs.get(this.selectedId) : undefined,
  );
  readonly selectedFile = $derived<File | undefined>(
    this.selectedJob?.sourceFile,
  );
  readonly selectedHasOverrides = $derived(
    this.overridePaths(this.selectedId).length > 0,
  );
  readonly hasJobs = $derived(this.session.jobs.length > 0);
  /** True while any job is decoding/processing (or the runtime loop is live). */
  readonly processing = $derived(
    this.summary.progress.active > 0 || this.summary.actions.hasActiveJobs,
  );

  // ── Actions ───────────────────────────────────────────────────────────────
  #syncingGlobalSide = false;
  #globalApplyTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Import Files into the session, decode thumbnails, auto-select the first job
   * (the engine's addJobs does this when nothing is selected), and kick
   * processing. Files that aren't images are dropped by the import filter.
   */
  async importFiles(files: File[]): Promise<void> {
    if (files.length === 0) return;

    const result = createImageJobs(files);
    // addBulkImportToSession keeps existing jobs; auto-selects first if none.
    this.session = addBulkImportToSession(this.session, result);

    // Decode thumbnails for the newly accepted jobs (fire-and-forget each).
    for (const job of result.accepted) {
      void this.#ensureThumb(job.id, job.sourceFile);
    }

    void this.runtime.run(this);
  }

  select(id: string): void {
    this.session = selectJob(this.session, id);
  }

  selectNext(): void {
    this.session = selectNextJob(this.session);
  }

  selectPrevious(): void {
    this.session = selectPreviousJob(this.session);
  }

  /**
   * Update GLOBAL WebP encode options (merged onto the current global options).
   * Routes through applyGlobalSettings so non-overridden stale jobs requeue,
   * then kicks a run to re-encode them.
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
    this.session = applyGlobalSettings(this.session, nextSettings);
    void this.runtime.run(this);
  }

  /**
   * Override WebP options for the SELECTED job. The engine merges `encoderState`
   * WHOLESALE (not deep), so the override must carry the FULL option object:
   * we start from the job's effective options and layer the changed keys on top.
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
    this.session = applyJobOverrides(this.session, id, overrides);
    void this.runtime.run(this);
  }

  /**
   * Clear ONE overridden leaf on a job (the per-control reset affordance). For
   * the WebP option leaves (quality/method) there is no granular engine path —
   * `getSettingsOverridePaths` reports the whole `encoderState` — so resetting
   * one option means recomputing the encoder override from the global with only
   * the OTHER overridden options kept, and dropping it entirely if that leaves
   * nothing deviating from the global.
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

    this.session = applyJobOverrides(this.session, id, next);
    void this.runtime.run(this);
  }

  /**
   * Recompute a job's encoder override with ONE WebP option leaf reset back to
   * the global value; drop the whole encoderState override if nothing deviates.
   */
  #clearEncoderOption(
    job: ImageJob,
    leaf: LabOverridablePath,
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
    this.session = applyClearJobOverrides(this.session, id);
    void this.runtime.run(this);
  }

  applySelectedOverrides(overrides: BulkImageOverrides): void {
    const id = this.session.selectedJobId;
    if (!id) return;

    this.session = applyJobOverrides(this.session, id, overrides);
    void this.runtime.run(this);
  }

  clearSelectedOverrides(): void {
    const id = this.session.selectedJobId;
    if (!id) return;

    this.session = applyClearJobOverrides(this.session, id);
    void this.runtime.run(this);
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
      };

      if (deepEqual(nextSettings, this.session.globalSettings)) return;

      this.session = applyGlobalSettings(this.session, nextSettings);
      void this.runtime.run(this);
      onApplied?.();
    }, 150);
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

  /** All overridden dotted paths for a job (for the corner dot / tooltip). */
  overridePaths(jobId: string | undefined): string[] {
    const job = jobId
      ? this.session.jobs.find((item) => item.id === jobId)
      : undefined;
    return getSettingsOverridePaths(job?.overrides);
  }

  /**
   * Whether a specific WebP option leaf deviates from the global for a job.
   * Encoder overrides are stored wholesale, so `getSettingsOverridePaths` can't
   * answer this per-leaf; compare the effective value against the global.
   */
  isPathOverridden(
    jobId: string | undefined,
    leaf: LabOverridablePath,
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

  /** Cancel any in-flight processing (returns active jobs to the queue). */
  cancelProcessing(): void {
    this.runtime.cancelProcessing(this);
  }

  /** Tear down the whole lab: cancel, revoke every URL, start fresh. */
  resetLab(): void {
    this.runtime.cancelProcessing(this);
    this.#revokeAll();
    this.session = emptySession();
    this.refreshGlobalSideFromSession();
  }

  /** Phase-2 placeholder for ZIP export (the scaffold has no archiver yet). */
  saveAllStub(): void {
    toast('ZIP export lands in Phase 2');
  }

  // ── Output URL ownership ──────────────────────────────────────────────────
  // The engine's processor calls this to mint a download URL for each output;
  // it is revoked via revokeSessionObjectUrls on reset (output.downloadUrl is
  // one of the URLs that helper collects).
  createOutputDownloadUrl(file: File): string {
    return URL.createObjectURL(file);
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
      this.thumbs.set(id, {
        url: URL.createObjectURL(blob),
        w: natW,
        h: natH,
      });
    } catch {
      // Undecodable source: leave the strip/grid to show a placeholder.
    } finally {
      bitmap?.close();
    }
  }

  /** Revoke every thumbnail URL and every engine-owned output/preview URL. */
  #revokeAll(): void {
    for (const thumb of this.thumbs.values()) URL.revokeObjectURL(thumb.url);
    this.thumbs.clear();
    revokeSessionObjectUrls(this.session);
  }

  /** Full teardown (workers + URLs). Call from the route's onMount cleanup. */
  dispose(): void {
    if (this.#globalApplyTimer !== null) {
      clearTimeout(this.#globalApplyTimer);
      this.#globalApplyTimer = null;
    }
    this.runtime.disposeBridges();
    this.#revokeAll();
  }
}

// Module-level singleton: the lab is a client-only dev route with no SSR of
// user data, so a shared instance is fine (per Svelte's module-state guidance).
export const labBulk = new LabBulk();
