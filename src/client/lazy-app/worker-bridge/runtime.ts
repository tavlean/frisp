import { wrap } from 'comlink';
import { abortable } from '../abort';

/** How long the worker should be idle before terminating. Upstream Squoosh
 * used 10s, but respawning is pricier here: the threaded codecs re-instantiate
 * their WASM and re-spawn a full pthread pool, so a slider tweak after a short
 * pause paid a cold-start. 60s keeps the worker warm across natural editing
 * pauses while still releasing memory on a genuinely idle tab. */
const workerTimeout = 60_000;

export type WorkerBridgeInstance<MethodName extends string> = {
  [Method in MethodName]: (
    signal: AbortSignal,
    ...args: unknown[]
  ) => Promise<unknown>;
} & {
  dispose(): void;
};

export type WorkerBridgeConstructor<MethodName extends string> =
  new () => WorkerBridgeInstance<MethodName>;

type WorkerApi<MethodName extends string> = Record<
  MethodName,
  (...args: unknown[]) => Promise<unknown>
>;

type BridgeMethod<MethodName extends string> = (
  this: WorkerBridgeInstance<MethodName> & WorkerBridgeRuntime<MethodName>,
  signal: AbortSignal,
  ...args: unknown[]
) => Promise<unknown>;

interface WorkerBridgeRuntime<MethodName extends string> {
  _queue: Promise<unknown>;
  _worker?: Worker;
  _workerApi?: WorkerApi<MethodName>;
  _workerTimeout?: ReturnType<typeof setTimeout>;
  _terminateWorker(): void;
  _startWorker(): void;
}

export function createWorkerBridgeRuntime<MethodName extends string>(
  methodNames: readonly MethodName[],
  createWorker: () => Worker,
): WorkerBridgeConstructor<MethodName> {
  class GeneratedWorkerBridge implements WorkerBridgeRuntime<MethodName> {
    _queue = Promise.resolve() as Promise<unknown>;
    _worker?: Worker;
    _workerApi?: WorkerApi<MethodName>;
    _workerTimeout?: ReturnType<typeof setTimeout>;

    _terminateWorker() {
      if (!this._worker) return;
      this._worker.terminate();
      this._worker = undefined;
      this._workerApi = undefined;
    }

    _startWorker() {
      this._worker = createWorker();
      this._workerApi = wrap<WorkerApi<MethodName>>(this._worker);
    }

    dispose(): void {
      clearTimeout(this._workerTimeout);
      this._workerTimeout = undefined;
      this._terminateWorker();
    }
  }

  for (const methodName of methodNames) {
    const bridgeMethod: BridgeMethod<MethodName> = function (
      this: WorkerBridgeInstance<MethodName> & WorkerBridgeRuntime<MethodName>,
      signal: AbortSignal,
      ...args: unknown[]
    ) {
      this._queue = this._queue
        // Ignore any errors in the queue
        .catch(() => {})
        .then(async () => {
          if (signal.aborted)
            throw new DOMException('AbortError', 'AbortError');

          clearTimeout(this._workerTimeout);
          if (!this._worker) this._startWorker();

          const onAbort = () => this._terminateWorker();
          signal.addEventListener('abort', onAbort);

          const method = this._workerApi![methodName];

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
    (
      GeneratedWorkerBridge.prototype as unknown as Record<
        string,
        BridgeMethod<MethodName>
      >
    )[methodName] = bridgeMethod;
  }

  return GeneratedWorkerBridge as unknown as WorkerBridgeConstructor<MethodName>;
}
