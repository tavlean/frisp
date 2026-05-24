import { createBulkSession, createImageJob } from './session';
import type { BulkSession, ImageJob } from './session';
import type { BulkImageSettings } from './settings';

export type BulkImportRejectionReason = 'unsupported-type' | 'unreadable';

export interface BulkImportRejection {
  file: File;
  reason: BulkImportRejectionReason;
}

export interface BulkImportResult {
  accepted: ImageJob[];
  rejected: File[];
  rejections: BulkImportRejection[];
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
  const rejections: BulkImportRejection[] = [];

  for (const file of files) {
    if (!isSupportedBulkImage(file)) {
      rejected.push(file);
      rejections.push({ file, reason: 'unsupported-type' });
      continue;
    }

    accepted.push(
      createImageJob(createImageJobId(file, accepted.length), file),
    );
  }

  return { accepted, rejected, rejections };
}

export async function createImageJobsWithMimeSniffing(
  files: Iterable<File>,
  sniffMimeType: BulkMimeSniffer,
): Promise<BulkImportResult> {
  const accepted: ImageJob[] = [];
  const rejected: File[] = [];
  const rejections: BulkImportRejection[] = [];

  for (const file of files) {
    if (isSupportedBulkImage(file)) {
      accepted.push(
        createImageJob(createImageJobId(file, accepted.length), file),
      );
      continue;
    }

    let detectedType = '';
    try {
      detectedType = await sniffMimeType(file);
    } catch (err) {
      rejected.push(file);
      rejections.push({ file, reason: 'unreadable' });
      continue;
    }

    if (!detectedType.startsWith('image/')) {
      rejected.push(file);
      rejections.push({ file, reason: 'unsupported-type' });
      continue;
    }

    accepted.push(
      createImageJob(createImageJobId(file, accepted.length), file),
    );
  }

  return { accepted, rejected, rejections };
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

export function createBulkSessionFromImport(
  id: string,
  globalSettings: BulkImageSettings,
  result: BulkImportResult,
): BulkSession {
  return createBulkSession(id, globalSettings, result.accepted);
}
