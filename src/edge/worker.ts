// The app's Worker script. It exists for one endpoint: POST /api/usage counts
// an allowlisted anonymous event (src/shared/usage-events.ts) in Workers
// Analytics Engine. Everything else goes straight to the static assets, so
// `_headers`, the 404 page and caching behave as with no script at all.
// Requests that match an asset never reach this code; Cloudflare serves them
// first (see wrangler.jsonc).
//
// Privacy: a data point is the event name, its value and the country
// Cloudflare reports. No IP address, user agent, or identifier is read or
// stored. Every POST answers 204 with no body, valid or not, so the endpoint
// tells a caller nothing.
//
// Typed with local interfaces rather than @cloudflare/workers-types: the root
// tsconfig checks this file with DOM types, which cover Request and Response.

import { APP_HOST } from '#shared/brand.ts';
import {
  USAGE_PATH,
  isUsageEvent,
  isUsageValue,
} from '#shared/usage-events.ts';

const MAX_BODY_BYTES = 256;

export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  USAGE: {
    writeDataPoint(point: {
      blobs?: string[];
      doubles?: number[];
      indexes?: string[];
    }): void;
  };
}

type IncomingRequest = Request & { cf?: { country?: string } };

export default {
  async fetch(request: IncomingRequest, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== USAGE_PATH) return env.ASSETS.fetch(request);
    if (request.method !== 'POST') {
      return new Response(null, { status: 405, headers: { Allow: 'POST' } });
    }

    const event = isSameOrigin(request, url) ? await readEvent(request) : null;
    if (event) {
      try {
        env.USAGE.writeDataPoint({
          blobs: [event.name, event.value, request.cf?.country ?? ''],
          doubles: [1],
          indexes: [event.name],
        });
      } catch {
        // A lost count must never turn into an error the caller can see.
      }
    }
    return new Response(null, { status: 204 });
  },
};

// Only the production host counts: a preview version shares this dataset, and
// its test traffic must not land in the real numbers. sendBeacon always sends
// Origin on a POST. Sec-Fetch-Site is checked only when present because older
// browsers omit it.
function isSameOrigin(request: Request, url: URL): boolean {
  if (url.hostname !== APP_HOST) return false;
  if (request.headers.get('Origin') !== url.origin) return false;
  const site = request.headers.get('Sec-Fetch-Site');
  return site === null || site === 'same-origin';
}

async function readEvent(
  request: Request,
): Promise<{ name: string; value: string } | null> {
  const text = await readCapped(request);
  if (text === null) return null;
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== 'object' || body === null) return null;
  const { n, v } = body as { n?: unknown; v?: unknown };
  if (!isUsageEvent(n) || !isUsageValue(n, v)) return null;
  return { name: n, value: v };
}

// Reads the body without trusting Content-Length; null once it passes the cap.
async function readCapped(request: Request): Promise<string | null> {
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } catch {
    return null;
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
