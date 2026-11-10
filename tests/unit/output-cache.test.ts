import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { BulkOutputCache } from '#lib/bulk/output-cache.ts';
import { fakeOutput } from './fixtures';

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

const output = (url: string, size: number) =>
  fakeOutput({ url, fileSize: size, fileName: `${url}.webp` });

describe('BulkOutputCache byte budget', () => {
  it('evicts the least recently used output across jobs past the budget', () => {
    const cache = new BulkOutputCache({ maxEntriesPerJob: 3, maxBytes: 250 });
    cache.put('a', 'h1', output('a1', 100));
    cache.put('b', 'h1', output('b1', 100));
    cache.get('a', 'h1');
    cache.put('c', 'h1', output('c1', 100));

    expect(revoked).toEqual(['b1']);
    expect(cache.get('b', 'h1')).toBeUndefined();
    expect(cache.get('a', 'h1')?.downloadUrl).toBe('a1');
    expect(cache.get('c', 'h1')?.downloadUrl).toBe('c1');
  });

  it('never evicts a pinned output, even past the budget', () => {
    const cache = new BulkOutputCache({ maxEntriesPerJob: 3, maxBytes: 150 });
    const pinned = output('a1', 100);
    cache.put('a', 'h1', pinned);
    cache.setPinned([pinned]);
    cache.put('b', 'h1', output('b1', 100));

    expect(revoked).toEqual(['b1']);
    expect(cache.get('a', 'h1')?.downloadUrl).toBe('a1');
  });

  it('frees the budget when a job is deleted', () => {
    const cache = new BulkOutputCache({ maxEntriesPerJob: 3, maxBytes: 200 });
    cache.put('a', 'h1', output('a1', 100));
    cache.put('b', 'h1', output('b1', 100));
    cache.deleteJob('a');
    cache.put('c', 'h1', output('c1', 100));

    expect(revoked).toEqual(['a1']);
    expect(cache.get('b', 'h1')?.downloadUrl).toBe('b1');
  });
});
