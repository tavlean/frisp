import { addJobs, createBulkSession, createImageJob } from './session';
import type { BulkSession, ImageJob } from './session';
import type { ImageRecipe, SvgOutputOptions } from '../recipe';

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
export type BulkRelativePathGetter = (file: File) => string | undefined;

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

function getDefaultRelativePath(file: File): string | undefined {
  return file.webkitRelativePath || undefined;
}

function acceptBulkImportFile(
  result: BulkImportResult,
  file: File,
  relativePath?: string,
): void {
  result.accepted.push(
    createImageJob(
      createImageJobId(file, result.accepted.length),
      file,
      relativePath,
    ),
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

export function createImageJobs(
  files: Iterable<File>,
  getRelativePath: BulkRelativePathGetter = getDefaultRelativePath,
): BulkImportResult {
  const result = createBulkImportResult();

  for (const file of files) {
    if (!isSupportedBulkImage(file)) {
      rejectBulkImportFile(result, file, 'unsupported-type');
      continue;
    }

    acceptBulkImportFile(result, file, getRelativePath(file) || undefined);
  }

  return result;
}

export async function createImageJobsWithMimeSniffing(
  files: Iterable<File>,
  sniffMimeType: BulkMimeSniffer,
  getRelativePath: BulkRelativePathGetter = getDefaultRelativePath,
): Promise<BulkImportResult> {
  const result = createBulkImportResult();

  for (const file of files) {
    if (isSupportedBulkImage(file)) {
      acceptBulkImportFile(result, file, getRelativePath(file) || undefined);
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

    acceptBulkImportFile(result, file, getRelativePath(file) || undefined);
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
  sharedRecipe: ImageRecipe,
  result: BulkImportResult,
  sharedSvgOptions?: SvgOutputOptions,
): BulkSession {
  return createBulkSession(id, sharedRecipe, result.accepted, sharedSvgOptions);
}

export function addBulkImportToSession(
  session: BulkSession,
  result: BulkImportResult,
): BulkSession {
  return addJobs(session, result.accepted);
}
