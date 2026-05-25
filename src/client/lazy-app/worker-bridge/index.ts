import { wrap } from 'comlink';
import { BridgeMethods, methodNames } from './meta';
import workerURL from 'omt:../../../features-worker';
import type { ProcessorWorkerApi } from '../../../features-worker';
import { abortable } from '../abort';

/** How long the worker should be idle before terminating. */
const workerTimeout = 10_000;

interface WorkerBridge extends BridgeMethods {}

type BridgeMethod = (
  this: WorkerBridge,
  signal: AbortSignal,
  ...args: unknown[]
) => Promise<unknown>;

class WorkerBridge {
  protected _queue = Promise.resolve() as Promise<unknown>;
  /** Worker instance associated with this processor. */
  protected _worker?: Worker;
  /** Comlinked worker API. */
  protected _workerApi?: ProcessorWorkerApi;
  /** ID from setTimeout */
  protected _workerTimeout?: number;

  protected _terminateWorker() {
    if (!this._worker) return;
    this._worker.terminate();
    this._worker = undefined;
    this._workerApi = undefined;
  }

  protected _startWorker() {
    this._worker = new Worker(workerURL);
    this._workerApi = wrap<ProcessorWorkerApi>(this._worker);
  }

  dispose(): void {
    clearTimeout(this._workerTimeout);
    this._workerTimeout = undefined;
    this._terminateWorker();
  }
}

for (const methodName of methodNames) {
  const bridgeMethod: BridgeMethod = function (
    this: WorkerBridge,
    signal: AbortSignal,
    ...args: unknown[]
  ) {
    this._queue = this._queue
      // Ignore any errors in the queue
      .catch(() => {})
      .then(async () => {
        if (signal.aborted) throw new DOMException('AbortError', 'AbortError');

        clearTimeout(this._workerTimeout);
        if (!this._worker) this._startWorker();

        const onAbort = () => this._terminateWorker();
        signal.addEventListener('abort', onAbort);

        const method = this._workerApi![methodName] as (
          ...args: unknown[]
        ) => Promise<unknown>;

        return abortable(signal, method(...args)).finally(() => {
          // No longer care about aborting - this task is complete.
          signal.removeEventListener('abort', onAbort);

          // Start a timer to clear up the worker.
          this._workerTimeout = setTimeout(() => {
            this._terminateWorker();
          }, workerTimeout);
        });
      });

    return this._queue;
  };
  (WorkerBridge.prototype as Record<typeof methodName, BridgeMethod>)[
    methodName
  ] = bridgeMethod;
}

export default WorkerBridge;
