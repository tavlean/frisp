import { isJobOutputStale, requeueJob, requeueStaleJobs } from './queue';
import {
  clearJobOverrides,
  updateGlobalSettings,
  updateJobOverrides,
} from './session';
import type { BulkSession } from './session';
import type { BulkImageOverrides, BulkImageSettings } from './settings';

function requeueJobIfStale(session: BulkSession, jobId: string): BulkSession {
  const job = session.jobs.find((job) => job.id === jobId);
  if (!job || !job.output || !isJobOutputStale(session, job)) return session;
  return requeueJob(session, jobId);
}

export function applyGlobalSettings(
  session: BulkSession,
  globalSettings: BulkImageSettings,
): BulkSession {
  return requeueStaleJobs(updateGlobalSettings(session, globalSettings));
}

export function applyJobOverrides(
  session: BulkSession,
  jobId: string,
  overrides: BulkImageOverrides,
): BulkSession {
  return requeueJobIfStale(
    updateJobOverrides(session, jobId, overrides),
    jobId,
  );
}

export function applyClearJobOverrides(
  session: BulkSession,
  jobId: string,
): BulkSession {
  return requeueJobIfStale(clearJobOverrides(session, jobId), jobId);
}
