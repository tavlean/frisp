import { addJobs, createBulkSession, createImageJob } from './session';
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
  rejectedUnsupported: number;
  rejectedUnreadable: number;
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

function createBulkImportResult(): BulkImportResult {
  return {
    accepted: [],
    rejected: [],
    rejections: [],
  };
}

function acceptBulkImportFile(result: BulkImportResult, file: File): void {
  result.accepted.push(
    createImageJob(createImageJobId(file, result.accepted.length), file),
  );
}

function rejectBulkImportFile(
  result: BulkImportResult,
  file: File,
  reason: BulkImportRejectionReason,
): void {
  result.rejected.push(file);
  result.rejections.push({ file, reason });
}

export function createImageJobs(files: Iterable<File>): BulkImportResult {
  const result = createBulkImportResult();

  for (const file of files) {
    if (!isSupportedBulkImage(file)) {
      rejectBulkImportFile(result, file, 'unsupported-type');
      continue;
    }

    acceptBulkImportFile(result, file);
  }

  return result;
}

export async function createImageJobsWithMimeSniffing(
  files: Iterable<File>,
  sniffMimeType: BulkMimeSniffer,
): Promise<BulkImportResult> {
  const result = createBulkImportResult();

  for (const file of files) {
    if (isSupportedBulkImage(file)) {
      acceptBulkImportFile(result, file);
      continue;
    }

    let detectedType = '';
    try {
      detectedType = await sniffMimeType(file);
    } catch (err) {
      rejectBulkImportFile(result, file, 'unreadable');
      continue;
    }

    if (!detectedType.startsWith('image/')) {
      rejectBulkImportFile(result, file, 'unsupported-type');
      continue;
    }

    acceptBulkImportFile(result, file);
  }

  return result;
}

export function getBulkImportSummary(
  result: BulkImportResult,
): BulkImportSummary {
  const rejectedUnsupported = result.rejections.filter(
    (rejection) => rejection.reason === 'unsupported-type',
  ).length;
  const rejectedUnreadable = result.rejections.filter(
    (rejection) => rejection.reason === 'unreadable',
  ).length;

  return {
    accepted: result.accepted.length,
    rejected: result.rejected.length,
    rejectedUnsupported,
    rejectedUnreadable,
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

export function addBulkImportToSession(
  session: BulkSession,
  result: BulkImportResult,
): BulkSession {
  return addJobs(session, result.accepted);
}
