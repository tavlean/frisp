import { describe, expect, it } from 'vitest';
import {
  completeJob,
  failJob,
  getBulkQueueState,
  getRunnableJobs,
  requeueIncompleteJobs,
  requeueJob,
  requeueStaleJobs,
  startJob,
} from '../../src/client/lazy-app/bulk/queue';
import { settingsHash } from '../../src/client/lazy-app/bulk/settings';
import { fakeOutput, job, session, settings } from './fixtures';

describe('bulk queue reducers', () => {
  it('keeps active counters correct when jobs start, complete, and fail', () => {
    let current = session([job('a'), job('b')]);

    current = startJob(current, 'a');
    expect(current.jobs.find((item) => item.id === 'a')?.status).toBe(
      'processing',
    );
    expect(current.activeJobs).toBe(1);

    current = completeJob(current, 'a', fakeOutput());
    expect(current.jobs.find((item) => item.id === 'a')?.status).toBe(
      'encoded',
    );
    expect(current.activeJobs).toBe(0);

    current = startJob(current, 'b');
    current = failJob(current, 'b', 'encoder exploded');
    expect(current.jobs.find((item) => item.id === 'b')?.status).toBe('failed');
    expect(
      current.jobs.find((item) => item.id === 'b')?.output,
    ).toBeUndefined();
    expect(current.activeJobs).toBe(0);
    expect(current.exportedCount).toBe(0);
  });

  it('normalizes stale stored counters before transition deltas', () => {
    const current = {
      ...session([job('a', { status: 'processing' })]),
      activeJobs: 9,
      exportedCount: 4,
    };

    const next = completeJob(current, 'a', fakeOutput());

    expect(next.activeJobs).toBe(0);
    expect(next.exportedCount).toBe(0);
  });

  it('only starts queued jobs', () => {
    const current = session([
      job('a', { status: 'encoded', output: fakeOutput() }),
    ]);

    expect(startJob(current, 'a')).toBe(current);
    expect(startJob(current, 'missing')).toBe(current);
  });

  it('requeues stale outputs and preserves fresh ones', () => {
    const initialSettings = settings();
    const changedSettings = settings({
      processorState: {
        ...initialSettings.processorState,
        resize: {
          ...initialSettings.processorState.resize,
          enabled: true,
          width: 640,
        },
      },
    });
    const stale = job('stale', {
      status: 'exported',
      output: fakeOutput({ hash: settingsHash(initialSettings) }),
    });
    const fresh = job('fresh', {
      status: 'encoded',
      output: fakeOutput({ hash: settingsHash(changedSettings) }),
    });
    const current = session([stale, fresh], {
      globalSettings: changedSettings,
    });

    const next = requeueStaleJobs(current);

    expect(next.jobs.find((item) => item.id === 'stale')).toMatchObject({
      status: 'queued',
      output: undefined,
    });
    expect(next.jobs.find((item) => item.id === 'fresh')?.status).toBe(
      'encoded',
    );
    expect(next.exportedCount).toBe(0);
  });

  it('requeues failed, skipped, and active jobs without touching complete jobs', () => {
    const current = session([
      job('failed', { status: 'failed', error: 'bad' }),
      job('skipped', { status: 'skipped' }),
      job('active', { status: 'decoding' }),
      job('done', { status: 'encoded', output: fakeOutput() }),
    ]);

    const next = requeueIncompleteJobs(current);

    expect(next.jobs.map((item) => [item.id, item.status])).toEqual([
      ['failed', 'queued'],
      ['skipped', 'queued'],
      ['active', 'queued'],
      ['done', 'encoded'],
    ]);
    expect(next.activeJobs).toBe(0);
  });

  it('requeues an exported job and clears its output with exported counters updated', () => {
    const current = session([
      job('a', { status: 'exported', output: fakeOutput() }),
    ]);

    const next = requeueJob(current, 'a');

    expect(next.jobs[0]).toMatchObject({ status: 'queued', output: undefined });
    expect(next.exportedCount).toBe(0);
  });

  it('returns runnable queued jobs only within open concurrency slots', () => {
    const current = session([
      job('active', { status: 'processing' }),
      job('a'),
      job('done', { status: 'encoded', output: fakeOutput() }),
      job('b'),
      job('c'),
    ]);

    expect(getRunnableJobs(current, 2).map((item) => item.id)).toEqual(['a']);
    expect(getRunnableJobs(current, 4).map((item) => item.id)).toEqual([
      'a',
      'b',
      'c',
    ]);
    expect(getRunnableJobs(current, Number.NaN).map((item) => item.id)).toEqual(
      ['a'],
    );
  });

  it('reports normalized queue state', () => {
    const state = getBulkQueueState(
      {
        ...session([job('active', { status: 'decoding' }), job('queued')]),
        activeJobs: 12,
      },
      3.8,
    );

    expect(state).toMatchObject({
      concurrency: 3,
      activeJobs: 1,
      queuedJobs: 1,
      openSlots: 2,
    });
    expect(state.runnableJobs.map((item) => item.id)).toEqual(['queued']);
  });
});
