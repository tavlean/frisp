// Bulk processing driver for the lab.
//
// Wraps the framework-neutral engine (start/complete/fail reducers + the
// headless `processBulkImageJob` from the diagnostics probe) in a small
// stateful runner the reactive store drives. Two PERSISTENT worker bridges are
// created (never shared across concurrent jobs — the per-side-bridge pattern
// from EditorSession), and one AbortController scopes each run so cancel() tears
// down cleanly. Every state transition reassigns `store.session` so the UI shows
// queued -> processing -> encoded live, exactly the way the probe reassigns.

import { isAbortError } from 'client/lazy-app/abort';
import type { ImagePipelineWorkerBridge } from 'client/lazy-app/image-pipeline';
import {
  completeJob,
  failJob,
  getRunnableJobs,
  startJob,
  cancelActiveJobs,
  defaultBulkConcurrency,
  processBulkImageJob,
  type ImageJob,
  type ImageOutput,
} from 'client/lazy-app/bulk';
import SvelteKitWorkerBridge from '$lib/sveltekit-worker-bridge';
import type { LabBulk } from './store.svelte';

/**
 * The subset of LabBulk the runtime touches. Declared structurally so store and
 * runtime don't import each other's concrete types in a cycle at runtime.
 */
export interface LabRunnerHost {
  session: LabBulk['session'];
  createOutputDownloadUrl(file: File): string;
  processingGlobalSettingsForJob?(
    job: ImageJob,
  ): LabBulk['session']['globalSettings'];
  cachedOutputFor?(job: ImageJob): ImageOutput | undefined;
  rememberOutput?(jobId: string, output: ImageOutput): void;
  settingsHashForJob?(job: ImageJob): string;
}

export class LabRuntime {
  // Two long-lived bridges. Created lazily on the first run and reused for the
  // session's lifetime (warm worker: WASM instantiated, pthread pool spawned).
  #bridges: [SvelteKitWorkerBridge | null, SvelteKitWorkerBridge | null] = [
    null,
    null,
  ];
  // Scopes the currently-running loop; replaced per run(), aborted by cancel().
  #controller: AbortController | null = null;
  // Guards against two overlapping run() loops (e.g. import kicks a run while
  // one is already draining the queue).
  #running = false;
  // If a settings change queues work while a run is already active, remember
  // that the drain must check once more before it goes idle.
  #rerunRequested = false;

  /** The persistent bridge for a round-robin slot, created on first use. */
  #bridgeFor(slot: 0 | 1): ImagePipelineWorkerBridge {
    const bridge = (this.#bridges[slot] ??= new SvelteKitWorkerBridge());
    return bridge as unknown as ImagePipelineWorkerBridge;
  }

  /** True while a run() loop is draining the queue. */
  get isRunning(): boolean {
    return this.#running;
  }

  /**
   * Drain the queue: while runnable jobs exist (concurrency 2), start each,
   * process it on a round-robin bridge, and complete/fail it — reassigning
   * `host.session` on EVERY transition. Idempotent while already running (a
   * second call returns immediately; the live loop keeps picking up jobs the
   * caller may have just queued).
   */
  async run(host: LabRunnerHost): Promise<void> {
    if (this.#running) {
      this.#rerunRequested = true;
      return;
    }
    this.#running = true;
    const controller = new AbortController();
    this.#controller = controller;
    const { signal } = controller;

    try {
      // Re-read runnable jobs each pass: settings changes requeue stale jobs
      // mid-drain, and completed jobs free slots for still-queued ones.
      while (!signal.aborted) {
        this.#rerunRequested = false;
        const runnable = getRunnableJobs(host.session, defaultBulkConcurrency);
        if (runnable.length === 0) {
          if (!this.#rerunRequested) break;
          continue;
        }

        // Mark this batch started up-front so the freed-slot math in the next
        // getRunnableJobs pass accounts for them (mirrors the engine runner).
        for (const job of runnable) {
          host.session = startJob(host.session, job.id);
        }

        await Promise.all(
          runnable.map((job, index) =>
            this.#processOne(host, job, (index % 2) as 0 | 1, signal),
          ),
        );
      }
    } finally {
      if (this.#controller === controller) this.#controller = null;
      this.#running = false;
    }
  }

  async #processOne(
    host: LabRunnerHost,
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
        host.settingsHashForJob?.(job) ?? job.output?.settingsHash;
      const output: ImageOutput = await processBulkImageJob({
        job,
        globalSettings:
          host.processingGlobalSettingsForJob?.(job) ??
          host.session.globalSettings,
        workerBridge: this.#bridgeFor(slot),
        signal,
        createDownloadUrl: (file) => host.createOutputDownloadUrl(file),
      });
      if (signal.aborted) return;
      const completedOutput = {
        ...output,
        settingsHash: canonicalSettingsHash ?? output.settingsHash,
      };
      host.session = completeJob(host.session, job.id, completedOutput);
      host.rememberOutput?.(job.id, completedOutput);
    } catch (error) {
      // An abort is a clean cancel, not a job failure: leave the reducer to
      // cancelActiveJobs() (called from cancel()) so the job returns to queued.
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
  cancelProcessing(host: LabRunnerHost): void {
    this.#controller?.abort();
    this.#controller = null;
    host.session = cancelActiveJobs(host.session);
  }

  /** Alias for {@link cancelProcessing} (kept for API compatibility). */
  cancel(host: LabRunnerHost): void {
    this.cancelProcessing(host);
  }

  /** Terminate the workers. Call on teardown / full reset of the lab. */
  disposeBridges(): void {
    this.#controller?.abort();
    this.#controller = null;
    this.#running = false;
    this.#rerunRequested = false;
    for (const bridge of this.#bridges) bridge?.dispose();
    this.#bridges = [null, null];
  }

  /** Alias for {@link disposeBridges} (kept for API compatibility). */
  dispose(): void {
    this.disposeBridges();
  }
}
