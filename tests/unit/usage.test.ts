import { describe, expect, it, vi } from 'vitest';
import { OUTPUT_FORMATS } from '#lib/compress.ts';
import { createTracker, type TrackerEnv } from '#lib/usage.ts';
import { APP_HOST } from '#shared/brand.ts';
import { USAGE_EVENTS, formatValue } from '#shared/usage-events.ts';

function tracker(env: Partial<TrackerEnv> = {}) {
  const sendBeacon = vi.fn((_url: string, _data: string) => true);
  const track = createTracker({ hostname: APP_HOST, sendBeacon, ...env });
  const sent = () =>
    sendBeacon.mock.calls.map(([url, data]) => {
      expect(url).toBe('/api/usage');
      return JSON.parse(data) as { n: string; v: string };
    });
  return { track, sendBeacon, sent };
}

describe('usage allowlist', () => {
  it('lists exactly the formats the editor offers, plus svg', () => {
    expect([...USAGE_EVENTS.format].sort()).toEqual(
      [...OUTPUT_FORMATS.map((f) => f.id.toLowerCase()), 'svg'].sort(),
    );
  });

  it('maps editor format ids and ignores the rest', () => {
    expect(formatValue('webP')).toBe('webp');
    expect(formatValue('oxiPNG')).toBe('oxipng');
    expect(formatValue('identity')).toBeNull();
    expect(formatValue('mozJPEG')).toBeNull();
  });
});

describe('track', () => {
  it('sends the pair as a tiny JSON body on the production host', () => {
    const { track, sent } = tracker();
    track('format', 'avif');
    expect(sent()).toEqual([{ n: 'format', v: 'avif' }]);
  });

  it('sends nothing off the production host', () => {
    for (const hostname of [
      'localhost',
      '127.0.0.1',
      'abc123-frisp.slift.workers.dev',
    ]) {
      const { track, sendBeacon } = tracker({ hostname });
      track('visit', 'browser');
      track('open', 'single');
      expect(sendBeacon).not.toHaveBeenCalled();
    }
    expect(() => createTracker(null)('visit', 'browser')).not.toThrow();
  });

  it('sends nothing under Global Privacy Control or Do Not Track', () => {
    const gpc = tracker({ globalPrivacyControl: true });
    gpc.track('visit', 'browser');
    expect(gpc.sendBeacon).not.toHaveBeenCalled();

    const dnt = tracker({ doNotTrack: '1' });
    dnt.track('visit', 'browser');
    expect(dnt.sendBeacon).not.toHaveBeenCalled();

    const off = tracker({ globalPrivacyControl: false, doNotTrack: '0' });
    off.track('visit', 'browser');
    expect(off.sendBeacon).toHaveBeenCalledOnce();
  });

  it('sends a deduped pair once per page load', () => {
    const { track, sent } = tracker();
    track('option', 'resize');
    track('option', 'resize');
    track('option', 'grain');
    track('format', 'webp');
    track('format', 'webp');
    expect(sent()).toEqual([
      { n: 'option', v: 'resize' },
      { n: 'option', v: 'grain' },
      { n: 'format', v: 'webp' },
    ]);
  });

  it('sends one session per page load, whatever the mode', () => {
    const { track, sent } = tracker();
    track('session', 'single');
    track('session', 'bulk');
    expect(sent()).toEqual([{ n: 'session', v: 'single' }]);
  });

  it('sends every open and download', () => {
    const { track, sent } = tracker();
    track('open', 'single');
    track('open', 'single');
    track('download', 'zip');
    track('download', 'zip');
    expect(sent()).toHaveLength(4);
  });

  it('never throws when the beacon does', () => {
    const track = createTracker({
      hostname: APP_HOST,
      sendBeacon: () => {
        throw new TypeError('blocked');
      },
    });
    expect(() => track('open', 'bulk')).not.toThrow();
  });
});
