import { describe, expect, it } from 'vitest';
import { getPercentChange } from '../../src/client/lazy-app/bulk/size';

describe('bulk size helpers', () => {
  it('reports negative and positive percentage changes', () => {
    expect(getPercentChange(100, 75)).toBe(-25);
    expect(getPercentChange(100, 125)).toBe(25);
  });

  it('returns zero for zero-byte originals instead of NaN or Infinity', () => {
    expect(getPercentChange(0, 100)).toBe(0);
    expect(Number.isFinite(getPercentChange(0, 100))).toBe(true);
  });
});
