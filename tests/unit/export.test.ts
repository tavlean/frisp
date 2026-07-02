import { describe, expect, it } from 'vitest';
import {
  canExportBulkSession,
  createBulkExportPlan,
  getBulkExportEntries,
  getBulkExportName,
  getBulkExportSummary,
  getBulkJobSizeSummary,
  getBulkOutputFileName,
  getBulkOutputSummary,
  markBulkExportPlanExported,
} from '../../src/client/lazy-app/bulk/export';
import { settingsHash } from '../../src/client/lazy-app/bulk/settings';
import { fakeOutput, job, session, settings } from './fixtures';

describe('bulk export selectors', () => {
  it('deduplicates duplicate output names case-insensitively while preserving extensions', () => {
    const current = session([
      job('a', {
        fileName: 'Photo.JPG',
        status: 'encoded',
        output: fakeOutput({ fileName: 'ignored.webp', url: 'blob:a' }),
      }),
      job('b', {
        fileName: 'photo.png',
        status: 'encoded',
        output: fakeOutput({ fileName: 'second.webp', url: 'blob:b' }),
      }),
      job('c', {
        fileName: 'PHOTO.tif',
        status: 'encoded',
        output: fakeOutput({ fileName: 'third.avif', url: 'blob:c' }),
      }),
    ]);

    expect(
      getBulkExportEntries(current).map((entry) => entry.fileName),
    ).toEqual(['Photo.webp', 'photo-2.webp', 'PHOTO.avif']);
  });

  it('filters export entries by requested job ids and skips stale outputs', () => {
    const freshSettings = settings();
    const staleSettings = settings({
      processorState: {
        ...freshSettings.processorState,
        resize: { ...freshSettings.processorState.resize, enabled: true },
      },
    });
    const current = session(
      [
        job('fresh', {
          status: 'encoded',
          output: fakeOutput({ hash: settingsHash(freshSettings) }),
        }),
        job('stale', {
          status: 'encoded',
          output: fakeOutput({ hash: settingsHash(staleSettings) }),
        }),
      ],
      { globalSettings: freshSettings },
    );

    expect(getBulkExportEntries(current, ['fresh', 'stale'])).toHaveLength(1);
    expect(canExportBulkSession(current, ['stale'])).toBe(false);
  });

  it('summarizes missing, stale, and optimized job sizes', () => {
    const freshSettings = settings();
    const staleHash = settingsHash(
      settings({
        processorState: {
          ...freshSettings.processorState,
          resize: { ...freshSettings.processorState.resize, width: 200 },
        },
      }),
    );
    const missing = job('missing', { fileSize: 100 });
    const stale = job('stale', {
      fileSize: 100,
      status: 'encoded',
      output: fakeOutput({ fileSize: 70, hash: staleHash }),
    });
    const optimized = job('optimized', {
      fileSize: 100,
      status: 'encoded',
      output: fakeOutput({ fileSize: 50, hash: settingsHash(freshSettings) }),
    });
    const current = session([missing, stale, optimized], {
      globalSettings: freshSettings,
    });

    expect(getBulkJobSizeSummary(current, missing)).toMatchObject({
      outputState: 'missing',
      originalSize: 100,
    });
    expect(getBulkJobSizeSummary(current, stale)).toMatchObject({
      outputState: 'stale',
    });
    expect(getBulkJobSizeSummary(current, optimized)).toMatchObject({
      outputState: 'optimized',
      outputSize: 50,
      percentChange: -50,
    });
  });

  it('summarizes export readiness and optimized outputs', () => {
    const current = session([
      job('ready', {
        fileSize: 100,
        status: 'encoded',
        output: fakeOutput({ fileSize: 40 }),
      }),
      job('exported', {
        fileSize: 80,
        status: 'exported',
        output: fakeOutput({ fileSize: 60 }),
      }),
      job('failed', { status: 'failed' }),
      job('skipped', { status: 'skipped' }),
      job('pending'),
    ]);

    expect(getBulkExportSummary(current)).toMatchObject({
      ready: 1,
      exported: 1,
      failed: 1,
      skipped: 1,
      pending: 1,
      totalOriginalSize: 100,
      totalOutputSize: 40,
      percentChange: -60,
    });
    expect(getBulkOutputSummary(current)).toMatchObject({
      optimized: 2,
      stale: 0,
      totalOriginalSize: 180,
      totalOutputSize: 100,
    });
  });

  it('derives safe archive and output file names', () => {
    const current = session(
      [
        job('a', {
          fileName: '../CON.jpg',
          status: 'encoded',
          output: fakeOutput({ fileName: 'encoded.webp' }),
        }),
      ],
      { id: 'A:/Batch?' },
    );

    expect(getBulkExportName(current)).toBe('Batch-optimized');
    expect(getBulkOutputFileName(current.jobs[0])).toBe('CON-file.webp');
  });

  it('marks only plan entries as exported when their outputs are current', () => {
    const current = session([
      job('a', { status: 'encoded', output: fakeOutput() }),
      job('b', { status: 'encoded', output: fakeOutput() }),
    ]);
    const plan = createBulkExportPlan(current, ['b']);

    const next = markBulkExportPlanExported(current, plan);

    expect(next.jobs.map((item) => [item.id, item.status])).toEqual([
      ['a', 'encoded'],
      ['b', 'exported'],
    ]);
    expect(next.exportedCount).toBe(1);
  });
});
