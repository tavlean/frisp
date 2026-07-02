import { describe, expect, it } from 'vitest';
import {
  normalizeRelativePath,
  shouldSkipEntryName,
} from '../../src/lib/bulk/import-sources';

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
