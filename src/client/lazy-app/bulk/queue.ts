import type {
  BulkSession,
  ImageJob,
  ImageJobStatus,
  ImageOutput,
} from './session';
import {
  getBulkSessionCounters,
  normalizeBulkSessionCounters,
} from './session';
import { getEffectiveSettings, settingsHash } from './settings';

export const defaultBulkConcurrency = 2;

export interface BulkQueueState {
  concurrency: number;
  activeJobs: number;
  queuedJobs: number;
  openSlots: number;
  runnableJobs: ImageJob[];
}

export interface BulkJobCounterDelta {
  activeJobs: number;
  exportedCount: number;
}

function normalizeBulkConcurrency(concurrency: number): number {
  if (!Number.isFinite(concurrency)) return defaultBulkConcurrency;
  return Math.max(0, Math.floor(concurrency));
}

export function getRunnableJobs(
  session: BulkSession,
  concurrency = defaultBulkConcurrency,
): ImageJob[] {
  const { activeJobs } = getBulkSessionCounters(session.jobs);
  const openSlots = Math.max(
    0,
    normalizeBulkConcurrency(concurrency) - activeJobs,
  );
  if (openSlots === 0) return [];

  return session.jobs
    .filter((job) => job.status === 'queued')
    .slice(0, openSlots);
}

export function getBulkQueueState(
  session: BulkSession,
  concurrency = defaultBulkConcurrency,
): BulkQueueState {
  const normalizedConcurrency = normalizeBulkConcurrency(concurrency);
  const { activeJobs } = getBulkSessionCounters(session.jobs);
  const queuedJobs = session.jobs.filter(
    (job) => job.status === 'queued',
  ).length;
  const openSlots = Math.max(0, normalizedConcurrency - activeJobs);

  return {
    concurrency: normalizedConcurrency,
    activeJobs,
    queuedJobs,
    openSlots,
    runnableJobs: getRunnableJobs(session, normalizedConcurrency),
  };
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

export function getBulkJobCounterDelta(job: ImageJob): BulkJobCounterDelta {
  return {
    activeJobs: isActiveStatus(job.status) ? 1 : 0,
    exportedCount: job.status === 'exported' ? 1 : 0,
  };
}

function applyBulkJobCounterDelta(
  session: BulkSession,
  delta: BulkJobCounterDelta,
): BulkSession {
  return {
    ...session,
    activeJobs: Math.max(0, session.activeJobs - delta.activeJobs),
    exportedCount: Math.max(0, session.exportedCount - delta.exportedCount),
  };
}

export function startJob(session: BulkSession, jobId: string): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  const job = getJob(normalizedSession, jobId);
  if (!job || job.status !== 'queued') return normalizedSession;

  return {
    ...setJobStatus(normalizedSession, jobId, 'processing'),
    activeJobs: normalizedSession.activeJobs + 1,
  };
}

export function completeJob(
  session: BulkSession,
  jobId: string,
  output: ImageOutput,
): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  const job = getJob(normalizedSession, jobId);
  if (!job) return normalizedSession;

  return applyBulkJobCounterDelta(
    updateJob(normalizedSession, jobId, (job) => ({
      ...job,
      status: 'encoded',
      output,
      error: undefined,
    })),
    getBulkJobCounterDelta(job),
  );
}

export function failJob(
  session: BulkSession,
  jobId: string,
  error: string,
): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  const job = getJob(normalizedSession, jobId);
  if (!job) return normalizedSession;

  return applyBulkJobCounterDelta(
    updateJob(normalizedSession, jobId, (job) => ({
      ...job,
      status: 'failed',
      error,
      output: undefined,
    })),
    getBulkJobCounterDelta(job),
  );
}

export function requeueJob(session: BulkSession, jobId: string): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  const job = getJob(normalizedSession, jobId);
  if (!job) return normalizedSession;

  return applyBulkJobCounterDelta(
    updateJob(normalizedSession, jobId, (job) => ({
      ...job,
      status: 'queued',
      output: undefined,
      error: undefined,
    })),
    getBulkJobCounterDelta(job),
  );
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
  const normalizedSession = normalizeBulkSessionCounters(session);
  let requeuedActiveCount = 0;
  let requeuedExportedCount = 0;

  return {
    ...normalizedSession,
    jobs: normalizedSession.jobs.map((job) => {
      if (!job.output || !isJobOutputStale(normalizedSession, job)) return job;
      if (isActiveStatus(job.status)) requeuedActiveCount += 1;
      if (job.status === 'exported') requeuedExportedCount += 1;
      return {
        ...job,
        status: 'queued',
        output: undefined,
        error: undefined,
      };
    }),
    activeJobs: Math.max(0, normalizedSession.activeJobs - requeuedActiveCount),
    exportedCount: Math.max(
      0,
      normalizedSession.exportedCount - requeuedExportedCount,
    ),
  };
}

export function requeueIncompleteJobs(session: BulkSession): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  let requeuedActiveCount = 0;

  return {
    ...normalizedSession,
    jobs: normalizedSession.jobs.map((job) => {
      const shouldRequeue =
        job.status === 'failed' ||
        job.status === 'skipped' ||
        isActiveStatus(job.status);
      if (!shouldRequeue) return job;
      if (isActiveStatus(job.status)) requeuedActiveCount += 1;
      return {
        ...job,
        status: 'queued',
        output: undefined,
        error: undefined,
      };
    }),
    activeJobs: Math.max(0, normalizedSession.activeJobs - requeuedActiveCount),
  };
}

export function cancelActiveJobs(session: BulkSession): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  let canceledActiveCount = 0;

  return {
    ...normalizedSession,
    jobs: normalizedSession.jobs.map((job) => {
      if (!isActiveStatus(job.status)) return job;
      canceledActiveCount += 1;
      return {
        ...job,
        status: 'queued',
        output: undefined,
        error: undefined,
      };
    }),
    activeJobs: Math.max(0, normalizedSession.activeJobs - canceledActiveCount),
  };
}
