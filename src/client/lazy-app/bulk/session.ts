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

export function createImageJob(id: string, sourceFile: File): ImageJob {
  return {
    id,
    sourceFile,
    status: 'queued',
    originalSize: sourceFile.size,
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
  let completed = 0;
  let failed = 0;

  for (const job of session.jobs) {
    if (job.status === 'encoded' || job.status === 'exported') completed += 1;
    if (job.status === 'failed') failed += 1;
  }

  return {
    total: session.jobs.length,
    completed,
    failed,
  };
}
