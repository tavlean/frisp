import type {
  BulkSession,
  ImageJob,
  ImageJobStatus,
  ImageOutput,
} from './session';
import {
  getBulkSessionCounters,
  imageJobStatuses,
  isActiveImageJobStatus,
  normalizeBulkSessionCounters,
} from './session';
import type { ImageRecipe, SvgOutputOptions } from '../recipe';
import type { BulkSourceDimensions } from './settings';

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
  relativePath?: string;
  status: ImageJobStatus;
  originalSize: number;
  output?: BulkOutputSnapshot;
  ownRecipe?: ImageRecipe;
  error?: string;
}

export interface BulkSessionSnapshot {
  version: 2;
  id: string;
  sharedRecipe: ImageRecipe;
  sharedSvgOptions: SvgOutputOptions;
  resizeReference?: BulkSourceDimensions;
  jobs: BulkJobSnapshot[];
  selectedJobId?: string;
  activeJobs: number;
  exportedCount: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

/** Shape check only: a recipe's values are the encoders' to validate. */
function isRecipe(value: unknown): value is ImageRecipe {
  return (
    isRecord(value) &&
    typeof value.rotate === 'number' &&
    isRecord(value.processors) &&
    isRecord(value.output) &&
    (value.output.kind === 'raster' || value.output.kind === 'svg')
  );
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
    relativePath: job.relativePath,
    status: job.status,
    originalSize: job.originalSize,
    output: job.output ? createOutputSnapshot(job.output) : undefined,
    ownRecipe: job.ownRecipe,
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
    !isOptionalString(value.relativePath) ||
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
    relativePath: value.relativePath || undefined,
    status: value.status,
    originalSize: value.originalSize,
    output,
    ownRecipe: isRecipe(value.ownRecipe) ? value.ownRecipe : undefined,
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
    isActiveImageJobStatus(status) ||
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
    relativePath: snapshot.relativePath,
    status: getRestoredJobStatus(snapshot.status),
    originalSize: snapshot.originalSize,
    ownRecipe: snapshot.ownRecipe,
    error: snapshot.error,
  };
}

function getSnapshotCounters(
  jobs: readonly BulkJobSnapshot[],
): Pick<BulkSessionSnapshot, 'activeJobs' | 'exportedCount'> {
  let activeJobs = 0;
  let exportedCount = 0;

  for (const job of jobs) {
    if (isActiveImageJobStatus(job.status)) activeJobs += 1;
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
    version: 2,
    id: normalizedSession.id,
    sharedRecipe: normalizedSession.sharedRecipe,
    sharedSvgOptions: normalizedSession.sharedSvgOptions,
    resizeReference: normalizedSession.resizeReference,
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
    parsedSnapshot.version !== 2 ||
    typeof parsedSnapshot.id !== 'string' ||
    !isRecipe(parsedSnapshot.sharedRecipe) ||
    !isRecord(parsedSnapshot.sharedSvgOptions) ||
    (parsedSnapshot.resizeReference !== undefined &&
      !isRecord(parsedSnapshot.resizeReference)) ||
    !Array.isArray(parsedSnapshot.jobs) ||
    !isOptionalString(parsedSnapshot.selectedJobId)
  ) {
    return;
  }

  const jobs = parsedSnapshot.jobs.map(parseJobSnapshot);
  if (jobs.some((job) => !job)) return;
  const validJobs = jobs as BulkJobSnapshot[];

  return {
    version: 2,
    id: parsedSnapshot.id,
    sharedRecipe: parsedSnapshot.sharedRecipe,
    sharedSvgOptions: parsedSnapshot.sharedSvgOptions,
    resizeReference: parsedSnapshot.resizeReference as
      | BulkSourceDimensions
      | undefined,
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
    sharedRecipe: snapshot.sharedRecipe,
    sharedSvgOptions: snapshot.sharedSvgOptions,
    resizeReference: snapshot.resizeReference,
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

export function restoreSerializedBulkSessionSnapshot(
  serializedSnapshot: string,
): BulkSession | undefined {
  const snapshot = parseBulkSessionSnapshot(serializedSnapshot);
  if (!snapshot) return;
  return restoreBulkSessionSnapshot(snapshot);
}
