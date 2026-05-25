import { BridgeMethods, methodNames } from './meta';
import { createWorkerBridgeRuntime } from './runtime';

export type WorkerBridgeInstance = BridgeMethods & {
  dispose(): void;
};

export type WorkerBridgeConstructor = new () => WorkerBridgeInstance;

export function createWorkerBridge(
  createWorker: () => Worker,
): WorkerBridgeConstructor {
  return createWorkerBridgeRuntime(
    methodNames,
    createWorker,
  ) as unknown as WorkerBridgeConstructor;
}
