import { describe, expect, it, vi } from 'vitest';
import worker, { type Env } from '../../src/edge/worker.ts';

const ORIGIN = 'https://frisp.app';

function fakeEnv() {
  const assets = vi.fn(async () => new Response('asset', { status: 200 }));
  const writeDataPoint = vi.fn();
  const env: Env = { ASSETS: { fetch: assets }, USAGE: { writeDataPoint } };
  return { env, assets, writeDataPoint };
}

function post(
  body: string,
  headers: Record<string, string> = { Origin: ORIGIN },
): Request & { cf?: { country?: string } } {
  const request = new Request(`${ORIGIN}/api/usage`, {
    method: 'POST',
    headers,
    body,
  });
  return Object.assign(request, { cf: { country: 'NL' } });
}

async function expectSilent(response: Response): Promise<void> {
  expect(response.status).toBe(204);
  expect(await response.text()).toBe('');
}

describe('usage Worker', () => {
  it('writes one data point for a valid same-origin event', async () => {
    const { env, writeDataPoint } = fakeEnv();
    await expectSilent(
      await worker.fetch(
        post(JSON.stringify({ n: 'format', v: 'avif' }), {
          Origin: ORIGIN,
          'Sec-Fetch-Site': 'same-origin',
        }),
        env,
      ),
    );
    expect(writeDataPoint).toHaveBeenCalledExactlyOnceWith({
      blobs: ['format', 'avif', 'NL'],
      doubles: [1],
      indexes: ['format'],
    });
  });

  it('drops an unknown name, a wrong value and junk', async () => {
    const { env, writeDataPoint } = fakeEnv();
    for (const body of [
      JSON.stringify({ n: 'filename', v: 'avif' }),
      JSON.stringify({ n: 'format', v: 'bmp' }),
      JSON.stringify({ n: 'toString', v: 'x' }),
      'not json',
      'null',
    ]) {
      await expectSilent(await worker.fetch(post(body), env));
    }
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('drops a cross-origin or cross-site request', async () => {
    const { env, writeDataPoint } = fakeEnv();
    const body = JSON.stringify({ n: 'visit', v: 'browser' });
    await expectSilent(
      await worker.fetch(post(body, { Origin: 'https://evil.example' }), env),
    );
    await expectSilent(await worker.fetch(post(body, {}), env));
    await expectSilent(
      await worker.fetch(
        post(body, { Origin: ORIGIN, 'Sec-Fetch-Site': 'cross-site' }),
        env,
      ),
    );
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('drops an event sent to a preview host', async () => {
    const { env, writeDataPoint } = fakeEnv();
    const preview = 'https://abc123-frisp.example.workers.dev';
    const request = new Request(`${preview}/api/usage`, {
      method: 'POST',
      headers: { Origin: preview },
      body: JSON.stringify({ n: 'visit', v: 'browser' }),
    });
    await expectSilent(await worker.fetch(request, env));
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('drops a body over 256 bytes', async () => {
    const { env, writeDataPoint } = fakeEnv();
    const body = JSON.stringify({
      n: 'visit',
      v: 'browser',
      pad: 'x'.repeat(256),
    });
    await expectSilent(await worker.fetch(post(body), env));
    expect(writeDataPoint).not.toHaveBeenCalled();
  });

  it('answers 405 to any other method on the endpoint', async () => {
    const { env, assets } = fakeEnv();
    const response = await worker.fetch(
      new Request(`${ORIGIN}/api/usage`),
      env,
    );
    expect(response.status).toBe(405);
    expect(assets).not.toHaveBeenCalled();
  });

  it('hands every other path to the assets', async () => {
    const { env, assets, writeDataPoint } = fakeEnv();
    const request = new Request(`${ORIGIN}/nope`, { method: 'POST' });
    const response = await worker.fetch(request, env);
    expect(await response.text()).toBe('asset');
    expect(assets).toHaveBeenCalledExactlyOnceWith(request);
    expect(writeDataPoint).not.toHaveBeenCalled();
  });
});
