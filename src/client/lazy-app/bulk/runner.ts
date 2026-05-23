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
  if (workerBridges.length === 0) {
    throw Error('Bulk runner requires at least one worker bridge');
  }

  const runnableJobs = getRunnableJobs(session, concurrency);
  let nextSession = session;

  for (const job of runnableJobs) {
    nextSession = startJob(nextSession, job.id);
  }

  await Promise.all(
    runnableJobs.map(async (job, index) => {
      const workerBridge = workerBridges[index % workerBridges.length];
      try {
        const output = await processJob(job, workerBridge);
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
