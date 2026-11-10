import { describe, expect, it, vi } from 'vitest';
import { optimizeImage } from '$lib/optimize-image';
import type { BulkRunnerHost } from '../../src/lib/bulk/runtime';
import { BulkRuntime, bulkThreadBudget } from '../../src/lib/bulk/runtime';
import SvelteKitWorkerBridge from '$lib/sveltekit-worker-bridge';
import type { ImageJob, ImageOutput } from '../../src/client/lazy-app/bulk';
import { fakeOutput, job, session } from './fixtures';

vi.mock('$lib/sveltekit-worker-bridge', () => ({
  default: class FakeSvelteKitWorkerBridge {
    static options: unknown[] = [];
    constructor(options?: unknown) {
      FakeSvelteKitWorkerBridge.options.push(options);
    }
    dispose(): void {}
  },
}));

vi.mock('$lib/optimize-image', () => ({ optimizeImage: vi.fn() }));

type ResolveJob = (output?: ImageOutput) => void;

function createHost(jobs: ImageJob[]): BulkRunnerHost {
  return { session: session(jobs) };
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 6; i++) await Promise.resolve();
}

/**
 * A job "starts" when the runtime calls optimizeImage for it (synchronously
 * inside run()), and finishes when the test resolves it: the encode the
 * runtime awaits is that job's pending promise.
 */
function installControlledProcessor(starts: string[] = []) {
  const resolvers = new Map<string, ResolveJob>();
  const rejecters = new Map<string, (error: unknown) => void>();
  const idOf = (file: File) => file.name.replace(/\.jpg$/, '');

  vi.mocked(optimizeImage).mockImplementation((source, _recipe, { signal }) => {
    if (signal.aborted) {
      return Promise.reject(new DOMException('AbortError', 'AbortError'));
    }
    const id = idOf(source.file);
    starts.push(id);
    const pass = new Promise((resolve, reject) => {
      const onAbort = () => {
        reject(new DOMException('AbortError', 'AbortError'));
      };
      signal.addEventListener('abort', onAbort, { once: true });
      resolvers.set(
        id,
        (output = fakeOutput({ fileName: `${id}.webp` })) => {
          signal.removeEventListener('abort', onAbort);
          resolve({
            outputFile: output.file,
            outputUrl: output.downloadUrl,
            outputSize: output.size,
          });
        },
      );
      rejecters.set(id, (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      });
    });
    return pass as ReturnType<typeof optimizeImage>;
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

  it('a run requested right after a cancel restarts the drain', async () => {
    const runtime = new BulkRuntime();
    const host = createHost([job('a'), job('b'), job('c')]);
    const processor = installControlledProcessor();

    const first = runtime.run(host);
    expect(processor.starts).toEqual(['a', 'b']);

    // The store removes an active image: cancel, then ask for a new run
    // before the aborted loop has unwound.
    runtime.cancelProcessing(host);
    const second = runtime.run(host);
    await first;
    await flushMicrotasks();

    expect(processor.starts).toEqual(['a', 'b', 'a', 'b']);
    processor.resolve('a');
    processor.resolve('b');
    await flushMicrotasks();
    processor.resolve('c');
    await second;
    expect(host.session.jobs.map((item) => item.status)).toEqual([
      'encoded',
      'encoded',
      'encoded',
    ]);
  });

  it('asks the host to requeue a job that finished under superseded settings', async () => {
    const runtime = new BulkRuntime();
    let recipe = 'v1';
    const requeueStale = vi.fn();
    const host: BulkRunnerHost = {
      ...createHost([job('a')]),
      settingsHashForJob: () => recipe,
      requeueStale,
    };
    const processor = installControlledProcessor();

    const run = runtime.run(host);
    expect(processor.starts).toEqual(['a']);
    recipe = 'v2';
    processor.resolve('a');
    await run;

    expect(host.session.jobs[0].output?.settingsHash).toBe('v1');
    expect(requeueStale).toHaveBeenCalledTimes(1);
  });

  it('does not requeue a job whose settings held for the whole pass', async () => {
    const runtime = new BulkRuntime();
    const requeueStale = vi.fn();
    const host: BulkRunnerHost = {
      ...createHost([job('a')]),
      settingsHashForJob: () => 'v1',
      requeueStale,
    };
    const processor = installControlledProcessor();

    const run = runtime.run(host);
    processor.resolve('a');
    await run;

    expect(requeueStale).not.toHaveBeenCalled();
  });
});

describe('bulk thread budget', () => {
  it('splits the cores between the two slots, never below one', () => {
    expect(bulkThreadBudget(12)).toBe(6);
    expect(bulkThreadBudget(11)).toBe(5);
    expect(bulkThreadBudget(2)).toBe(1);
    expect(bulkThreadBudget(1)).toBe(1);
    expect(bulkThreadBudget(16, 4)).toBe(4);
  });

  it('builds each slot bridge with that budget', async () => {
    const fake = SvelteKitWorkerBridge as unknown as { options: unknown[] };
    fake.options.length = 0;
    const processor = installControlledProcessor();
    const host = createHost([job('a'), job('b')]);
    const runtime = new BulkRuntime();
    const run = runtime.run(host);
    await flushMicrotasks();
    processor.resolve('a');
    processor.resolve('b');
    await run;
    const threads = bulkThreadBudget(navigator.hardwareConcurrency);
    expect(fake.options).toEqual([{ threads }, { threads }]);
  });
});
