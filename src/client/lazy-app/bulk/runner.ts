import type WorkerBridge from '../worker-bridge';
import type { BulkSession, ImageJob, ImageOutput } from './session';
import { completeJob, failJob, getRunnableJobs, startJob } from './queue';
import { processBulkImageJob } from './processor';

export interface BulkRunnerOptions {
  signal: AbortSignal;
  workerBridges: WorkerBridge[];
  concurrency?: number;
  processJob?: (
    job: ImageJob,
    workerBridge: WorkerBridge,
  ) => Promise<ImageOutput>;
}

function createAbortError(signal: AbortSignal): Error {
  const reason = (signal as AbortSignal & { reason?: unknown }).reason;
  if (reason instanceof Error) return reason;

  const error = Error('Bulk processing aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw createAbortError(signal);
}

export async function processRunnableBulkJobs(
  session: BulkSession,
  {
    signal,
    workerBridges,
    concurrency,
    processJob = (job, workerBridge) =>
      processBulkImageJob({
        job,
        globalSettings: session.globalSettings,
        workerBridge,
        signal,
      }),
  }: BulkRunnerOptions,
): Promise<BulkSession> {
  throwIfAborted(signal);

  const runnableJobs = getRunnableJobs(session, concurrency);
  if (runnableJobs.length === 0) return session;

  if (workerBridges.length === 0) {
    throw Error('Bulk runner requires at least one worker bridge');
  }

  let nextSession = session;

  for (const job of runnableJobs) {
    nextSession = startJob(nextSession, job.id);
  }

  await Promise.all(
    runnableJobs.map(async (job, index) => {
      const workerBridge = workerBridges[index % workerBridges.length];
      try {
        throwIfAborted(signal);
        const output = await processJob(job, workerBridge);
        throwIfAborted(signal);
        nextSession = completeJob(nextSession, job.id, output);
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') throw err;
        nextSession = failJob(
          nextSession,
          job.id,
          err instanceof Error ? err.message : String(err),
        );
      }
    }),
  );

  return nextSession;
}

export async function processBulkQueue(
  session: BulkSession,
  options: BulkRunnerOptions,
): Promise<BulkSession> {
  let nextSession = session;

  while (getRunnableJobs(nextSession, options.concurrency).length > 0) {
    nextSession = await processRunnableBulkJobs(nextSession, options);
  }

  return nextSession;
}
