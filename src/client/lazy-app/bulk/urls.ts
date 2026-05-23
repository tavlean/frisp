import type { BulkSession, ImageJob } from './session';

export function collectJobObjectUrls(job: ImageJob): string[] {
  return [
    ...new Set(
      [job.previewUrl, job.thumbnailUrl, job.output?.downloadUrl].filter(
        (url): url is string => Boolean(url),
      ),
    ),
  ];
}

export function revokeJobObjectUrls(
  job: ImageJob,
  revokeObjectUrl = URL.revokeObjectURL,
): void {
  for (const url of collectJobObjectUrls(job)) revokeObjectUrl(url);
}

export function revokeSessionObjectUrls(
  session: BulkSession,
  revokeObjectUrl = URL.revokeObjectURL,
): void {
  const revokedUrls = new Set<string>();
  for (const job of session.jobs) {
    for (const url of collectJobObjectUrls(job)) {
      if (revokedUrls.has(url)) continue;
      revokedUrls.add(url);
      revokeObjectUrl(url);
    }
  }
}
