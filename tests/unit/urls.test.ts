import { describe, expect, it, vi } from 'vitest';
import {
  collectJobObjectUrls,
  revokeJobObjectUrls,
  revokeSessionObjectUrls,
} from '../../src/client/lazy-app/bulk/urls';
import { fakeOutput, job, session } from './fixtures';

describe('bulk object URL helpers', () => {
  it('collects each object URL from a job once', () => {
    const current = job('a', {
      previewUrl: 'blob:a',
      thumbnailUrl: 'blob:a',
      output: fakeOutput({ url: 'blob:out' }),
    });

    expect(collectJobObjectUrls(current)).toEqual(['blob:a', 'blob:out']);
  });

  it('revokes job object URLs once each', () => {
    const revoke = vi.fn();

    revokeJobObjectUrls(
      job('a', {
        previewUrl: 'blob:a',
        thumbnailUrl: 'blob:a',
        output: fakeOutput({ url: 'blob:out' }),
      }),
      revoke,
    );

    expect(revoke).toHaveBeenCalledTimes(2);
    expect(revoke).toHaveBeenNthCalledWith(1, 'blob:a');
    expect(revoke).toHaveBeenNthCalledWith(2, 'blob:out');
  });

  it('deduplicates revocation across a whole session', () => {
    const revoke = vi.fn();
    const current = session([
      job('a', {
        previewUrl: 'blob:shared',
        output: fakeOutput({ url: 'blob:a' }),
      }),
      job('b', {
        thumbnailUrl: 'blob:shared',
        output: fakeOutput({ url: 'blob:b' }),
      }),
    ]);

    revokeSessionObjectUrls(current, revoke);

    expect(revoke.mock.calls.flat()).toEqual([
      'blob:shared',
      'blob:a',
      'blob:b',
    ]);
  });
});
