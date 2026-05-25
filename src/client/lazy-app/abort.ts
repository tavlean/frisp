/**
 * Throw an abort error if a signal is aborted.
 */
export function assertSignal(signal: AbortSignal) {
  if (signal.aborted) throw new DOMException('AbortError', 'AbortError');
}

export function isAbortError(err: unknown): err is Error {
  return err instanceof Error && err.name === 'AbortError';
}

/**
 * Take a signal and promise, and returns a promise that rejects with an AbortError if the signal is
 * signalled, otherwise resolves with the promise.
 */
export async function abortable<T>(
  signal: AbortSignal,
  promise: Promise<T>,
): Promise<T> {
  assertSignal(signal);
  let onAbort: () => void;
  const abortPromise = new Promise<T>((_, reject) => {
    onAbort = () => reject(new DOMException('AbortError', 'AbortError'));
    signal.addEventListener('abort', onAbort);
  });

  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    signal.removeEventListener('abort', onAbort!);
  }
}
