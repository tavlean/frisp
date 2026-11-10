// Bulk processing driver for the production bulk store.
//
// Wraps the framework-neutral engine's start/complete/fail reducers around
// `optimizeImage`, the same operation the editor runs, in a small stateful
// runner the reactive store drives. Two PERSISTENT worker bridges are
// created (never shared across concurrent jobs — the per-side-bridge pattern
// from EditorSession), and one AbortController scopes each run so
// cancelProcessing() tears down cleanly. Every state transition reassigns
// `store.session` so the UI shows queued -> processing -> encoded live,
// exactly the way the probe reassigns.

import { isAbortError } from '#client/lazy-app/abort.ts';
import {
  completeJob,
  effectiveRecipe,
  failJob,
  getPercentChange,
  getRunnableJobs,
  jobRecipeHash,
  startJob,
  cancelActiveJobs,
  defaultBulkConcurrency,
  type ImageJob,
  type ImageOutput,
} from '#client/lazy-app/bulk/index.ts';
import { optimizeImage } from '#lib/optimize-image.ts';
import SvelteKitWorkerBridge from '#lib/sveltekit-worker-bridge.ts';
import type { BulkStore } from './store.svelte';

/**
 * The subset of BulkStore the runtime touches. Declared structurally so store and
 * runtime don't import each other's concrete types in a cycle at runtime.
 */
export interface BulkRunnerHost {
  session: BulkStore['session'];
  cachedOutputFor?(job: ImageJob): ImageOutput | undefined;
  rememberOutput?(jobId: string, output: ImageOutput): void;
  settingsHashForJob?(job: ImageJob): string;
  /** Requeue every job whose output no longer matches its live settings. */
  requeueStale?(): void;
}

/** The concurrent jobs a bulk run drains at once, one per worker slot. */
const SLOTS = 2;

/**
 * OxiPNG threads per bulk worker. Each worker's pool otherwise takes every
 * core, so two concurrent PNG encodes ran twice as many threads as the
 * machine has, contending instead of speeding up. AVIF and JPEG XL size their
 * pools at build time and are not covered.
 */
export function bulkThreadBudget(cores: number, slots: number = SLOTS): number {
  return Math.max(1, Math.floor(cores / slots));
}

