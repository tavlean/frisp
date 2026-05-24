import { createImageJob, ImageJob } from './session';

export interface BulkImportResult {
  accepted: ImageJob[];
  rejected: File[];
}

export interface BulkImportSummary {
  accepted: number;
  rejected: number;
  totalAcceptedSize: number;
  totalRejectedSize: number;
}

export type BulkMimeSniffer = (file: File) => Promise<string>;

const supportedImageExtensions = new Set([
  'avif',
  'bmp',
  'gif',
  'jfif',
  'jpeg',
  'jpg',
  'jxl',
  'png',
  'qoi',
  'svg',
  'tif',
  'tiff',
  'webp',
  'wp2',
]);

function getFileExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf('.');
  if (lastDot === -1 || lastDot === fileName.length - 1) return '';
  return fileName.slice(lastDot + 1).toLowerCase();
}

export function isSupportedBulkImage(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return supportedImageExtensions.has(getFileExtension(file.name));
}

export function createImageJobId(file: File, index: number): string {
  return `${index}-${file.name}-${file.size}-${file.lastModified}`;
}

export function createImageJobs(files: Iterable<File>): BulkImportResult {
  const accepted: ImageJob[] = [];
  const rejected: File[] = [];

  for (const file of files) {
    if (!isSupportedBulkImage(file)) {
      rejected.push(file);
      continue;
    }

    accepted.push(
      createImageJob(createImageJobId(file, accepted.length), file),
    );
  }

  return { accepted, rejected };
}

export async function createImageJobsWithMimeSniffing(
  files: Iterable<File>,
  sniffMimeType: BulkMimeSniffer,
): Promise<BulkImportResult> {
  const accepted: ImageJob[] = [];
  const rejected: File[] = [];

  for (const file of files) {
    if (isSupportedBulkImage(file)) {
      accepted.push(
        createImageJob(createImageJobId(file, accepted.length), file),
      );
      continue;
    }

    const detectedType = await sniffMimeType(file);
    if (!detectedType.startsWith('image/')) {
      rejected.push(file);
      continue;
    }

    accepted.push(
      createImageJob(createImageJobId(file, accepted.length), file),
    );
  }

  return { accepted, rejected };
}

export function getBulkImportSummary(
  result: BulkImportResult,
): BulkImportSummary {
  return {
    accepted: result.accepted.length,
    rejected: result.rejected.length,
    totalAcceptedSize: result.accepted.reduce(
      (total, job) => total + job.originalSize,
      0,
    ),
    totalRejectedSize: result.rejected.reduce(
      (total, file) => total + file.size,
      0,
    ),
  };
}
