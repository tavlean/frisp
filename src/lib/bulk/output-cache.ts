import type { ImageOutput } from '#client/lazy-app/bulk/index.ts';

// Earlier outputs of bulk jobs, keyed by job and recipe hash, so returning to a
// previous setting (or undoing a removal) restores a result without encoding
// again. Memory model: each entry holds an encoded File behind an object URL.
// Two limits bound it: a few entries per job, and a byte budget across the
// whole batch, evicted least recently used. A large lossless batch would
// otherwise keep several full-size PNGs per image alive. Pinned outputs (the
// ones on screen and in the session) are never evicted; their URLs belong to
// the session until it lets go.

export interface BulkOutputCacheOptions {
  maxEntriesPerJob?: number;
  maxBytes?: number;
}

const DEFAULT_MAX_ENTRIES_PER_JOB = 3;
const DEFAULT_MAX_BYTES = 192 * 1024 * 1024;

const entryKey = (jobId: string, hash: string) => `${jobId}\n${hash}`;

export class BulkOutputCache {
  #jobs = new Map<string, Map<string, ImageOutput>>();
  // Every entry once, oldest use first: the batch-wide eviction order.
  #recency = new Map<string, { jobId: string; hash: string }>();
  #bytes = 0;
  #pinnedUrls = new Set<string>();
  #maxEntriesPerJob: number;
  #maxBytes: number;

  constructor(options: BulkOutputCacheOptions = {}) {
    this.#maxEntriesPerJob =
      options.maxEntriesPerJob ?? DEFAULT_MAX_ENTRIES_PER_JOB;
    this.#maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
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
    this.#touch(jobId, hash);
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
      this.#bytes -= existing.size;
      if (existing !== output) this.#revokeIfUnpinned(existing);
    }
    entries.set(hash, output);
    this.#bytes += output.size;
    this.#touch(jobId, hash);
    this.#evictJob(jobId);
    this.#evictBudget();
  }

  deleteJob(jobId: string, alreadyRevoked = new Set<string>()): void {
    const entries = this.#jobs.get(jobId);
    if (!entries) return;

    for (const [hash, output] of entries) {
      this.#pinnedUrls.delete(output.downloadUrl);
      this.#recency.delete(entryKey(jobId, hash));
      this.#bytes -= output.size;
      if (!alreadyRevoked.has(output.downloadUrl)) {
        URL.revokeObjectURL(output.downloadUrl);
        alreadyRevoked.add(output.downloadUrl);
      }
    }
    this.#jobs.delete(jobId);
  }

  clear(): void {
    for (const entries of this.#jobs.values()) {
      for (const output of entries.values()) {
        this.#revokeIfUnpinned(output);
      }
    }
    this.#jobs.clear();
    this.#recency.clear();
    this.#bytes = 0;
    this.#pinnedUrls.clear();
  }

  #touch(jobId: string, hash: string): void {
    const key = entryKey(jobId, hash);
    this.#recency.delete(key);
    this.#recency.set(key, { jobId, hash });
  }

  #evictJob(jobId: string): void {
    const entries = this.#jobs.get(jobId);
    if (!entries) return;

    while (entries.size > this.#maxEntriesPerJob) {
      const victim = Array.from(entries.keys()).find(
        (hash) => !this.#pinnedUrls.has(entries.get(hash)!.downloadUrl),
      );
      if (victim === undefined) break;
      this.#evict(jobId, victim);
    }
  }

  #evictBudget(): void {
    for (const { jobId, hash } of [...this.#recency.values()]) {
      if (this.#bytes <= this.#maxBytes) return;
      const output = this.#jobs.get(jobId)?.get(hash);
      if (output && !this.#pinnedUrls.has(output.downloadUrl)) {
        this.#evict(jobId, hash);
      }
    }
  }

  #evict(jobId: string, hash: string): void {
    const entries = this.#jobs.get(jobId);
    const output = entries?.get(hash);
    if (!entries || !output) return;

    entries.delete(hash);
    if (entries.size === 0) this.#jobs.delete(jobId);
    this.#recency.delete(entryKey(jobId, hash));
    this.#bytes -= output.size;
    URL.revokeObjectURL(output.downloadUrl);
  }

  #revokeIfUnpinned(output: ImageOutput): void {
    if (!this.#pinnedUrls.has(output.downloadUrl)) {
      URL.revokeObjectURL(output.downloadUrl);
    }
  }
}
