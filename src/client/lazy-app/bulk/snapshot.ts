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
import type { BulkImageOverrides, BulkImageSettings } from './settings';

export interface BulkFileSnapshot {
  name: string;
  type: string;
  size: number;
  lastModified: number;
}

export interface BulkOutputSnapshot {
  file: BulkFileSnapshot;
  size: number;
  percentChange: number;
  settingsHash: string;
}

export interface BulkJobSnapshot {
  id: string;
  sourceFile: BulkFileSnapshot;
  status: ImageJobStatus;
  originalSize: number;
  output?: BulkOutputSnapshot;
  overrides?: BulkImageOverrides;
  error?: string;
}

export interface BulkSessionSnapshot {
  version: 1;
  id: string;
  globalSettings: BulkImageSettings;
  jobs: BulkJobSnapshot[];
  selectedJobId?: string;
  activeJobs: number;
  exportedCount: number;
}

function createFileSnapshot(file: File): BulkFileSnapshot {
  return {
    name: file.name,
    type: file.type,
    size: file.size,
    lastModified: file.lastModified,
  };
}

function createOutputSnapshot(output: ImageOutput): BulkOutputSnapshot {
  return {
    file: createFileSnapshot(output.file),
    size: output.size,
    percentChange: output.percentChange,
    settingsHash: output.settingsHash,
  };
}

function createJobSnapshot(job: ImageJob): BulkJobSnapshot {
  return {
    id: job.id,
    sourceFile: createFileSnapshot(job.sourceFile),
    status: job.status,
    originalSize: job.originalSize,
    output: job.output ? createOutputSnapshot(job.output) : undefined,
    overrides: job.overrides,
    error: job.error,
  };
}

export function createBulkSessionSnapshot(
  session: BulkSession,
): BulkSessionSnapshot {
  const normalizedSession = normalizeBulkSessionCounters(session);
  const jobs = normalizedSession.jobs.map(createJobSnapshot);
  const counters = getBulkSessionCounters(normalizedSession.jobs);

  return {
    version: 1,
    id: normalizedSession.id,
    globalSettings: normalizedSession.globalSettings,
    jobs,
    selectedJobId: normalizedSession.selectedJobId,
    ...counters,
  };
}
