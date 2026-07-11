// The SVG worker is owned here so it stays lazy, while aborting any job tears
// down the shared execution context and guarantees a later request starts clean.

import type { Config } from 'svgo/browser';
import type { SvgOptimizeJob, SvgOptimizeReply } from './svg-worker-protocol';

interface SvgOptimizeResult {
  svg: string;
  rawBytes: number;
  gzipBytes: number;
}

interface PendingJob {
  resolve: (result: SvgOptimizeResult) => void;
  reject: (reason?: unknown) => void;
  signal: AbortSignal;
  onAbort: () => void;
}

let worker: Worker | null = null;
let nextJobId = 1;
const pending = new Map<number, PendingJob>();

function rejectPending(reason: unknown): void {
  for (const job of pending.values()) {
    job.signal.removeEventListener('abort', job.onAbort);
    job.reject(reason);
  }
  pending.clear();
}

function terminate(reason: unknown): void {
  worker?.terminate();
  worker = null;
  rejectPending(reason);
}

function getWorker(): Worker {
  if (worker) return worker;
  worker = new Worker(new URL('./svg-optimizer.worker.ts', import.meta.url), {
    type: 'module',
  });
  worker.onmessage = ({ data }: MessageEvent<SvgOptimizeReply>) => {
    const job = pending.get(data.id);
    if (!job) return;
    pending.delete(data.id);
    job.signal.removeEventListener('abort', job.onAbort);
    if (data.ok) {
      job.resolve({
        svg: data.svg!,
        rawBytes: data.rawBytes!,
        gzipBytes: data.gzipBytes!,
      });
    } else {
      job.reject(Error(data.error));
    }
  };
  return worker;
}

export function optimizeSvg(
  source: string,
  config: Config,
  signal: AbortSignal,
): Promise<SvgOptimizeResult> {
  signal.throwIfAborted();
  const id = nextJobId++;
  return new Promise((resolve, reject) => {
    const onAbort = () => terminate(signal.reason);
    pending.set(id, { resolve, reject, signal, onAbort });
    signal.addEventListener('abort', onAbort, { once: true });
    const job: SvgOptimizeJob = { id, source, config };
    getWorker().postMessage(job);
  });
}
