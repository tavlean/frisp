import type {
  BulkSession,
  ImageJob,
  ImageJobStatus,
  ImageOutput,
} from './session';
import { getEffectiveSettings, settingsHash } from './settings';

export const defaultBulkConcurrency = 2;

function normalizeBulkConcurrency(concurrency: number): number {
  if (!Number.isFinite(concurrency)) return defaultBulkConcurrency;
  return Math.max(0, Math.floor(concurrency));
}

export function getRunnableJobs(
  session: BulkSession,
  concurrency = defaultBulkConcurrency,
): ImageJob[] {
  const openSlots = Math.max(
    0,
    normalizeBulkConcurrency(concurrency) - session.activeJobs,
  );
  if (openSlots === 0) return [];

  return session.jobs
    .filter((job) => job.status === 'queued')
    .slice(0, openSlots);
}

export function updateJob(
  session: BulkSession,
  jobId: string,
  update: (job: ImageJob) => ImageJob,
): BulkSession {
  return {
    ...session,
    jobs: session.jobs.map((job) => (job.id === jobId ? update(job) : job)),
  };
}

export function setJobStatus(
  session: BulkSession,
  jobId: string,
  status: ImageJobStatus,
): BulkSession {
  return updateJob(session, jobId, (job) => ({ ...job, status }));
}

function getJob(session: BulkSession, jobId: string): ImageJob | undefined {
  return session.jobs.find((job) => job.id === jobId);
}

function isActiveStatus(status: ImageJobStatus): boolean {
  return status === 'decoding' || status === 'processing';
}

export function startJob(session: BulkSession, jobId: string): BulkSession {
  const job = getJob(session, jobId);
  if (!job || job.status !== 'queued') return session;

  return {
    ...setJobStatus(session, jobId, 'processing'),
    activeJobs: session.activeJobs + 1,
  };
}

export function completeJob(
  session: BulkSession,
  jobId: string,
  output: ImageOutput,
): BulkSession {
  const job = getJob(session, jobId);
  if (!job) return session;
  const activeJobDelta = isActiveStatus(job.status) ? 1 : 0;
  const exportedJobDelta = job.status === 'exported' ? 1 : 0;

  return {
    ...updateJob(session, jobId, (job) => ({
      ...job,
      status: 'encoded',
      output,
      error: undefined,
    })),
    activeJobs: Math.max(0, session.activeJobs - activeJobDelta),
    exportedCount: Math.max(0, session.exportedCount - exportedJobDelta),
  };
}

export function failJob(
  session: BulkSession,
  jobId: string,
  error: string,
): BulkSession {
  const job = getJob(session, jobId);
  if (!job) return session;
  const activeJobDelta = isActiveStatus(job.status) ? 1 : 0;
  const exportedJobDelta = job.status === 'exported' ? 1 : 0;

  return {
    ...updateJob(session, jobId, (job) => ({
      ...job,
      status: 'failed',
      error,
      output: undefined,
    })),
    activeJobs: Math.max(0, session.activeJobs - activeJobDelta),
    exportedCount: Math.max(0, session.exportedCount - exportedJobDelta),
  };
}

export function requeueJob(session: BulkSession, jobId: string): BulkSession {
  const job = getJob(session, jobId);
  if (!job) return session;
  const activeJobDelta = isActiveStatus(job.status) ? 1 : 0;
  const exportedJobDelta = job.status === 'exported' ? 1 : 0;

  return {
    ...updateJob(session, jobId, (job) => ({
      ...job,
      status: 'queued',
      output: undefined,
      error: undefined,
    })),
    activeJobs: Math.max(0, session.activeJobs - activeJobDelta),
    exportedCount: Math.max(0, session.exportedCount - exportedJobDelta),
  };
}

export function isJobOutputStale(session: BulkSession, job: ImageJob): boolean {
  if (!job.output) return true;
  const effectiveSettings = getEffectiveSettings(
    session.globalSettings,
    job.overrides,
  );
  return job.output.settingsHash !== settingsHash(effectiveSettings);
}

export function requeueStaleJobs(session: BulkSession): BulkSession {
  let requeuedActiveCount = 0;
  let requeuedExportedCount = 0;

  return {
    ...session,
    jobs: session.jobs.map((job) => {
      if (!job.output || !isJobOutputStale(session, job)) return job;
      if (isActiveStatus(job.status)) requeuedActiveCount += 1;
      if (job.status === 'exported') requeuedExportedCount += 1;
      return {
        ...job,
        status: 'queued',
        output: undefined,
        error: undefined,
      };
    }),
    activeJobs: Math.max(0, session.activeJobs - requeuedActiveCount),
    exportedCount: Math.max(0, session.exportedCount - requeuedExportedCount),
  };
}

export function requeueIncompleteJobs(session: BulkSession): BulkSession {
  return {
    ...session,
    jobs: session.jobs.map((job) => {
      if (job.status !== 'failed' && job.status !== 'skipped') return job;
      return {
        ...job,
        status: 'queued',
        error: undefined,
      };
    }),
  };
}
