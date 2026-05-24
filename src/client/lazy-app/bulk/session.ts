import { getEffectiveSettings, hasSettingsOverrides } from './settings';
import type { BulkImageOverrides, BulkImageSettings } from './settings';

export type ImageJobStatus =
  | 'queued'
  | 'decoding'
  | 'processing'
  | 'encoded'
  | 'failed'
  | 'skipped'
  | 'exported';

export type ImageJobStatusGroup =
  | 'pending'
  | 'active'
  | 'complete'
  | 'failed'
  | 'skipped';

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

export interface OverrideSummary {
  overridden: number;
  total: number;
}

export interface BulkActionState {
  hasActiveJobs: boolean;
  hasRetryableJobs: boolean;
  hasIncompleteJobs: boolean;
}

export interface SelectedJobContext {
  job?: ImageJob;
  index: number;
  total: number;
  canSelectPrevious: boolean;
  canSelectNext: boolean;
}

export function getJobStatusGroup(status: ImageJobStatus): ImageJobStatusGroup {
  if (status === 'queued') return 'pending';
  if (isActiveStatus(status)) return 'active';
  if (status === 'encoded' || status === 'exported') return 'complete';
  if (status === 'failed') return 'failed';
  return 'skipped';
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
    activeJobs: jobs.filter((job) => getJobStatusGroup(job.status) === 'active')
      .length,
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
  const addedActiveCount = newJobs.filter(isActiveJob).length;
  const addedExportedCount = newJobs.filter(
    (job) => job.status === 'exported',
  ).length;

  return {
    ...session,
    jobs: nextJobs,
    selectedJobId: session.selectedJobId ?? nextJobs[0]?.id,
    activeJobs: session.activeJobs + addedActiveCount,
    exportedCount: session.exportedCount + addedExportedCount,
  };
}

function isActiveStatus(status: ImageJobStatus): boolean {
  return status === 'decoding' || status === 'processing';
}

function isActiveJob(job: ImageJob): boolean {
  return isActiveStatus(job.status);
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

export function selectNextJob(session: BulkSession): BulkSession {
  if (session.jobs.length === 0) return session;
  const currentIndex = session.jobs.findIndex(
    (job) => job.id === session.selectedJobId,
  );
  const nextIndex =
    currentIndex === -1
      ? 0
      : Math.min(session.jobs.length - 1, currentIndex + 1);
  return selectJob(session, session.jobs[nextIndex].id);
}

export function selectPreviousJob(session: BulkSession): BulkSession {
  if (session.jobs.length === 0) return session;
  const currentIndex = session.jobs.findIndex(
    (job) => job.id === session.selectedJobId,
  );
  const nextIndex = currentIndex === -1 ? 0 : Math.max(0, currentIndex - 1);
  return selectJob(session, session.jobs[nextIndex].id);
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
  const normalizedOverrides = hasSettingsOverrides(overrides)
    ? overrides
    : undefined;

  return {
    ...session,
    jobs: session.jobs.map((job) =>
      job.id === jobId ? { ...job, overrides: normalizedOverrides } : job,
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

export function getJobEffectiveSettings(
  session: BulkSession,
  jobId: string,
): BulkImageSettings | undefined {
  const job = session.jobs.find((item) => item.id === jobId);
  if (!job) return;
  return getEffectiveSettings(session.globalSettings, job.overrides);
}

export function getSelectedJobContext(
  session: BulkSession,
): SelectedJobContext {
  const index = session.jobs.findIndex(
    (job) => job.id === session.selectedJobId,
  );
  const job = index === -1 ? undefined : session.jobs[index];

  return {
    job,
    index,
    total: session.jobs.length,
    canSelectPrevious: index > 0,
    canSelectNext: index !== -1 && index < session.jobs.length - 1,
  };
}

export function getOverriddenJobs(session: BulkSession): ImageJob[] {
  return session.jobs.filter((job) => hasSettingsOverrides(job.overrides));
}

export function getOverrideSummary(session: BulkSession): OverrideSummary {
  return {
    overridden: getOverriddenJobs(session).length,
    total: session.jobs.length,
  };
}

export function getBulkActionState(session: BulkSession): BulkActionState {
  let hasActiveJobs = false;
  let hasRetryableJobs = false;
  let hasIncompleteJobs = false;

  for (const job of session.jobs) {
    const group = getJobStatusGroup(job.status);
    if (group === 'active') hasActiveJobs = true;
    if (group === 'failed' || group === 'skipped') hasRetryableJobs = true;
    if (group !== 'complete') hasIncompleteJobs = true;
  }

  return {
    hasActiveJobs,
    hasRetryableJobs,
    hasIncompleteJobs,
  };
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
    const group = getJobStatusGroup(job.status);
    if (group === 'pending') queued += 1;
    else if (group === 'active') {
      active += 1;
    } else if (group === 'complete') {
      completed += 1;
      if (job.status === 'exported') exported += 1;
    } else if (group === 'failed') failed += 1;
    else if (group === 'skipped') skipped += 1;
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
