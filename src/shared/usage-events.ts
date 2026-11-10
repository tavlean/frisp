// The complete allowlist of anonymous usage events: each event name and the
// only values it may carry. The client (src/lib/usage.ts) types `track` from
// it and the Worker (src/edge/worker.ts) drops anything outside it, so the two
// share this one file and cannot drift. A new event or value is a change here
// and nowhere else.
//
// Must stay free of browser and Worker APIs: both runtimes import it.

/** The output format ids the editor offers, lowercased. `svg` is offered for
 *  SVG sources only. tests/unit/usage.test.ts fails when this list and
 *  OUTPUT_FORMATS (src/lib/compress.ts) disagree; that registry cannot be
 *  imported here because it pulls codec metadata into the Worker. */
const FORMATS = ['webp', 'avif', 'jxl', 'jpegli', 'oxipng', 'svg'] as const;

export const USAGE_EVENTS = {
  visit: ['browser', 'installed'],
  session: ['single', 'bulk'],
  open: ['single', 'bulk'],
  source: ['pick', 'drop', 'paste'],
  format: FORMATS,
  option: ['resize', 'grain', 'palette', 'auto-quality', 'compare', 'rotate'],
  download: [...FORMATS, 'zip', 'share'],
} as const satisfies Record<string, readonly string[]>;

export const USAGE_PATH = '/api/usage';

export type UsageEvent = keyof typeof USAGE_EVENTS;
export type UsageValue<N extends UsageEvent> = (typeof USAGE_EVENTS)[N][number];
export type FormatValue = UsageValue<'format'>;

export function isUsageEvent(name: unknown): name is UsageEvent {
  return typeof name === 'string' && Object.hasOwn(USAGE_EVENTS, name);
}

export function isUsageValue<N extends UsageEvent>(
  name: N,
  value: unknown,
): value is UsageValue<N> {
  return (USAGE_EVENTS[name] as readonly unknown[]).includes(value);
}

/** The usage value for an editor format id (`webP` → `webp`), or null for
 *  one the editor does not offer (Original, legacy MozJPEG saves). */
export function formatValue(format: string): FormatValue | null {
  const value = format.toLowerCase();
  return isUsageValue('format', value) ? value : null;
}
