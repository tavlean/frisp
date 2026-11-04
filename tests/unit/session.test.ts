import { describe, expect, it } from 'vitest';
import {
  addJobs,
  editJobRecipes,
  getBulkActionState,
  getBulkSessionCounters,
  getDetailedBatchProgress,
  getJobEffectiveRecipe,
  getOverrideSummary,
  getSelectedJob,
  getSelectedJobContext,
  isJobOutputStale,
  markJobsExported,
  normalizeBulkSessionCounters,
  removeJobs,
  restoreJob,
  selectJob,
  selectNextJob,
  selectPreviousJob,
  setJobOwnRecipe,
  updateSharedRecipe,
} from '../../src/client/lazy-app/bulk/session';
import { fakeOutput, job, recipe, resized, session } from './fixtures';

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

  it('restores removed jobs at their original index without changing selection', () => {
    const restored = job('b');
    const current = session([job('a'), job('c')], { selectedJobId: 'c' });

    const next = restoreJob(current, restored, 1);

    expect(next.jobs.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect(next.selectedJobId).toBe('c');
  });

  it('clamps restored jobs to the available index range', () => {
    const current = session([job('b')], { selectedJobId: 'b' });

    const prepended = restoreJob(current, job('a'), -1);
    const appended = restoreJob(current, job('c'), 99);

    expect(prepended.jobs.map((item) => item.id)).toEqual(['a', 'b']);
    expect(appended.jobs.map((item) => item.id)).toEqual(['b', 'c']);
  });

  it('returns the same session when restoring a duplicate job id', () => {
    const current = session([job('a')]);

    expect(restoreJob(current, job('a'), 0)).toBe(current);
  });

  it('recomputes counters after restoring active and exported jobs', () => {
    const current = {
      ...session([job('a')]),
      activeJobs: 7,
      exportedCount: 5,
    };

    const withActive = restoreJob(
      current,
      job('b', { status: 'processing' }),
      1,
    );
    const withExported = restoreJob(
      withActive,
      job('c', { status: 'exported', output: fakeOutput() }),
      2,
    );

    expect(withExported.activeJobs).toBe(1);
    expect(withExported.exportedCount).toBe(1);
  });

  it('reports restored encoded jobs with output as completed progress', () => {
    const current = session([job('a')]);

    const next = restoreJob(
      current,
      job('b', { status: 'encoded', output: fakeOutput() }),
      1,
    );

    expect(getDetailedBatchProgress(next)).toMatchObject({
      queued: 1,
      completed: 1,
    });
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

  it('updates the shared recipe and gives a job its own', () => {
    let current = updateSharedRecipe(session([job('a')]), resized(640, 480));
    expect(
      getJobEffectiveRecipe(current, 'a')?.processors.resize,
    ).toMatchObject({ enabled: true, width: 640 });

    const own = resized(320, 200);
    current = setJobOwnRecipe(current, 'a', own);

    expect(getJobEffectiveRecipe(current, 'a')).toBe(own);
    expect(getOverrideSummary(current)).toEqual({ overridden: 1, total: 1 });

    const reset = setJobOwnRecipe(current, 'a', undefined);
    expect(reset.jobs[0].ownRecipe).toBeUndefined();
    expect(getJobEffectiveRecipe(reset, 'a')?.processors.resize).toMatchObject({
      width: 640,
    });
  });

  it('gives edited jobs their own recipe and keeps their other values', () => {
    const current = session([
      job('a'),
      job('b', { ownRecipe: resized(320, 200) }),
      job('c'),
    ]);
    const withGrain = (r: ReturnType<typeof recipe>) => ({
      ...r,
      processors: {
        ...r.processors,
        grain: { enabled: true, amount: 30, size: 20 },
      },
    });

    const next = editJobRecipes(current, ['a', 'b'], withGrain);

    expect(next.jobs[0].ownRecipe?.processors.grain.amount).toBe(30);
    expect(next.jobs[1].ownRecipe?.processors).toMatchObject({
      grain: { enabled: true, amount: 30 },
      resize: { enabled: true, width: 320 },
    });
    expect(next.jobs[2].ownRecipe).toBeUndefined();
  });

  it('clears the own recipe when an edit lands back on the shared one', () => {
    const current = session([job('a', { ownRecipe: resized(320, 200) })]);

    const next = editJobRecipes(current, ['a'], () => recipe());
    expect(next.jobs[0].ownRecipe).toBeUndefined();

    // Equal by signature is enough: grain enabled at zero changes nothing.
    const inert = editJobRecipes(current, ['a'], () =>
      recipe((r) => {
        r.processors.grain = { enabled: true, amount: 0, size: 20 };
      }),
    );
    expect(inert.jobs[0].ownRecipe).toBeUndefined();
  });

  it('marks a job stale when its recipe changes and fresh when it changes back', () => {
    const current = session([
      job('a', { status: 'encoded', output: fakeOutput() }),
    ]);
    expect(isJobOutputStale(current, current.jobs[0])).toBe(false);

    const own = setJobOwnRecipe(current, 'a', resized(10, 10));
    expect(isJobOutputStale(own, own.jobs[0])).toBe(true);

    const back = setJobOwnRecipe(own, 'a', undefined);
    expect(isJobOutputStale(back, back.jobs[0])).toBe(false);
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
