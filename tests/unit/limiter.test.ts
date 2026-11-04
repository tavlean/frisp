import { describe, expect, it } from 'vitest';
import { createLimiter } from '$lib/bulk/limiter';

describe('createLimiter', () => {
  it('never runs more than its slots at once, in call order', async () => {
    const limit = createLimiter(2);
    let running = 0;
    let peak = 0;
    const started: number[] = [];
    const gates = Array.from({ length: 5 }, () => {
      let open!: () => void;
      const gate = new Promise<void>((resolve) => (open = resolve));
      return { gate, open };
    });

    const done = gates.map(({ gate }, index) =>
      limit(async () => {
        started.push(index);
        running += 1;
        peak = Math.max(peak, running);
        await gate;
        running -= 1;
        return index;
      }),
    );

    await Promise.resolve();
    expect(started).toEqual([0, 1]);
    for (const { open } of gates) {
      open();
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(await Promise.all(done)).toEqual([0, 1, 2, 3, 4]);
    expect(started).toEqual([0, 1, 2, 3, 4]);
    expect(peak).toBe(2);
  });

  it('frees the slot when a task throws', async () => {
    const limit = createLimiter(1);
    await expect(
      limit(async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    await expect(limit(async () => 'next')).resolves.toBe('next');
  });
});
