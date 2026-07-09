import { describe, expect, it, vi } from 'vitest';
import { processBulkImageJob } from 'client/lazy-app/bulk';
import type { BulkRunnerHost } from '../../src/lib/bulk/runtime';
import { BulkRuntime } from '../../src/lib/bulk/runtime';
import type { ImageJob, ImageOutput } from '../../src/client/lazy-app/bulk';
import { fakeOutput, job, session } from './fixtures';

vi.mock(
  '$lib/sveltekit-worker-bridge',
  () => ({
    default: class FakeSvelteKitWorkerBridge {
      dispose(): void {}
    },
  }),
  { virtual: true },
);

vi.mock('client/lazy-app/bulk', async () => {
  const actual = await vi.importActual<typeof import('client/lazy-app/bulk')>(
    'client/lazy-app/bulk',
  );
  return {
    ...actual,
    processBulkImageJob: vi.fn(),
  };
});

type ResolveJob = (output?: ImageOutput) => void;

function createHost(jobs: ImageJob[]): BulkRunnerHost {
  return {
    session: session(jobs),
    createOutputDownloadUrl: (file) => `blob:${file.name}`,
  };
}

async function flushMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function installControlledProcessor(starts: string[] = []) {
  const resolvers = new Map<string, ResolveJob>();
  const rejecters = new Map<string, (error: unknown) => void>();

  vi.mocked(processBulkImageJob).mockImplementation(({ job, signal }) => {
    starts.push(job.id);
    return new Promise<ImageOutput>((resolve, reject) => {
      const onAbort = () => {
        reject(new DOMException('AbortError', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      resolvers.set(
        job.id,
        (output = fakeOutput({ fileName: `${job.id}.webp` })) => {
          signal.removeEventListener('abort', onAbort);
          resolve(output);
        },
      );
      rejecters.set(job.id, (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
    });
  });

  return {
    starts,
    resolve(jobId: string): void {
      const resolve = resolvers.get(jobId);
      if (!resolve) throw Error(`Job ${jobId} was not started`);
      resolve();
    },
    reject(jobId: string, error: unknown): void {
      const reject = rejecters.get(jobId);
      if (!reject) throw Error(`Job ${jobId} was not started`);
      reject(error);
    },
  };
}

describe('bulk runtime', () => {
  it("slow-job-doesn't-block", async () => {
    const runtime = new BulkRuntime();
    const host = createHost([job('a'), job('b'), job('c')]);
    const processor = installControlledProcessor();

    const run = runtime.run(host);
    expect(processor.starts).toEqual(['a', 'b']);

    processor.resolve('b');
    await flushMicrotasks();

    expect(processor.starts).toEqual(['a', 'b', 'c']);
    expect(host.session.jobs.map((item) => [item.id, item.status])).toEqual([
      ['a', 'processing'],
      ['b', 'encoded'],
      ['c', 'processing'],
    ]);

    processor.resolve('c');
    processor.resolve('a');
    await run;

    expect(host.session.jobs.map((item) => item.status)).toEqual([
      'encoded',
      'encoded',
      'encoded',
    ]);
  });

  it('cancel-mid-drain requeues', async () => {
    const runtime = new BulkRuntime();
    const host = createHost([job('a'), job('b'), job('c')]);
    const processor = installControlledProcessor();

    const run = runtime.run(host);
    expect(processor.starts).toEqual(['a', 'b']);

    runtime.cancelProcessing(host);
    await run;

    expect(host.session.activeJobs).toBe(0);
    expect(host.session.jobs.map((item) => item.status)).toEqual([
      'queued',
      'queued',
      'queued',
    ]);
  });

  it('rerun-requested drains new jobs', async () => {
    const runtime = new BulkRuntime();
    const host = createHost([job('a'), job('b')]);
    const processor = installControlledProcessor();

    const run = runtime.run(host);
    expect(processor.starts).toEqual(['a', 'b']);

    processor.resolve('b');
    await flushMicrotasks();
    expect(processor.starts).toEqual(['a', 'b']);

    host.session = {
      ...host.session,
      jobs: [...host.session.jobs, job('c')],
    };
    await runtime.run(host);

    processor.resolve('a');
    await flushMicrotasks();
    expect(processor.starts).toEqual(['a', 'b', 'c']);

    processor.resolve('c');
    await run;

    expect(host.session.jobs.map((item) => [item.id, item.status])).toEqual([
      ['a', 'encoded'],
      ['b', 'encoded'],
      ['c', 'encoded'],
    ]);
  });
});
