import { getFileNameParts, getSafeFileNameBase } from '../output-filename';
import { APP_NAME } from 'shared/brand';
import {
  isJobCurrentExport,
  isJobOutputStale,
  isJobReadyForExport,
  markJobsExported,
} from './session';
import type { BulkSession, ImageJob } from './session';
import { getPercentChange } from './size';

export interface BulkExportSummary {
  ready: number;
  exported: number;
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

export type BulkJobOutputState = 'missing' | 'stale' | 'optimized';

export interface BulkJobSizeSummary {
  job: ImageJob;
  outputState: BulkJobOutputState;
  originalSize: number;
  outputSize?: number;
  percentChange?: number;
}

export interface BulkExportOptions {
  /** When an output is strictly larger than its source, ship the source
   *  instead. Default false (existing behavior). */
  keepOriginalWhenLarger?: boolean;
}

export interface BulkExportEntry {
  job: ImageJob;
  fileName: string;
  downloadUrl: string;
  size: number;
  /** True when the guard replaced the output with the untouched source. */
  keptOriginal: boolean;
}

export interface BulkExportPlan {
  archiveName: string;
  entries: BulkExportEntry[];
  summary: BulkExportSummary;
}

function createDuplicateSafeName(
  fileName: string,
  knownNames: Set<string>,
): string {
  const { baseName, extension } = getFileNameParts(fileName);
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
  return session.jobs.filter((job) => isJobReadyForExport(session, job));
}

function getRequestedJobIds(
  jobIds?: Iterable<string>,
): Set<string> | undefined {
  if (!jobIds) return;
  return new Set(jobIds);
}

export function getSelectedExportableJobs(
  session: BulkSession,
  jobIds?: Iterable<string>,
): ImageJob[] {
  const requestedJobIds = getRequestedJobIds(jobIds);
  const exportableJobs = getExportableJobs(session);
  if (!requestedJobIds) return exportableJobs;
  return exportableJobs.filter((job) => requestedJobIds.has(job.id));
}

export function canExportBulkSession(
  session: BulkSession,
  jobIds?: Iterable<string>,
): boolean {
  return getSelectedExportableJobs(session, jobIds).length > 0;
}

export function getBulkJobSizeSummary(
  session: BulkSession,
  job: ImageJob,
): BulkJobSizeSummary {
  if (!job.output) {
    return {
      job,
      outputState: 'missing',
      originalSize: job.originalSize,
    };
  }

  if (isJobOutputStale(session, job)) {
    return {
      job,
      outputState: 'stale',
      originalSize: job.originalSize,
    };
  }

  return {
    job,
    outputState: 'optimized',
    originalSize: job.originalSize,
    outputSize: job.output.size,
    percentChange: getPercentChange(job.originalSize, job.output.size),
  };
}

export function getBulkExportSummary(
  session: BulkSession,
  jobIds?: Iterable<string>,
): BulkExportSummary {
  const requestedJobIds = getRequestedJobIds(jobIds);
  let ready = 0;
  let exported = 0;
  let failed = 0;
  let pending = 0;
  let skipped = 0;
  let totalOriginalSize = 0;
  let totalOutputSize = 0;

  for (const job of session.jobs) {
    if (requestedJobIds && !requestedJobIds.has(job.id)) continue;

    if (job.status === 'failed') failed += 1;
    else if (job.status === 'skipped') skipped += 1;
    else if (isJobReadyForExport(session, job)) {
      ready += 1;
      totalOriginalSize += job.originalSize;
      totalOutputSize += job.output!.size;
    } else if (isJobCurrentExport(session, job)) {
      exported += 1;
    } else {
      pending += 1;
    }
  }

  return {
    ready,
    exported,
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
  // Brand appears only in the FALLBACK base (session id unusable), matching
  // the pre-rename contract: a named batch downloads as `<name>-optimized`,
  // not `<brand>-<name>-optimized`. The 2026-07-05 rename-proofing refactor
  // accidentally prefixed every archive; tests/unit/export.test.ts pins this.
  const safeSessionName = getSafeFileNameBase(
    session.id,
    `${APP_NAME.toLowerCase()}-bulk`,
  );
  return `${safeSessionName}-optimized`;
}

export function getBulkOutputFileName(job: ImageJob): string {
  const { baseName } = getFileNameParts(job.sourceFile.name);
  const outputName = job.output?.file.name ?? '';
  const { extension } = getFileNameParts(outputName);
  const safeBaseName = getSafeFileNameBase(baseName);
  return extension ? `${safeBaseName}.${extension}` : safeBaseName;
}

export function getBulkExportEntries(
  session: BulkSession,
  jobIds?: Iterable<string>,
  options: BulkExportOptions = {},
): BulkExportEntry[] {
  const knownNames = new Set<string>();
  return getSelectedExportableJobs(session, jobIds).map((job) => {
    const output = job.output!;
    const keptOriginal =
      options.keepOriginalWhenLarger === true && output.size > job.originalSize;
    const fileName = keptOriginal
      ? job.sourceFile.name
      : getBulkOutputFileName(job);

    return {
      job,
      fileName: createDuplicateSafeName(fileName, knownNames),
      downloadUrl: output.downloadUrl,
      size: keptOriginal ? job.originalSize : output.size,
      keptOriginal,
    };
  });
}

export function createBulkExportPlan(
  session: BulkSession,
  jobIds?: Iterable<string>,
  options?: BulkExportOptions,
): BulkExportPlan {
  const entries = getBulkExportEntries(session, jobIds, options);

  return {
    archiveName: getBulkExportName(session),
    entries,
    summary: getBulkExportSummary(session, jobIds),
  };
}

export function markBulkExportPlanExported(
  session: BulkSession,
  plan: BulkExportPlan,
): BulkSession {
  return markJobsExported(
    session,
    plan.entries.map((entry) => entry.job.id),
  );
}
