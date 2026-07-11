// An LRU cache of finished encode results, keyed by the exact signature of the
// inputs that produced them (the same signature `encodeSide` already computes).
//
// Why this exists: re-encoding is expensive (seconds for AVIF/JXL on big images).
// When the user steps back through undo/redo — or just toggles a setting and
// reverts it — the result for those settings was already computed once. Keeping it
// lets us show it INSTANTLY instead of re-running the pipeline. This is the
// "return to a previous optimized snapshot" half of the undo feature.
//
// Not reactive on purpose: a `CompressOutcome` holds heavy browser host objects
// (two `ImageData` buffers, a `File`, and a revocable object URL) that must stay
// out of Svelte's reactive graph — the same reason `EditorSession.results` is
// `$state.raw`. This is a plain class; the session pushes hits into its reactive
// `results` field.
//
// Memory: each entry pins two `ImageData` buffers alive, so a count cap alone
// isn't enough — one 24-megapixel image dwarfs a dozen thumbnails. We bound by
// total estimated bytes (with a count cap as a backstop) and evict
// least-recently-used entries, revoking their object URLs as they go. Entries the
// editor is currently displaying are pinned and never evicted.

import type { CompressOutcome } from './compress';

/** Rough live-memory cost of an outcome: its decoded source + output pixels. */
function outcomeBytes(outcome: CompressOutcome): number {
  // `data.byteLength` is the RGBA buffer (width * height * 4). For the Original
  // side source and output are the same buffer; double-counting it is harmless
  // and keeps the estimate conservative (we'd rather evict early than OOM).
  return (
    outcome.sourceImageData.data.byteLength +
    outcome.outputImageData.data.byteLength +
    // SVG text is cheap, but count it anyway.
    (outcome.svg?.optimizedText.length ?? 0)
  );
}

export interface ResultCacheOptions {
  /** Soft ceiling on total retained pixel bytes. Default 256 MiB. */
  maxBytes?: number;
  /** Hard ceiling on retained entries, regardless of size. Default 24. */
  maxEntries?: number;
}

export class ResultCache {
  // Insertion order doubles as recency: on a hit we delete + re-set to move the
  // entry to the most-recently-used end, so `keys().next()` is always the LRU.
  #map = new Map<string, CompressOutcome>();
  #bytes = 0;
  #maxBytes: number;
  #maxEntries: number;
  // Keys the editor is currently showing — never evicted (their URLs are live).
  #pinned = new Set<string>();

  constructor(options: ResultCacheOptions = {}) {
    this.#maxBytes = options.maxBytes ?? 256 * 1024 * 1024;
    this.#maxEntries = options.maxEntries ?? 24;
  }

  /** Look up a cached result, marking it most-recently-used on a hit. */
  get(key: string): CompressOutcome | undefined {
    const hit = this.#map.get(key);
    if (!hit) return undefined;
    this.#map.delete(key);
    this.#map.set(key, hit);
    return hit;
  }

  /** Store a freshly computed result, then evict down to budget. No-op if the key already exists. */
  set(key: string, outcome: CompressOutcome): void {
    if (this.#map.has(key)) return;
    this.#map.set(key, outcome);
    this.#bytes += outcomeBytes(outcome);
    this.#evict();
  }

  /**
   * Mark the set of keys that are on screen right now; these are exempt from
   * eviction so we never revoke a URL the UI still points at.
   */
  setPinned(keys: Iterable<string>): void {
    this.#pinned = new Set(keys);
  }

  /** Drop everything and revoke every object URL (call on new file / teardown). */
  clear(): void {
    for (const outcome of this.#map.values()) {
      URL.revokeObjectURL(outcome.outputUrl);
    }
    this.#map.clear();
    this.#bytes = 0;
    this.#pinned = new Set();
  }

  /** Current entry count (for diagnostics / tests). */
  get size(): number {
    return this.#map.size;
  }

  #evict(): void {
    // Walk oldest → newest, skipping pinned entries, until we're under both caps.
    const iterator = this.#map.keys();
    while (this.#map.size > this.#maxEntries || this.#bytes > this.#maxBytes) {
      const next = iterator.next();
      if (next.done) break; // only pinned entries remain — stop.
      const key = next.value;
      if (this.#pinned.has(key)) continue;
      const victim = this.#map.get(key)!;
      this.#map.delete(key);
      this.#bytes -= outcomeBytes(victim);
      URL.revokeObjectURL(victim.outputUrl);
    }
  }
}
