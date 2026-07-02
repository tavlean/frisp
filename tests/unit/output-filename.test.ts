import { describe, expect, it } from 'vitest';
import {
  getFileNameParts,
  getOutputFileName,
  getSafeFileNameBase,
} from '../../src/client/lazy-app/output-filename';

describe('output filename helpers', () => {
  it.each([
    ['con', 'con-file'],
    ['NUL.txt', 'NUL-file'],
    ['com1', 'com1-file'],
    ['LPT9.png', 'LPT9-file'],
  ])('protects reserved Windows base name %s', (input, expected) => {
    expect(getSafeFileNameBase(input)).toBe(expected);
  });

  it('strips paths and sanitizes illegal, control, and repeated separator characters', () => {
    expect(getSafeFileNameBase('../bad: name*\n?.png')).toBe('bad-name');
    expect(getSafeFileNameBase('C:\\temp\\a / b <> c.jpg')).toBe('b-c');
  });

  it('uses the fallback for blank or fully stripped path names', () => {
    expect(getSafeFileNameBase('   ', 'fallback')).toBe('fallback');
    expect(getSafeFileNameBase('///', 'fallback')).toBe('fallback');
  });

  it('keeps dotfiles as extensionless base names', () => {
    expect(getFileNameParts('.env')).toEqual({
      baseName: '.env',
      extension: '',
    });
  });

  it('derives output names with normalized extensions', () => {
    expect(getOutputFileName('photo.jpeg', '.webp')).toBe('photo.webp');
    expect(getOutputFileName('photo.jpeg', '')).toBe('photo');
  });
});
