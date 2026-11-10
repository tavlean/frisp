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
// Two more things keep the numbers about real visitors. A browser can opt
// out for good by opening the site with `?usage=off` (`?usage=on` undoes it);
// the maintainer does this on his own devices. And a browser driven by
// automation (`navigator.webdriver`) never sends, which covers the checks run
// against production after a deploy.
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
  /** This browser opened the site with `?usage=off` at some point. */
  optedOut?: boolean;
  /** `navigator.webdriver`: a test tool is driving the browser. */
  automated?: boolean;
  sendBeacon?: (url: string, data: string) => boolean;
}

const EVERY_CALL: ReadonlySet<UsageEvent> = new Set(['open', 'download']);

export function createTracker(env: TrackerEnv | null): Track {
  const send =
    env &&
    env.hostname === APP_HOST &&
    env.globalPrivacyControl !== true &&
    env.doNotTrack !== '1' &&
    !env.optedOut &&
    !env.automated
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

const OPT_OUT_KEY = 'app:usage-off';

/** Applies a `?usage=off` or `?usage=on` in the address to the stored flag,
 *  then reports the flag. Storage that throws (private modes) reads as not
 *  opted out; such a browser can use Do Not Track instead. */
export function readOptOut(
  search: string,
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>,
): boolean {
  try {
    const choice = new URLSearchParams(search).get('usage');
    if (choice === 'off') storage.setItem(OPT_OUT_KEY, '1');
    else if (choice === 'on') storage.removeItem(OPT_OUT_KEY);
    return storage.getItem(OPT_OUT_KEY) === '1';
  } catch {
    return false;
  }
}

// Reading `localStorage` itself can throw where storage is blocked.
function storedOptOut(): boolean {
  try {
    return readOptOut(location.search, localStorage);
  } catch {
    return false;
  }
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
        optedOut: storedOptOut(),
        automated: navigator.webdriver === true,
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