export class BulkRuntime {
  // Two long-lived bridges. Created lazily on the first run and reused for the
  // session's lifetime (warm worker: WASM instantiated, pthread pool spawned).
  #bridges: [SvelteKitWorkerBridge | null, SvelteKitWorkerBridge | null] = [
    null,
    null,
  ];
  // Scopes the currently-running loop; replaced per run(), aborted by
  // cancelProcessing().
  #controller: AbortController | null = null;
  // Guards against two overlapping run() loops (e.g. import kicks a run while
  // one is already draining the queue).
  #running = false;
  // If a settings change queues work while a run is already active, remember
  // that the drain must check once more before it goes idle.
  #rerunRequested = false;

  /** The persistent bridge for a round-robin slot, created on first use. */
  #bridgeFor(slot: 0 | 1): SvelteKitWorkerBridge {
    return (this.#bridges[slot] ??= new SvelteKitWorkerBridge({
      threads: bulkThreadBudget(navigator.hardwareConcurrency),
    }));
  }

  /** True while a run() loop is draining the queue. */
  get isRunning(): boolean {
    return this.#running;
  }

  /**
   * Drain the queue with one loop per worker slot: each slot claims a single
   * runnable job, processes it on its own persistent bridge, then immediately
   * claims the next. A slow job in one slot never blocks the other slot from
   * draining newly-opened work. Idempotent while already running (a second call
   * returns immediately and asks the live loop to check once more before idle).
   */
  async run(host: BulkRunnerHost): Promise<void> {
    if (this.#running) {
      this.#rerunRequested = true;
      return;
    }
    this.#running = true;
    const controller = new AbortController();
    this.#controller = controller;
    const { signal } = controller;

    try {
      do {
        this.#rerunRequested = false;
        await Promise.all([
          this.#drainSlot(host, 0, signal),
          this.#drainSlot(host, 1, signal),
        ]);
      } while (!signal.aborted && this.#rerunRequested);
    } finally {
      // Only the current run releases the latch: after cancelProcessing() a
      // newer run may already own it while this aborted loop unwinds.
      if (this.#controller === controller) {
        this.#controller = null;
        this.#running = false;
      }
    }
  }

  async #drainSlot(
    host: BulkRunnerHost,
    slot: 0 | 1,
    signal: AbortSignal,
  ): Promise<void> {
    while (!signal.aborted) {
      const [job] = getRunnableJobs(host.session, defaultBulkConcurrency);
      if (!job) return;
      host.session = startJob(host.session, job.id);
      await this.#processOne(host, job, slot, signal);
    }
  }

  async #processOne(
    host: BulkRunnerHost,
    job: ImageJob,
    slot: 0 | 1,
    signal: AbortSignal,
  ): Promise<void> {
    try {
      if (signal.aborted) return;
      const cached = host.cachedOutputFor?.(job);
      if (cached) {
        host.session = completeJob(host.session, job.id, cached);
        return;
      }

      const canonicalSettingsHash =
        host.settingsHashForJob?.(job) ?? jobRecipeHash(host.session, job);
      const recipe = effectiveRecipe(host.session, job);
      // The slot's worker decodes the file itself and keeps it only until
      // the slot moves on to another file.
      const outcome = await optimizeImage({ file: job.sourceFile }, recipe, {
        signal,
        bridge: this.#bridgeFor(slot),
        preview: false,
      });
      // The outcome's URL becomes the output's download URL, so the store's
      // existing revoke paths own it from here. A cancel that lands after the
      // encode finished leaves no owner, so it is revoked on the spot.
      if (signal.aborted) {
        URL.revokeObjectURL(outcome.outputUrl);
        return;
      }
      // Only the file and its facts are kept: bulk never holds output pixels
      // (the SVG lane renders previews regardless of `preview`).
      const completedOutput: ImageOutput = {
        file: outcome.outputFile,
        size: outcome.outputSize,
        downloadUrl: outcome.outputUrl,
        percentChange: getPercentChange(job.originalSize, outcome.outputSize),
        settingsHash: canonicalSettingsHash,
      };
      host.session = completeJob(host.session, job.id, completedOutput);
      host.rememberOutput?.(job.id, completedOutput);
      // Settings can change while a job is in flight, and the store's
      // settings pass leaves an active job with no output alone. Recheck
      // against the live recipe now, so a job never settles under settings
      // the user has already replaced.
      const settled = host.session.jobs.find((item) => item.id === job.id);
      if (
        settled &&
        host.settingsHashForJob &&
        host.settingsHashForJob(settled) !== completedOutput.settingsHash
      ) {
        host.requeueStale?.();
      }
    } catch (error) {
      // An abort is a clean cancel, not a job failure: leave the reducer to
      // cancelActiveJobs() (called from cancelProcessing()) so the job returns
      // to queued.
      if (isAbortError(error) || signal.aborted) return;
      host.session = failJob(
        host.session,
        job.id,
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  /**
   * Abort the in-flight run and return every active job to the queue. Safe to
   * call when idle. Bridges are kept warm for the next run.
   */
  cancelProcessing(host: BulkRunnerHost): void {
    this.#controller?.abort();
    this.#controller = null;
    // Release the latch now rather than when the aborted loop unwinds, so a
    // run() requested right after the cancel starts a fresh drain instead of
    // flagging a rerun the aborted loop will never honor.
    this.#running = false;
    this.#rerunRequested = false;
    host.session = cancelActiveJobs(host.session);
  }

  /** Terminate the workers. Call on teardown / full reset of bulk mode. */
  disposeBridges(): void {
    this.#controller?.abort();
    this.#controller = null;
    this.#running = false;
    this.#rerunRequested = false;
    for (const bridge of this.#bridges) bridge?.dispose();
    this.#bridges = [null, null];
  }
}
