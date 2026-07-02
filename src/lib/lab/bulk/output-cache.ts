import type { ImageOutput } from 'client/lazy-app/bulk';

export interface LabOutputCacheOptions {
  maxEntriesPerJob?: number;
}

const DEFAULT_MAX_ENTRIES_PER_JOB = 3;

export class LabOutputCache {
  #jobs = new Map<string, Map<string, ImageOutput>>();
  #pinnedUrls = new Set<string>();
  #maxEntriesPerJob: number;

  constructor(options: LabOutputCacheOptions = {}) {
    this.#maxEntriesPerJob =
      options.maxEntriesPerJob ?? DEFAULT_MAX_ENTRIES_PER_JOB;
  }

  setPinned(outputs: Iterable<ImageOutput>): void {
    this.#pinnedUrls = new Set(
      Array.from(outputs, (output) => output.downloadUrl),
    );
  }

  get(jobId: string, hash: string): ImageOutput | undefined {
    const entries = this.#jobs.get(jobId);
    const hit = entries?.get(hash);
    if (!entries || !hit) return;

    entries.delete(hash);
    entries.set(hash, hit);
    return hit;
  }

  put(jobId: string, hash: string, output: ImageOutput): void {
    let entries = this.#jobs.get(jobId);
    if (!entries) {
      entries = new Map();
      this.#jobs.set(jobId, entries);
    }

    const existing = entries.get(hash);
    if (existing) {
      entries.delete(hash);
      entries.set(hash, output);
      if (existing !== output) this.#revokeIfUnpinned(existing);
    } else {
      entries.set(hash, output);
    }
    this.#evictJob(jobId);
  }

  clear(): void {
    for (const entries of this.#jobs.values()) {
      for (const output of entries.values()) {
        this.#revokeIfUnpinned(output);
      }
    }
    this.#jobs.clear();
    this.#pinnedUrls.clear();
  }

  #evictJob(jobId: string): void {
    const entries = this.#jobs.get(jobId);
    if (!entries) return;

    while (entries.size > this.#maxEntriesPerJob) {
      const victimKey = Array.from(entries.keys()).find((key) => {
        const output = entries!.get(key);
        return output && !this.#pinnedUrls.has(output.downloadUrl);
      });
      if (!victimKey) break;

      const victim = entries.get(victimKey)!;
      entries.delete(victimKey);
      URL.revokeObjectURL(victim.downloadUrl);
    }

    if (entries.size === 0) this.#jobs.delete(jobId);
  }

  #revokeIfUnpinned(output: ImageOutput): void {
    if (!this.#pinnedUrls.has(output.downloadUrl)) {
      URL.revokeObjectURL(output.downloadUrl);
    }
  }
}
