import type { BulkSession, ImageJob } from './session';
import { isJobOutputStale } from './queue';
import { getPercentChange } from './size';

export interface BulkExportSummary {
  ready: number;
  failed: number;
  pending: number;
  skipped: number;
  totalOriginalSize: number;
  totalOutputSize: number;
  percentChange: number;
}

export interface BulkOutputSummary {
  optimized: number;
  stale: number;
  totalOriginalSize: number;
  totalOutputSize: number;
  percentChange: number;
}

export interface BulkExportEntry {
  job: ImageJob;
  fileName: string;
  downloadUrl: string;
  size: number;
}

function splitFileName(fileName: string): {
  baseName: string;
  extension: string;
} {
  const normalizedName = fileName.trim() || 'image';
  const lastDot = normalizedName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === normalizedName.length - 1) {
    return {
      baseName: normalizedName,
      extension: '',
    };
  }
  return {
    baseName: normalizedName.slice(0, lastDot),
    extension: normalizedName.slice(lastDot + 1),
  };
}

function sanitizeFileNamePart(value: string): string {
  return value
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/^[\s.-]+|[\s.-]+$/g, '')
    .trim();
}

function createDuplicateSafeName(
  fileName: string,
  knownNames: Set<string>,
): string {
  const { baseName, extension } = splitFileName(fileName);
  let suffix = 1;
  let candidate = fileName;

  while (knownNames.has(candidate.toLowerCase())) {
    suffix += 1;
    candidate = `${baseName}-${suffix}${extension ? `.${extension}` : ''}`;
  }

  knownNames.add(candidate.toLowerCase());
  return candidate;
}

export function getExportableJobs(session: BulkSession): ImageJob[] {
  return session.jobs.filter(
    (job) =>
      job.output && job.status === 'encoded' && !isJobOutputStale(session, job),
  );
}

export function getBulkExportSummary(session: BulkSession): BulkExportSummary {
  let ready = 0;
  let failed = 0;
  let pending = 0;
  let skipped = 0;
  let totalOriginalSize = 0;
  let totalOutputSize = 0;

  for (const job of session.jobs) {
    if (job.status === 'failed') failed += 1;
    else if (job.status === 'skipped') skipped += 1;
    else if (
      job.output &&
      job.status === 'encoded' &&
      !isJobOutputStale(session, job)
    ) {
      ready += 1;
      totalOriginalSize += job.originalSize;
      totalOutputSize += job.output.size;
    } else {
      pending += 1;
    }
  }

  return {
    ready,
    failed,
    pending,
    skipped,
    totalOriginalSize,
    totalOutputSize,
    percentChange: getPercentChange(totalOriginalSize, totalOutputSize),
  };
}

export function getBulkOutputSummary(session: BulkSession): BulkOutputSummary {
  let optimized = 0;
  let stale = 0;
  let totalOriginalSize = 0;
  let totalOutputSize = 0;

  for (const job of session.jobs) {
    if (!job.output) continue;

    if (isJobOutputStale(session, job)) {
      stale += 1;
      continue;
    }

    optimized += 1;
    totalOriginalSize += job.originalSize;
    totalOutputSize += job.output.size;
  }

  return {
    optimized,
    stale,
    totalOriginalSize,
    totalOutputSize,
    percentChange: getPercentChange(totalOriginalSize, totalOutputSize),
  };
}

export function getBulkExportName(session: BulkSession): string {
  const safeSessionName = sanitizeFileNamePart(session.id) || 'sqush-bulk';
  return `${safeSessionName}-optimized`;
}

export function getBulkOutputFileName(job: ImageJob): string {
  const { baseName } = splitFileName(job.sourceFile.name);
  const outputName = job.output?.file.name ?? '';
  const { extension } = splitFileName(outputName);
  const safeBaseName = sanitizeFileNamePart(baseName) || 'image';
  return extension ? `${safeBaseName}.${extension}` : safeBaseName;
}

export function getBulkExportEntries(session: BulkSession): BulkExportEntry[] {
  const knownNames = new Set<string>();
  return getExportableJobs(session).map((job) => {
    const output = job.output!;
    return {
      job,
      fileName: createDuplicateSafeName(getBulkOutputFileName(job), knownNames),
      downloadUrl: output.downloadUrl,
      size: output.size,
    };
  });
}
