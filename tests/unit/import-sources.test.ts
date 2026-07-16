import { describe, expect, it } from 'vitest';
import {
  fromDataTransfer,
  normalizeRelativePath,
  shouldSkipEntryName,
} from '../../src/lib/bulk/import-sources';

// ── fromDataTransfer fakes ──────────────────────────────────────────────
// The function only touches items (kind/webkitGetAsEntry/getAsFile) and the
// files list, so plain objects model every engine shape we care about.

interface FakeEntry {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
  fullPath: string;
  file?: (
    ok: (file: File) => void,
    err?: (error: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (ok: (entries: FakeEntry[]) => void) => void;
  };
}

function fileItem(file: File, entry?: FakeEntry | null) {
  return {
    kind: 'file',
    webkitGetAsEntry: () => (entry === undefined ? null : entry),
    getAsFile: () => file,
  };
}

function directoryItem(entry: FakeEntry) {
  return {
    kind: 'file',
    webkitGetAsEntry: () => entry,
    getAsFile: () => null,
  };
}

function fileEntry(file: File, fullPath: string): FakeEntry {
  return {
    isFile: true,
    isDirectory: false,
    name: file.name,
    fullPath,
    file: (ok) => ok(file),
  };
}

function directoryEntry(name: string, children: FakeEntry[]): FakeEntry {
  let drained = false;
  return {
    isFile: false,
    isDirectory: true,
    name,
    fullPath: `/${name}`,
    createReader: () => ({
      // Real readers return entries in batches and an empty batch at the end.
      readEntries: (ok) => {
        ok(drained ? [] : children);
        drained = true;
      },
    }),
  };
}

function fakeTransfer(items: unknown[] | undefined, files: File[] = []) {
  return { items, files } as unknown as DataTransfer;
}

describe('import source helpers', () => {
  it('skips dot-file and dot-directory entry names', () => {
    expect(shouldSkipEntryName('.DS_Store')).toBe(true);
    expect(shouldSkipEntryName('.hidden-folder')).toBe(true);
    expect(shouldSkipEntryName('photo.jpg')).toBe(false);
    expect(shouldSkipEntryName('nested.photo.jpg')).toBe(false);
  });

  it('normalizes relative paths for job metadata', () => {
    expect(normalizeRelativePath('/trip/day1/img.jpg')).toBe(
      'trip/day1/img.jpg',
    );
    expect(normalizeRelativePath('trip/day1/img.jpg')).toBe(
      'trip/day1/img.jpg',
    );
    expect(normalizeRelativePath('')).toBeUndefined();
    expect(normalizeRelativePath('/')).toBeUndefined();
    expect(normalizeRelativePath(undefined)).toBeUndefined();
  });
});

describe('fromDataTransfer', () => {
  const photo = new File(['a'], 'photo.jpg', { type: 'image/jpeg' });
  const chart = new File(['b'], 'chart.png', { type: 'image/png' });

  it('imports plain files in item order, without relative paths', async () => {
    const imported = await fromDataTransfer(
      fakeTransfer([fileItem(photo), fileItem(chart)]),
    );
    expect(imported).toEqual([{ file: photo }, { file: chart }]);
  });

  it('imports via getAsFile even when the item also exposes a file entry', async () => {
    // Safari can hand out entries whose async file() read fails
    // (NotFoundError) while getAsFile() works; entry-first reading turned
    // such drops into a silent no-op.
    const brokenEntry: FakeEntry = {
      isFile: true,
      isDirectory: false,
      name: photo.name,
      fullPath: `/${photo.name}`,
      file: (_ok, err) => err?.(new DOMException('missing', 'NotFoundError')),
    };
    const imported = await fromDataTransfer(
      fakeTransfer([fileItem(photo, brokenEntry)]),
    );
    expect(imported).toEqual([{ file: photo }]);
  });

  it('walks directory items recursively, keeping paths and skipping dot-files', async () => {
    const junk = new File([''], '.DS_Store');
    const trip = directoryEntry('trip', [
      fileEntry(photo, '/trip/photo.jpg'),
      fileEntry(junk, '/trip/.DS_Store'),
      directoryEntry('day2', [fileEntry(chart, '/trip/day2/chart.png')]),
    ]);

    const imported = await fromDataTransfer(
      fakeTransfer([directoryItem(trip)]),
    );
    expect(imported).toEqual([
      { file: photo, relativePath: 'trip/photo.jpg' },
      { file: chart, relativePath: 'trip/day2/chart.png' },
    ]);
  });

  it('skips a dot-file dropped on its own', async () => {
    const junk = new File([''], '.DS_Store');
    expect(await fromDataTransfer(fakeTransfer([fileItem(junk)]))).toEqual([]);
  });

  it('falls back to the files list when no items are readable', async () => {
    expect(await fromDataTransfer(fakeTransfer(undefined, [photo]))).toEqual([
      { file: photo },
    ]);
  });
});
