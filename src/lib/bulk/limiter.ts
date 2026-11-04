/**
 * Run at most `slots` tasks at once; the rest wait their turn in call order.
 * Bulk import uses it for thumbnails: each one decodes the FULL source before
 * downscaling, so a 100-file drop would otherwise hold 100 full-size bitmaps
 * at the same moment.
 */
export function createLimiter(slots: number) {
  let active = 0;
  const waiting: (() => void)[] = [];

  const release = () => {
    active -= 1;
    waiting.shift()?.();
  };

  return async function limit<T>(task: () => Promise<T>): Promise<T> {
    if (active >= slots) {
      await new Promise<void>((resolve) => waiting.push(resolve));
    }
    active += 1;
    try {
      return await task();
    } finally {
      release();
    }
  };
}
