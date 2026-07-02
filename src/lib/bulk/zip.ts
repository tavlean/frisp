import { downloadZip } from 'client-zip';
import type { BulkExportPlan } from 'client/lazy-app/bulk';

export async function buildZipBlob(plan: BulkExportPlan): Promise<Blob> {
  const files = plan.entries.map((entry) => ({
    name: entry.fileName,
    lastModified: entry.keptOriginal
      ? entry.job.sourceFile.lastModified
      : entry.job.output!.file.lastModified,
    input: entry.keptOriginal ? entry.job.sourceFile : entry.job.output!.file,
  }));
  return await downloadZip(files).blob();
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Revoke on a timeout, not synchronously — Safari needs the tick.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
