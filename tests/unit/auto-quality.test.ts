import { describe, expect, it } from 'vitest';
import {
  AUTO_QUALITY_BOUNDS,
  AUTO_QUALITY_TARGETS,
  searchQuality,
} from '../../src/lib/editor/auto-quality';

interface Probe {
  quality: number;
  score: number;
}

/** A stub probe over a score function, recording every quality it encodes,
 *  every result discarded, and advancing a fake clock per probe. */
function harness(
  scoreOf: (quality: number) => number,
  { msPerProbe = 0 }: { msPerProbe?: number } = {},
) {
  let clock = 0;
  const probed: number[] = [];
  const discarded: number[] = [];
  return {
    probed,
    discarded,
    now: () => clock,
    probe: async (quality: number): Promise<Probe> => {
      probed.push(quality);
      clock += msPerProbe;
      return { quality, score: scoreOf(quality) };
    },
    discard: (result: Probe) => discarded.push(result.quality),
  };
}

// Monotonic: quality q scores q, so the lowest quality passing target t is t.
const linear = (quality: number) => quality;

describe('searchQuality', () => {
  it('picks the lowest passing quality on a monotonic table', async () => {
    for (const target of [0, 1, 37, 70, 99, 100]) {
      const h = harness(linear);
      const result = await searchQuality({ ...h, lo: 0, hi: 100, target });
      expect(result.quality).toBe(target);
      expect(result.met).toBe(true);
      expect(result.timedOut).toBe(false);
      expect(result.result.quality).toBe(target);
    }
  });

  it('can return the bottom of the range itself', async () => {
    const h = harness(() => 95);
    const result = await searchQuality({ ...h, lo: 0, hi: 100, target: 90 });
    expect(result.quality).toBe(0);
    expect(result.met).toBe(true);
  });

  it('commits the ceiling honestly when even hi misses the target', async () => {
    const h = harness(() => -1000);
    const result = await searchQuality({ ...h, lo: 0, hi: 100, target: 60 });
    expect(result).toMatchObject({
      quality: 100,
      score: -1000,
      met: false,
      probes: 1,
      timedOut: false,
    });
    expect(h.probed).toEqual([100]);
  });

  it('never issues more than 8 probes, and probes the ceiling first', async () => {
    for (const target of Object.values(AUTO_QUALITY_TARGETS)) {
      const h = harness((q) => q * 0.93);
      const result = await searchQuality({ ...h, lo: 0, hi: 100, target });
      expect(h.probed[0]).toBe(100);
      expect(h.probed.length).toBeLessThanOrEqual(8);
      expect(result.probes).toBe(h.probed.length);
    }
  });

  it('respects the bounds it is given', async () => {
    const h = harness(linear);
    await searchQuality({ ...h, lo: 7, hi: 99, target: 3 });
    expect(Math.min(...h.probed)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...h.probed)).toBeLessThanOrEqual(99);
  });

  it('bounds WebP to 0..100', () => {
    expect(AUTO_QUALITY_BOUNDS.webP).toEqual({ lo: 0, hi: 100 });
  });

  it('discards every probe except the one it returns', async () => {
    const h = harness(linear);
    const result = await searchQuality({ ...h, lo: 0, hi: 100, target: 70 });
    expect(h.discarded).not.toContain(result.quality);
    expect([...h.discarded].sort()).toEqual(
      h.probed.filter((q) => q !== result.quality).sort(),
    );
  });

  it('rejects and discards everything when aborted between probe and commit', async () => {
    const controller = new AbortController();
    const h = harness(linear);
    const probe = async (quality: number) => {
      const result = await h.probe(quality);
      if (h.probed.length === 3) controller.abort();
      return result;
    };
    await expect(
      searchQuality({
        ...h,
        probe,
        lo: 0,
        hi: 100,
        target: 70,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect([...h.discarded].sort()).toEqual([...h.probed].sort());
  });

  it('issues no probe when already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const h = harness(linear);
    await expect(
      searchQuality({
        ...h,
        lo: 0,
        hi: 100,
        target: 70,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(h.probed).toEqual([]);
  });

  it('stops at the budget with the best pass so far', async () => {
    const h = harness(linear, { msPerProbe: 3000 });
    const result = await searchQuality({
      ...h,
      lo: 0,
      hi: 100,
      target: 70,
      budgetMs: 8000,
    });
    // 100 (3 s), 50 fails (6 s), 75 passes (9 s): over budget, stop.
    expect(h.probed).toEqual([100, 50, 75]);
    expect(result).toMatchObject({
      quality: 75,
      met: true,
      timedOut: true,
      probes: 3,
    });
    expect([...h.discarded].sort()).toEqual([100, 50].sort());
  });

  it('times out without a pass by returning the ceiling, not met', async () => {
    const h = harness(() => 40, { msPerProbe: 9000 });
    const result = await searchQuality({
      ...h,
      lo: 0,
      hi: 100,
      target: 70,
      budgetMs: 8000,
    });
    expect(result).toMatchObject({
      quality: 100,
      met: false,
      timedOut: true,
      probes: 1,
    });
  });
});
