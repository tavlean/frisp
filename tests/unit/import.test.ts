import { describe, expect, it } from 'vitest';
import {
  addBulkImportToSession,
  createBulkSessionFromImport,
  createImageJobs,
  createImageJobsWithMimeSniffing,
  getBulkImportSummary,
  isSupportedBulkImage,
} from '../../src/client/lazy-app/bulk/import';
import { fakeFile, session, settings } from './fixtures';

describe('bulk import helpers', () => {
  it('accepts image MIME types and known image extensions', () => {
    expect(
      isSupportedBulkImage(fakeFile('photo.bin', { type: 'image/png' })),
    ).toBe(true);
    expect(isSupportedBulkImage(fakeFile('photo.JXL', { type: '' }))).toBe(
      true,
    );
    expect(
      isSupportedBulkImage(fakeFile('notes.txt', { type: 'text/plain' })),
    ).toBe(false);
  });

  it('partitions accepted and unsupported files synchronously', () => {
    const accepted = fakeFile('photo.jpg', { size: 10 });
    const rejected = fakeFile('notes.txt', { size: 20, type: 'text/plain' });

    const result = createImageJobs([accepted, rejected]);

    expect(result.accepted).toHaveLength(1);
    expect(result.accepted[0].id).toBe('0-photo.jpg-10-1700000000000');
    expect(result.rejections).toEqual([
      { file: rejected, reason: 'unsupported-type' },
    ]);
  });

  it('uses MIME sniffing for extensionless files and records sniffer failures', async () => {
    const detected = fakeFile('camera-data', { size: 10, type: '' });
    const rejected = fakeFile('text-data', { size: 20, type: '' });
    const unreadable = fakeFile('locked-data', { size: 30, type: '' });

    const result = await createImageJobsWithMimeSniffing(
      [detected, rejected, unreadable],
      async (file) => {
        if (file === unreadable) throw new Error('nope');
        if (file === detected) return 'image/avif';
        return 'text/plain';
      },
    );

    expect(result.accepted.map((item) => item.sourceFile)).toEqual([detected]);
    expect(result.rejections).toEqual([
      { file: rejected, reason: 'unsupported-type' },
      { file: unreadable, reason: 'unreadable' },
    ]);
  });

  it('summarizes accepted and rejected bytes by reason', () => {
    const result = createImageJobs([
      fakeFile('photo.jpg', { size: 10 }),
      fakeFile('notes.txt', { size: 20, type: 'text/plain' }),
    ]);

    expect(getBulkImportSummary(result)).toEqual({
      accepted: 1,
      rejected: 1,
      rejectedUnsupported: 1,
      rejectedUnreadable: 0,
      totalAcceptedSize: 10,
      totalRejectedSize: 20,
    });
  });

  it('creates and appends sessions from import results', () => {
    const result = createImageJobs([fakeFile('a.jpg'), fakeFile('b.png')]);

    const importedSession = createBulkSessionFromImport(
      'imported',
      settings(),
      result,
    );
    const appendedSession = addBulkImportToSession(session([]), result);

    expect(importedSession.jobs.map((item) => item.sourceFile.name)).toEqual([
      'a.jpg',
      'b.png',
    ]);
    expect(appendedSession.jobs).toHaveLength(2);
  });
});
