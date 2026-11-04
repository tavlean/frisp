import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { build } from 'vite';
import { afterAll, describe, expect, it } from 'vitest';
import { appAliases } from '../../vite.config';
import type { ProofInput, ProofReply } from '../node/pipeline-worker';

// The headless boundary, proven rather than promised: bundle the Node proof
// for Node (aliases resolved, codec artifacts left on disk), run it in a real
// worker_thread, and check the WebP it makes. A DOM reference anywhere in the
// pipeline core fails here, not in a CLI months later.

const root = resolve(import.meta.dirname, '../..');
const outDir = mkdtempSync(join(tmpdir(), 'frisp-node-proof-'));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

async function bundle(): Promise<string> {
  await build({
    configFile: false,
    logLevel: 'silent',
    resolve: { alias: appAliases },
    ssr: { noExternal: true, target: 'node' },
    build: {
      ssr: join(root, 'tests/node/pipeline-worker.ts'),
      outDir,
      emptyOutDir: true,
      minify: false,
      rollupOptions: { output: { entryFileNames: 'pipeline-worker.mjs' } },
    },
  });
  return join(outDir, 'pipeline-worker.mjs');
}

function run(entry: string, input: ProofInput): Promise<ProofReply> {
  return new Promise((done, fail) => {
    const worker = new Worker(entry, {
      workerData: input,
      // codecs/ has no package.json "type", so Node re-parses each ESM
      // artifact and says so; the noise hides real failures.
      execArgv: ['--disable-warning=MODULE_TYPELESS_PACKAGE_JSON'],
    });
    worker.once('message', (reply: ProofReply) => {
      void worker.terminate();
      done(reply);
    });
    worker.once('error', fail);
    worker.once('exit', (code) => {
      if (code !== 0) fail(Error(`proof worker exited with ${code}`));
    });
  });
}

describe('the pipeline core in a Node worker_thread', () => {
  it('decodes, rotates, resizes, grains, and encodes a JPEG to WebP', async () => {
    const reply = await run(await bundle(), {
      root,
      jpeg: join(root, 'tests/fixtures/photo.jpg'),
    });
    expect(reply.decoded).toEqual({ width: 1024, height: 683 });
    expect(reply.riff).toEqual(['RIFF', 'WEBP']);
    expect(reply.bytes).toBeGreaterThan(1000);
    // Rotated a quarter turn, then resized: 683x1024 to 342x512.
    expect(reply.roundTrip).toEqual({ width: 342, height: 512 });
  }, 60_000);
});
