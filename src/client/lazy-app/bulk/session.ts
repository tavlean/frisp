import type { BulkImageOverrides, BulkImageSettings } from './settings';

export type ImageJobStatus =
  | 'queued'
  | 'decoding'
  | 'processing'
  | 'encoded'
  | 'failed'
  | 'skipped'
  | 'exported';

export interface ImageOutput {
  file: File;
  size: number;
  downloadUrl: string;
  percentChange: number;
  settingsHash: string;
}

export interface ImageJob {
  id: string;
  sourceFile: File;
  status: ImageJobStatus;
  originalSize: number;
  previewUrl?: string;
  thumbnailUrl?: string;
  output?: ImageOutput;
  overrides?: BulkImageOverrides;
  error?: string;
}

export interface BulkSession {
  id: string;
  globalSettings: BulkImageSettings;
  jobs: ImageJob[];
  selectedJobId?: string;
  activeJobs: number;
  exportedCount: number;
}

export interface BatchProgress {
  total: number;
  queued: number;
  active: number;
  completed: number;
  failed: number;
  skipped: number;
  exported: number;
}

export function createBulkSession(
  id: string,
  globalSettings: BulkImageSettings,
  jobs: ImageJob[] = [],
): BulkSession {
  return {
    id,
    globalSettings,
    jobs,
    selectedJobId: jobs[0]?.id,
    activeJobs: jobs.filter(isActiveJob).length,
    exportedCount: jobs.filter((job) => job.status === 'exported').length,
  };
}

export function createImageJob(id: string, sourceFile: File): ImageJob {
  return {
    id,
    sourceFile,
    status: 'queued',
    originalSize: sourceFile.size,
  };
}

function createUniqueJobId(jobId: string, usedJobIds: Set<string>): string {
  if (!usedJobIds.has(jobId)) {
    usedJobIds.add(jobId);
    return jobId;
  }

  let suffix = 2;
  let nextJobId = `${jobId}-${suffix}`;
  while (usedJobIds.has(nextJobId)) {
    suffix += 1;
    nextJobId = `${jobId}-${suffix}`;
  }
  usedJobIds.add(nextJobId);
  return nextJobId;
}

export function addJobs(session: BulkSession, jobs: ImageJob[]): BulkSession {
  const usedJobIds = new Set(session.jobs.map((job) => job.id));
  const newJobs = jobs.map((job) => ({
    ...job,
    id: createUniqueJobId(job.id, usedJobIds),
  }));
  const nextJobs = [...session.jobs, ...newJobs];
  return {
    ...session,
    jobs: nextJobs,
    selectedJobId: session.selectedJobId ?? nextJobs[0]?.id,
  };
}

function isActiveJob(job: ImageJob): boolean {
  return job.status === 'decoding' || job.status === 'processing';
}

export function removeJobs(
  session: BulkSession,
  jobIds: Iterable<string>,
): BulkSession {
  const removedJobIds = new Set(jobIds);
  const nextJobs = session.jobs.filter((job) => !removedJobIds.has(job.id));
  const removedActiveCount = session.jobs.filter(
    (job) => removedJobIds.has(job.id) && isActiveJob(job),
  ).length;
  const removedExportedCount = session.jobs.filter(
    (job) => removedJobIds.has(job.id) && job.status === 'exported',
  ).length;
  const selectedJobId = nextJobs.some((job) => job.id === session.selectedJobId)
    ? session.selectedJobId
    : nextJobs[0]?.id;

  return {
    ...session,
    jobs: nextJobs,
    selectedJobId,
    activeJobs: Math.max(0, session.activeJobs - removedActiveCount),
    exportedCount: Math.max(0, session.exportedCount - removedExportedCount),
  };
}

export function selectJob(
  session: BulkSession,
  selectedJobId: string,
): BulkSession {
  if (!session.jobs.some((job) => job.id === selectedJobId)) return session;
  return {
    ...session,
    selectedJobId,
  };
}

export function updateGlobalSettings(
  session: BulkSession,
  globalSettings: BulkImageSettings,
): BulkSession {
  return {
    ...session,
    globalSettings,
  };
}

export function updateJobOverrides(
  session: BulkSession,
  jobId: string,
  overrides: BulkImageOverrides,
): BulkSession {
  return {
    ...session,
    jobs: session.jobs.map((job) =>
      job.id === jobId ? { ...job, overrides } : job,
    ),
  };
}

export function clearJobOverrides(
  session: BulkSession,
  jobId: string,
): BulkSession {
  return {
    ...session,
    jobs: session.jobs.map((job) =>
      job.id === jobId ? { ...job, overrides: undefined } : job,
    ),
  };
}

export function markJobsExported(
  session: BulkSession,
  jobIds: Iterable<string>,
): BulkSession {
  const exportedJobIds = new Set(jobIds);
  let newlyExportedCount = 0;

  return {
    ...session,
    jobs: session.jobs.map((job) => {
      if (!exportedJobIds.has(job.id) || job.status !== 'encoded') return job;
      newlyExportedCount += 1;
      return {
        ...job,
        status: 'exported',
      };
    }),
    exportedCount: session.exportedCount + newlyExportedCount,
  };
}

export function getSelectedJob(session: BulkSession): ImageJob | undefined {
  if (!session.selectedJobId) return;
  return session.jobs.find((job) => job.id === session.selectedJobId);
}

export function getBatchProgress(session: BulkSession): {
  total: number;
  completed: number;
  failed: number;
} {
  const progress = getDetailedBatchProgress(session);
  return {
    total: progress.total,
    completed: progress.completed,
    failed: progress.failed,
  };
}

export function getDetailedBatchProgress(session: BulkSession): BatchProgress {
  let queued = 0;
  let active = 0;
  let completed = 0;
  let failed = 0;
  let skipped = 0;
  let exported = 0;

  for (const job of session.jobs) {
    if (job.status === 'queued') queued += 1;
    else if (job.status === 'decoding' || job.status === 'processing') {
      active += 1;
    } else if (job.status === 'encoded') completed += 1;
    else if (job.status === 'exported') {
      completed += 1;
      exported += 1;
    } else if (job.status === 'failed') failed += 1;
    else if (job.status === 'skipped') skipped += 1;
  }

  return {
    total: session.jobs.length,
    queued,
    active,
    completed,
    failed,
    skipped,
    exported,
  };
}
