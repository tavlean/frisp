import type { BulkSession, ImageJob } from './session';

export interface BulkExportSummary {
  ready: number;
  failed: number;
  pending: number;
  skipped: number;
  totalOriginalSize: number;
  totalOutputSize: number;
  percentChange: number;
}

export function getExportableJobs(session: BulkSession): ImageJob[] {
  return session.jobs.filter((job) => job.output && job.status === 'encoded');
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
    else if (job.output && job.status === 'encoded') {
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
    percentChange: totalOriginalSize
      ? (totalOutputSize / totalOriginalSize - 1) * 100
      : 0,
  };
}

export function getBulkExportName(session: BulkSession): string {
  return `${session.id || 'sqush-bulk'}-optimized`;
}
