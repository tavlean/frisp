// Anonymous, first-party usage counting: one beacon per allowlisted event to
// the app's own Worker (src/edge/worker.ts), which counts it in the
// maintainer's Cloudflare account. Exists so the maintainer can see how many
// people use the app and which controls they reach for. Images never leave
// the device; a beacon carries only the event name and one value from
// src/shared/usage-events.ts.
//
// Silent by design: off anywhere but the production host and under Do Not
// Track or Global Privacy Control, never throws, never awaits, and a missing
// or failing endpoint changes nothing for the user (offline included).
//
// Every event except `open` and `download` is sent at most once per page load,
// so its count reads "page loads that did this". `session` is keyed on the
// name alone: one per page load, whatever the first open was.

import { APP_HOST } from '#shared/brand.ts';
import {
  USAGE_PATH,
  formatValue,
  type UsageEvent,
  type UsageValue,
} from '#shared/usage-events.ts';

export type Track = <N extends UsageEvent>(
  name: N,
  value: UsageValue<N>,
) => void;

export interface TrackerEnv {
  hostname: string;
  globalPrivacyControl?: boolean;
  doNotTrack?: string | null;
  sendBeacon?: (url: string, data: string) => boolean;
}

const EVERY_CALL: ReadonlySet<UsageEvent> = new Set(['open', 'download']);

export function createTracker(env: TrackerEnv | null): Track {
  const send =
    env &&
    env.hostname === APP_HOST &&
    env.globalPrivacyControl !== true &&
    env.doNotTrack !== '1'
      ? env.sendBeacon
      : undefined;
  const sent = new Set<string>();

  return (name, value) => {
    if (!send) return;
    if (!EVERY_CALL.has(name)) {
      const key = name === 'session' ? name : `${name}:${value}`;
      if (sent.has(key)) return;
      sent.add(key);
    }
    try {
      send(USAGE_PATH, JSON.stringify({ n: name, v: value }));
    } catch {
      // A blocked or failing beacon is not the user's problem.
    }
  };
}

// Read once at load: a page load is the unit every deduped count is per.
export const track: Track = createTracker(
  typeof navigator === 'undefined' || typeof location === 'undefined'
    ? null
    : {
        hostname: location.hostname,
        globalPrivacyControl: (
          navigator as Navigator & { globalPrivacyControl?: boolean }
        ).globalPrivacyControl,
        doNotTrack: navigator.doNotTrack,
        sendBeacon:
          typeof navigator.sendBeacon === 'function'
            ? (url, data) => navigator.sendBeacon(url, data)
            : undefined,
      },
);

/** Counts an image open: `session` once per page load, `open` and `source`
 *  per the rules above. */
export function trackOpen(
  mode: UsageValue<'open'>,
  source: UsageValue<'source'>,
): void {
  track('session', mode);
  track('open', mode);
  track('source', source);
}

/** Counts a user's format pick; ignores Original and formats not offered. */
export function trackFormat(format: string): void {
  const value = formatValue(format);
  if (value) track('format', value);
}

/** Counts a saved result by its format; ignores the untouched original. */
export function trackDownload(format: string): void {
  const value = formatValue(format);
  if (value) track('download', value);
}
