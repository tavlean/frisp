import {
  getEffectiveSettings,
  hasSettingsOverrides,
  normalizeImageOverrides,
  settingsHash,
} from './settings';
import type {
  BulkImageOverrides,
  BulkImageSettings,
  BulkSourceDimensions,
} from './settings';

export type ImageJobStatus =
  | 'queued'
  | 'decoding'
  | 'processing'
  | 'encoded'
  | 'failed'
  | 'skipped'
  | 'exported';

export const imageJobStatuses: readonly ImageJobStatus[] = [
  'queued',
  'decoding',
  'processing',
  'encoded',
  'failed',
  'skipped',
  'exported',
];

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
  relativePath?: string;
  status: ImageJobStatus;
  originalSize: number;
  sourceWidth?: number;
  sourceHeight?: number;
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

export interface BulkSessionCounters {
  activeJobs: number;
  exportedCount: number;
}

export interface OverrideSummary {
  overridden: number;
  total: number;
}

export interface BulkActionState {
  hasActiveJobs: boolean;
  hasQueuedJobs: boolean;
  hasRetryableJobs: boolean;
  hasIncompleteJobs: boolean;
  canProcess: boolean;
  canRetry: boolean;
  canCancel: boolean;
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
  if (isActiveImageJobStatus(status)) return 'active';
  if (status === 'encoded' || status === 'exported') return 'complete';
  if (status === 'failed') return 'failed';
  return 'skipped';
}

export function isActiveImageJobStatus(status: ImageJobStatus): boolean {
  return status === 'decoding' || status === 'processing';
}

export function createBulkSession(
  id: string,
  globalSettings: BulkImageSettings,
  jobs: ImageJob[] = [],
): BulkSession {
  const counters = getBulkSessionCounters(jobs);
  return {
    id,
    globalSettings,
    jobs,
    selectedJobId: jobs[0]?.id,
    ...counters,
  };
}

export function createImageJob(
  id: string,
  sourceFile: File,
  relativePath?: string,
): ImageJob {
  const job: ImageJob = {
    id,
    sourceFile,
    status: 'queued',
    originalSize: sourceFile.size,
  };

  if (relativePath) job.relativePath = relativePath;

  return job;
}

export function getJobSourceDimensions(
  job: ImageJob,
): BulkSourceDimensions | undefined {
  if (
    !Number.isFinite(job.sourceWidth) ||
    !Number.isFinite(job.sourceHeight) ||
    !job.sourceWidth ||
    !job.sourceHeight
  ) {
    return;
  }

  return {
    width: job.sourceWidth,
    height: job.sourceHeight,
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
  const normalizedSession = normalizeBulkSessionCounters(session);
  const usedJobIds = new Set(normalizedSession.jobs.map((job) => job.id));
  const newJobs = jobs.map((job) => ({
    ...job,
    id: createUniqueJobId(job.id, usedJobIds),
  }));
  const nextJobs = [...normalizedSession.jobs, ...newJobs];
  const addedActiveCount = newJobs.filter(isActiveJob).length;
  const addedExportedCount = newJobs.filter(
    (job) => job.status === 'exported',
  ).length;

  return {
    ...normalizedSession,
    jobs: nextJobs,
    selectedJobId: normalizedSession.selectedJobId ?? nextJobs[0]?.id,
    activeJobs: normalizedSession.activeJobs + addedActiveCount,
    exportedCount: normalizedSession.exportedCount + addedExportedCount,
  };
}

function isActiveJob(job: ImageJob): boolean {
  return isActiveImageJobStatus(job.status);
}

export function getBulkSessionCounters(
  jobs: readonly ImageJob[],
): BulkSessionCounters {
  let activeJobs = 0;
  let exportedCount = 0;

  for (const job of jobs) {
    if (isActiveJob(job)) activeJobs += 1;
    if (job.status === 'exported') exportedCount += 1;
  }

  return { activeJobs, exportedCount };
}

export function normalizeBulkSessionCounters(
  session: BulkSession,
): BulkSession {
  const counters = getBulkSessionCounters(session.jobs);
  if (
    counters.activeJobs === session.activeJobs &&
    counters.exportedCount === session.exportedCount
  ) {
    return session;
  }

  return {
    ...session,
    ...counters,
  };
}

export function removeJobs(
  session: BulkSession,
  jobIds: Iterable<string>,
): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  const removedJobIds = new Set(jobIds);
  const nextJobs = normalizedSession.jobs.filter(
    (job) => !removedJobIds.has(job.id),
  );
  const removedActiveCount = normalizedSession.jobs.filter(
    (job) => removedJobIds.has(job.id) && isActiveJob(job),
  ).length;
  const removedExportedCount = normalizedSession.jobs.filter(
    (job) => removedJobIds.has(job.id) && job.status === 'exported',
  ).length;
  const selectedJobId = nextJobs.some(
    (job) => job.id === normalizedSession.selectedJobId,
  )
    ? normalizedSession.selectedJobId
    : nextJobs[0]?.id;

  return {
    ...normalizedSession,
    jobs: nextJobs,
    selectedJobId,
    activeJobs: Math.max(0, normalizedSession.activeJobs - removedActiveCount),
    exportedCount: Math.max(
      0,
      normalizedSession.exportedCount - removedExportedCount,
    ),
  };
}

