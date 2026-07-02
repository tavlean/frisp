import { describe, expect, it } from 'vitest';
import {
  addJobs,
  clearJobOverrides,
  getBulkActionState,
  getBulkSessionCounters,
  getDetailedBatchProgress,
  getJobEffectiveSettings,
  getOverrideSummary,
  getSelectedJob,
  getSelectedJobContext,
  markJobsExported,
  normalizeBulkSessionCounters,
  removeJobs,
  selectJob,
  selectNextJob,
  selectPreviousJob,
  updateGlobalSettings,
  updateJobOverrides,
} from '../../src/client/lazy-app/bulk/session';
import { fakeOutput, job, session, settings } from './fixtures';

describe('bulk session reducers and selectors', () => {
  it('normalizes counters from jobs', () => {
    const current = {
      ...session([
        job('a', { status: 'decoding' }),
        job('b', { status: 'exported', output: fakeOutput() }),
      ]),
      activeJobs: 0,
      exportedCount: 0,
    };

    expect(getBulkSessionCounters(current.jobs)).toEqual({
      activeJobs: 1,
      exportedCount: 1,
    });
    expect(normalizeBulkSessionCounters(current)).toMatchObject({
      activeJobs: 1,
      exportedCount: 1,
    });
  });

  it('deduplicates added job ids and keeps selection when present', () => {
    const current = session([job('a')], { selectedJobId: 'a' });

    const next = addJobs(current, [job('a'), job('a')]);

    expect(next.jobs.map((item) => item.id)).toEqual(['a', 'a-2', 'a-3']);
    expect(next.selectedJobId).toBe('a');
  });

  it('removes jobs and selects a fallback when needed', () => {
    const current = session(
      [
        job('a', { status: 'processing' }),
        job('b', { status: 'exported', output: fakeOutput() }),
        job('c'),
      ],
      { selectedJobId: 'b' },
    );

    const next = removeJobs(current, ['a', 'b']);

    expect(next.jobs.map((item) => item.id)).toEqual(['c']);
    expect(next.selectedJobId).toBe('c');
    expect(next.activeJobs).toBe(0);
    expect(next.exportedCount).toBe(0);
  });

  it('selects existing jobs and ignores missing ids', () => {
    const current = session([job('a'), job('b')], { selectedJobId: 'a' });

    expect(selectJob(current, 'b').selectedJobId).toBe('b');
    expect(selectJob(current, 'missing')).toBe(current);
  });

  it('selects next and previous jobs at edges', () => {
    const current = session([job('a'), job('b'), job('c')], {
      selectedJobId: 'b',
    });

    expect(selectNextJob(current).selectedJobId).toBe('c');
    expect(selectNextJob(selectNextJob(current)).selectedJobId).toBe('c');
    expect(selectPreviousJob(current).selectedJobId).toBe('a');
    expect(selectPreviousJob(selectPreviousJob(current)).selectedJobId).toBe(
      'a',
    );
  });

  it('updates global settings and image overrides', () => {
    const baseSettings = settings();
    const nextSettings = settings({
      processorState: {
        ...baseSettings.processorState,
        resize: { ...baseSettings.processorState.resize, enabled: true },
      },
    });
    let current = updateGlobalSettings(session([job('a')]), nextSettings);

    current = updateJobOverrides(current, 'a', {
      processorState: { resize: { width: 320 } },
    });

    expect(
      getJobEffectiveSettings(current, 'a')?.processorState.resize,
    ).toMatchObject({
      enabled: true,
      width: 320,
    });
    expect(getOverrideSummary(current)).toEqual({ overridden: 1, total: 1 });
    expect(clearJobOverrides(current, 'a').jobs[0].overrides).toBeUndefined();
  });

  it('marks only current encoded jobs as exported', () => {
    const current = session([
      job('ready', { status: 'encoded', output: fakeOutput() }),
      job('failed', { status: 'failed' }),
      job('pending'),
    ]);

    const next = markJobsExported(current, ['ready', 'pending']);

    expect(next.jobs.map((item) => [item.id, item.status])).toEqual([
      ['ready', 'exported'],
      ['failed', 'failed'],
      ['pending', 'queued'],
    ]);
    expect(next.exportedCount).toBe(1);
  });

  it('reports selected job context and batch progress', () => {
    const current = session(
      [
        job('queued'),
        job('active', { status: 'processing' }),
        job('encoded', { status: 'encoded', output: fakeOutput() }),
        job('exported', { status: 'exported', output: fakeOutput() }),
        job('failed', { status: 'failed' }),
        job('skipped', { status: 'skipped' }),
      ],
      { selectedJobId: 'encoded' },
    );

    expect(getSelectedJob(current)?.id).toBe('encoded');
    expect(getSelectedJobContext(current)).toMatchObject({
      index: 2,
      total: 6,
      canSelectPrevious: true,
      canSelectNext: true,
    });
    expect(getDetailedBatchProgress(current)).toEqual({
      total: 6,
      queued: 1,
      active: 1,
      completed: 2,
      failed: 1,
      skipped: 1,
      exported: 1,
    });
  });

  it('reports action availability from job groups', () => {
    expect(getBulkActionState(session([job('a')]))).toMatchObject({
      canProcess: true,
      canRetry: false,
      canCancel: false,
    });
    expect(
      getBulkActionState(session([job('a', { status: 'processing' })])),
    ).toMatchObject({
      canProcess: false,
      canRetry: false,
      canCancel: true,
    });
    expect(
      getBulkActionState(session([job('a', { status: 'failed' })])),
    ).toMatchObject({
      canProcess: false,
      canRetry: true,
      canCancel: false,
    });
  });
});
