import { describe, expect, it } from 'vitest';
import { pickWinner } from '../../src/lib/svg/auto-search';

describe('SVG auto-search selection', () => {
  it('uses gzip, raw, addon count, then higher precision', () => {
    const candidates = [
      { id: 'p3', gzipBytes: 90, rawBytes: 100, passed: false },
      { id: 'p1+reusePaths', gzipBytes: 80, rawBytes: 90, passed: true },
      { id: 'p2', gzipBytes: 80, rawBytes: 90, passed: true },
      { id: 'p3', gzipBytes: 80, rawBytes: 90, passed: true },
    ];
    expect(pickWinner(candidates)?.id).toBe('p3');
  });

  it('prefers smaller raw bytes after gzip ties', () => {
    expect(
      pickWinner([
        { id: 'p3', gzipBytes: 80, rawBytes: 100, passed: true },
        { id: 'p2', gzipBytes: 80, rawBytes: 90, passed: true },
      ])?.id,
    ).toBe('p2');
  });
});