/** Re-insert a previously removed job at (clamped) index. Undo for removal. */
export function restoreJob(
  session: BulkSession,
  job: ImageJob,
  index: number,
): BulkSession {
  if (session.jobs.some((existing) => existing.id === job.id)) return session;
  const jobs = [...session.jobs];
  jobs.splice(Math.max(0, Math.min(index, jobs.length)), 0, job);
  return normalizeBulkSessionCounters({ ...session, jobs });
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
    ? normalizeImageOverrides(session.globalSettings, overrides)
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

export function isJobOutputStale(session: BulkSession, job: ImageJob): boolean {
  if (!job.output) return true;
  const effectiveSettings = getEffectiveSettings(
    session.globalSettings,
    job.overrides,
  );
  return (
    job.output.settingsHash !==
    settingsHash(effectiveSettings, getJobSourceDimensions(job))
  );
}

export function isJobReadyForExport(
  session: BulkSession,
  job: ImageJob,
): boolean {
  return Boolean(
    job.output && job.status === 'encoded' && !isJobOutputStale(session, job),
  );
}

export function isJobCurrentExport(
  session: BulkSession,
  job: ImageJob,
): boolean {
  return Boolean(
    job.output && job.status === 'exported' && !isJobOutputStale(session, job),
  );
}

export function markJobsExported(
  session: BulkSession,
  jobIds: Iterable<string>,
): BulkSession {
  const normalizedSession = normalizeBulkSessionCounters(session);
  const exportedJobIds = new Set(jobIds);
  let newlyExportedCount = 0;

  return {
    ...normalizedSession,
    jobs: normalizedSession.jobs.map((job) => {
      if (
        !exportedJobIds.has(job.id) ||
        !isJobReadyForExport(normalizedSession, job)
      ) {
        return job;
      }
      newlyExportedCount += 1;
      return {
        ...job,
        status: 'exported',
      };
    }),
    exportedCount: normalizedSession.exportedCount + newlyExportedCount,
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
  let hasQueuedJobs = false;
  let hasRetryableJobs = false;
  let hasIncompleteJobs = false;

  for (const job of session.jobs) {
    const group = getJobStatusGroup(job.status);
    if (group === 'active') hasActiveJobs = true;
    if (group === 'pending') hasQueuedJobs = true;
    if (group === 'failed' || group === 'skipped') hasRetryableJobs = true;
    if (group !== 'complete') hasIncompleteJobs = true;
  }

  return {
    hasActiveJobs,
    hasQueuedJobs,
    hasRetryableJobs,
    hasIncompleteJobs,
    canProcess: hasQueuedJobs && !hasActiveJobs,
    canRetry: hasRetryableJobs && !hasActiveJobs,
    canCancel: hasActiveJobs,
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
