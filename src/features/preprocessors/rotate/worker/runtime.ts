import type { Options } from '../shared/meta';

export interface RotateModuleInstance {
  exports: {
    memory: WebAssembly.Memory;
    rotate(width: number, height: number, rotate: 0 | 90 | 180 | 270): void;
  };
}

/** `wasm` is the module's URL, or a loader returning its bytes (Node has no
 *  fetch for file paths). */
export function createRotate(wasm: string | (() => Promise<BufferSource>)) {
  // We are loading a 500B module here. Loading the code to feature-detect
  // `instantiateStreaming` probably takes longer to load than the time we save
  // by using `instantiateStreaming` in the first place. So use ArrayBuffers.
  const load =
    typeof wasm === 'string'
      ? () => fetch(wasm).then((response) => response.arrayBuffer())
      : wasm;
  const instancePromise = load().then((buffer) =>
    WebAssembly.instantiate(buffer),
  );

  return async function rotate(
    data: ImageData,
    opts: Options,
  ): Promise<ImageData> {
    const instance = (await instancePromise).instance as RotateModuleInstance;

    // Number of wasm memory pages (a 64KiB) needed to store the image twice.
    const bytesPerImage = data.width * data.height * 4;
    const numPagesNeeded = Math.ceil((bytesPerImage * 2 + 8) / (64 * 1024));
    // Only count full pages, just to be safe.
    const numPagesAvailable = Math.floor(
      instance.exports.memory.buffer.byteLength / (64 * 1024),
    );
    const additionalPagesToAllocate = numPagesNeeded - numPagesAvailable;

    if (additionalPagesToAllocate > 0) {
      instance.exports.memory.grow(additionalPagesToAllocate);
    }
    const view = new Uint8ClampedArray(instance.exports.memory.buffer);
    view.set(data.data, 8);

    instance.exports.rotate(data.width, data.height, opts.rotate);

    const flipDimensions = opts.rotate % 180 !== 0;
    return new ImageData(
      view.slice(bytesPerImage + 8, bytesPerImage * 2 + 8),
      flipDimensions ? data.height : data.width,
      flipDimensions ? data.width : data.height,
    );
  };
}
