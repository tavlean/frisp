import { describe, expect, it } from 'vitest';
import {
  createBulkSessionSnapshot,
  parseBulkSessionSnapshot,
  restoreBulkSessionSnapshot,
  restoreSerializedBulkSessionSnapshot,
} from '../../src/client/lazy-app/bulk/snapshot';
import { fakeOutput, job, session, settings } from './fixtures';

function validSerializedSnapshot(): string {
  return JSON.stringify(createBulkSessionSnapshot(session([job('a')])));
}

describe('bulk session snapshots', () => {
  it.each([
    ['malformed JSON', '{'],
    ['non-object JSON', 'null'],
    [
      'wrong version',
      JSON.stringify({ ...JSON.parse(validSerializedSnapshot()), version: 2 }),
    ],
    [
      'missing processor state',
      JSON.stringify({
        ...JSON.parse(validSerializedSnapshot()),
        globalSettings: {},
      }),
    ],
    [
      'jobs is not an array',
      JSON.stringify({ ...JSON.parse(validSerializedSnapshot()), jobs: {} }),
    ],
    [
      'bad job status',
      JSON.stringify({
        ...JSON.parse(validSerializedSnapshot()),
        jobs: [
          { ...JSON.parse(validSerializedSnapshot()).jobs[0], status: 'wat' },
        ],
      }),
    ],
    [
      'bad source file',
      JSON.stringify({
        ...JSON.parse(validSerializedSnapshot()),
        jobs: [
          {
            ...JSON.parse(validSerializedSnapshot()).jobs[0],
            sourceFile: { name: 'a.png' },
          },
        ],
      }),
    ],
    [
      'bad output payload',
      JSON.stringify({
        ...JSON.parse(validSerializedSnapshot()),
        jobs: [
          {
            ...JSON.parse(validSerializedSnapshot()).jobs[0],
            output: { size: 1 },
          },
        ],
      }),
    ],
  ])('returns undefined for %s without throwing', (_label, value) => {
    expect(() => parseBulkSessionSnapshot(value)).not.toThrow();
    expect(parseBulkSessionSnapshot(value)).toBeUndefined();
  });

  it('parses valid snapshots and recomputes snapshot counters', () => {
    const source = session([
      job('a', { status: 'decoding' }),
      job('b', { status: 'exported', output: fakeOutput() }),
    ]);
    const parsed = parseBulkSessionSnapshot(
      JSON.stringify({ ...createBulkSessionSnapshot(source), activeJobs: 0 }),
    );

    expect(parsed?.activeJobs).toBe(1);
    expect(parsed?.exportedCount).toBe(1);
  });

  it('demotes active, encoded, and exported jobs on restore', () => {
    const source = session(
      [
        job('decoding', { status: 'decoding' }),
        job('processing', { status: 'processing' }),
        job('encoded', { status: 'encoded', output: fakeOutput() }),
        job('exported', { status: 'exported', output: fakeOutput() }),
        job('failed', { status: 'failed', error: 'bad' }),
        job('skipped', { status: 'skipped' }),
      ],
      { globalSettings: settings(), selectedJobId: 'exported' },
    );

    const restored = restoreBulkSessionSnapshot(
      createBulkSessionSnapshot(source),
    );

    expect(restored.jobs.map((item) => [item.id, item.status])).toEqual([
      ['decoding', 'queued'],
      ['processing', 'queued'],
      ['encoded', 'queued'],
      ['exported', 'queued'],
      ['failed', 'failed'],
      ['skipped', 'skipped'],
    ]);
    expect(restored.jobs.every((item) => item.output === undefined)).toBe(true);
    expect(restored.activeJobs).toBe(0);
    expect(restored.exportedCount).toBe(0);
    expect(restored.selectedJobId).toBe('exported');
  });

  it('falls back to the first restored job when the selected job is absent', () => {
    const snapshot = createBulkSessionSnapshot(session([job('a'), job('b')]));

    const restored = restoreBulkSessionSnapshot({
      ...snapshot,
      selectedJobId: 'missing',
    });

    expect(restored.selectedJobId).toBe('a');
  });

  it('restores serialized snapshots through the combined helper', () => {
    const restored = restoreSerializedBulkSessionSnapshot(
      validSerializedSnapshot(),
    );

    expect(restored?.jobs).toHaveLength(1);
    expect(restored?.jobs[0].sourceFile.name).toBe('a.jpg');
  });
});
