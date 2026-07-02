export const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];

// Decimal (SI, base-1000), 3 significant figures — matches Results.svelte so
// sizes read identically across the app.
export function prettySize(bytes: number): string {
  if (bytes < 1) return '0 B';
  const exponent = Math.min(
    Math.floor(Math.log10(bytes) / 3),
    SIZE_UNITS.length - 1,
  );
  return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
}

// The footer's leading figure: value + unit split so the unit can echo the
// production footer's smaller accented unit glyph.
export function prettySizeParts(bytes: number): {
  value: string;
  unit: string;
} {
  if (bytes < 1) return { value: '0', unit: 'B' };
  const exponent = Math.min(
    Math.floor(Math.log10(bytes) / 3),
    SIZE_UNITS.length - 1,
  );
  return {
    value: (bytes / 1000 ** exponent).toPrecision(3),
    unit: SIZE_UNITS[exponent],
  };
}
