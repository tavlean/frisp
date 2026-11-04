import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { ResultCache } from '$lib/result-cache';
import type { CompressOutcome } from '$lib/compress';

// The cache only ever reads `outputUrl`, the output ImageData byte length,
// and the optional svg text length, so a minimal fake keeps the tests free of
// browser host objects.
function makeOutcome(url: string, bytes: number): CompressOutcome {
  return {
    outputUrl: url,
    outputImageData: { data: { byteLength: bytes } },
  } as unknown as CompressOutcome;
}

const revoked: string[] = [];
const originalRevoke = URL.revokeObjectURL;
URL.revokeObjectURL = (url: string) => {
  revoked.push(url);
};
afterAll(() => {
  URL.revokeObjectURL = originalRevoke;
});

beforeEach(() => {
  revoked.length = 0;
});

describe('ResultCache', () => {
  it('evicts the least-recently-used entry and revokes its URL', () => {
    const cache = new ResultCache({ maxEntries: 2 });
    cache.set('a', makeOutcome('url:a', 8));
    cache.set('b', makeOutcome('url:b', 8));
    cache.get('a'); // 'a' is now most recent; 'b' is the LRU.
    cache.set('c', makeOutcome('url:c', 8));
    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(revoked).toEqual(['url:b']);
  });

  it('evicts by byte budget, not only entry count', () => {
    const cache = new ResultCache({ maxBytes: 100 });
    cache.set('a', makeOutcome('url:a', 60));
    cache.set('b', makeOutcome('url:b', 60));
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeDefined();
    expect(revoked).toEqual(['url:a']);
  });

  it('never evicts pinned entries', () => {
    const cache = new ResultCache({ maxEntries: 2 });
    cache.set('a', makeOutcome('url:a', 8));
    cache.setPinned(['a']);
    cache.set('b', makeOutcome('url:b', 8));
    cache.set('c', makeOutcome('url:c', 8));
    expect(cache.get('a')).toBeDefined();
    expect(cache.get('b')).toBeUndefined();
    expect(revoked).toEqual(['url:b']);
  });

  it('never evicts the entry a set() call just admitted', () => {
    // Regression: the encode path caches before it pins (cache.set, then
    // showResult -> setPinned), so when the cache is over budget and every
    // older entry is pinned, the eviction pass used to walk past them and
    // revoke the URL of the entry it was just handed. Two sides encoding a
    // 12 MP image is enough to hit it live: the fresh result's blob URL died
    // before the UI could fetch it.
    const cache = new ResultCache({ maxBytes: 100 });
    cache.set('a', makeOutcome('url:a', 60));
    cache.set('b', makeOutcome('url:b', 60)); // evicts 'a'
    cache.setPinned(['b']);
    cache.set('c', makeOutcome('url:c', 60));
    expect(cache.get('c')).toBeDefined();
    expect(cache.get('b')).toBeDefined();
    expect(revoked).toEqual(['url:a']);
  });

  it('clear() revokes everything, including pinned entries', () => {
    const cache = new ResultCache();
    cache.set('a', makeOutcome('url:a', 8));
    cache.set('b', makeOutcome('url:b', 8));
    cache.setPinned(['a']);
    cache.clear();
    expect(cache.size).toBe(0);
    expect(revoked.sort()).toEqual(['url:a', 'url:b']);
  });
});
