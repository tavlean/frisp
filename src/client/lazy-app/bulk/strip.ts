import { getBulkJobSizeSummary, type BulkJobOutputState } from './export';
import type { BulkSession, ImageJob, ImageJobStatus } from './session';
import { getJobStatusGroup, type ImageJobStatusGroup } from './session';

export interface BulkStripItem {
  id: string;
  index: number;
  fileName: string;
  status: ImageJobStatus;
  statusGroup: ImageJobStatusGroup;
  selected: boolean;
  thumbnailUrl?: string;
  previewUrl?: string;
  outputState: BulkJobOutputState;
  originalSize: number;
  outputSize?: number;
  percentChange?: number;
  hasOverrides: boolean;
  error?: string;
}

function createBulkStripItem(
  session: BulkSession,
  job: ImageJob,
  index: number,
): BulkStripItem {
  const sizeSummary = getBulkJobSizeSummary(session, job);

  return {
    id: job.id,
    index,
    fileName: job.sourceFile.name,
    status: job.status,
    statusGroup: getJobStatusGroup(job.status),
    selected: job.id === session.selectedJobId,
    thumbnailUrl: job.thumbnailUrl,
    previewUrl: job.previewUrl,
    outputState: sizeSummary.outputState,
    originalSize: sizeSummary.originalSize,
    outputSize: sizeSummary.outputSize,
    percentChange: sizeSummary.percentChange,
    hasOverrides: job.ownRecipe !== undefined,
    error: job.error,
  };
}

export function getBulkStripItems(session: BulkSession): BulkStripItem[] {
  return session.jobs.map((job, index) =>
    createBulkStripItem(session, job, index),
  );
}

export function getSelectedBulkStripItem(
  session: BulkSession,
): BulkStripItem | undefined {
  return getBulkStripItems(session).find((item) => item.selected);
}
