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

const imageJobStatuses: readonly ImageJobStatus[] = [
  'queued',
  'decoding',
  'processing',
  'encoded',
  'failed',
  'skipped',
  'exported',
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

function isImageJobStatus(value: unknown): value is ImageJobStatus {
  return (
    typeof value === 'string' &&
    imageJobStatuses.includes(value as ImageJobStatus)
  );
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

function parseFileSnapshot(value: unknown): BulkFileSnapshot | undefined {
  if (!isRecord(value)) return;
  if (
    typeof value.name !== 'string' ||
    typeof value.type !== 'string' ||
    !isFiniteNumber(value.size) ||
    !isFiniteNumber(value.lastModified)
  ) {
    return;
  }

  return {
    name: value.name,
    type: value.type,
    size: value.size,
    lastModified: value.lastModified,
  };
}

function parseOutputSnapshot(value: unknown): BulkOutputSnapshot | undefined {
  if (!isRecord(value)) return;
  const file = parseFileSnapshot(value.file);
  if (
    !file ||
    !isFiniteNumber(value.size) ||
    !isFiniteNumber(value.percentChange) ||
    typeof value.settingsHash !== 'string'
  ) {
    return;
  }

  return {
    file,
    size: value.size,
    percentChange: value.percentChange,
    settingsHash: value.settingsHash,
  };
}

function parseJobSnapshot(value: unknown): BulkJobSnapshot | undefined {
  if (!isRecord(value)) return;
  const sourceFile = parseFileSnapshot(value.sourceFile);
  const output =
    value.output === undefined ? undefined : parseOutputSnapshot(value.output);
  if (
    typeof value.id !== 'string' ||
    !sourceFile ||
    !isImageJobStatus(value.status) ||
    !isFiniteNumber(value.originalSize) ||
    (value.output !== undefined && !output) ||
    !isOptionalString(value.error)
  ) {
    return;
  }

  return {
    id: value.id,
    sourceFile,
    status: value.status,
    originalSize: value.originalSize,
    output,
    overrides: isRecord(value.overrides)
      ? (value.overrides as BulkImageOverrides)
      : undefined,
    error: value.error,
  };
}

function restoreFileSnapshot(snapshot: BulkFileSnapshot): File {
  return new File([''], snapshot.name, {
    type: snapshot.type,
    lastModified: snapshot.lastModified,
  });
}

function getRestoredJobStatus(status: ImageJobStatus): ImageJobStatus {
  if (
    status === 'decoding' ||
    status === 'processing' ||
    status === 'encoded' ||
    status === 'exported'
  ) {
    return 'queued';
  }
  return status;
}

function restoreJobSnapshot(snapshot: BulkJobSnapshot): ImageJob {
  return {
    id: snapshot.id,
    sourceFile: restoreFileSnapshot(snapshot.sourceFile),
    status: getRestoredJobStatus(snapshot.status),
    originalSize: snapshot.originalSize,
    overrides: snapshot.overrides,
    error: snapshot.error,
  };
}

function getSnapshotCounters(
  jobs: readonly BulkJobSnapshot[],
): Pick<BulkSessionSnapshot, 'activeJobs' | 'exportedCount'> {
  let activeJobs = 0;
  let exportedCount = 0;

  for (const job of jobs) {
    if (job.status === 'decoding' || job.status === 'processing') {
      activeJobs += 1;
    }
    if (job.status === 'exported') exportedCount += 1;
  }

  return { activeJobs, exportedCount };
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

export function serializeBulkSessionSnapshot(
  snapshot: BulkSessionSnapshot,
): string {
  return JSON.stringify(snapshot);
}

export function parseBulkSessionSnapshot(
  serializedSnapshot: string,
): BulkSessionSnapshot | undefined {
  let parsedSnapshot: unknown;
  try {
    parsedSnapshot = JSON.parse(serializedSnapshot);
  } catch (err) {
    return;
  }

  if (!isRecord(parsedSnapshot)) return;
  if (
    parsedSnapshot.version !== 1 ||
    typeof parsedSnapshot.id !== 'string' ||
    !isRecord(parsedSnapshot.globalSettings) ||
    !isRecord(parsedSnapshot.globalSettings.processorState) ||
    !Array.isArray(parsedSnapshot.jobs) ||
    !isOptionalString(parsedSnapshot.selectedJobId)
  ) {
    return;
  }

  const jobs = parsedSnapshot.jobs.map(parseJobSnapshot);
  if (jobs.some((job) => !job)) return;
  const validJobs = jobs as BulkJobSnapshot[];

  return {
    version: 1,
    id: parsedSnapshot.id,
    globalSettings:
      parsedSnapshot.globalSettings as unknown as BulkImageSettings,
    jobs: validJobs,
    selectedJobId: parsedSnapshot.selectedJobId,
    ...getSnapshotCounters(validJobs),
  };
}

export function restoreBulkSessionSnapshot(
  snapshot: BulkSessionSnapshot,
): BulkSession {
  const jobs = snapshot.jobs.map(restoreJobSnapshot);
  const session = normalizeBulkSessionCounters({
    id: snapshot.id,
    globalSettings: snapshot.globalSettings,
    jobs,
    selectedJobId: jobs.some((job) => job.id === snapshot.selectedJobId)
      ? snapshot.selectedJobId
      : jobs[0]?.id,
    activeJobs: 0,
    exportedCount: 0,
  });

  return {
    ...session,
    activeJobs: 0,
    exportedCount: 0,
  };
}
