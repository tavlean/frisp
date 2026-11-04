export interface Ssimulacra2Module extends EmscriptenWasm.Module {
  /**
   * The SSIMULACRA2 score of `dist` against `ref`, both RGBA8 (sRGB, straight
   * alpha): 100 for identical pixels, 90 visually lossless, 70 high quality.
   * -1000 when a side is under 8 px or a buffer's length is not
   * width * height * 4. Pass byte views, never strings: embind would
   * UTF-8-encode a string and the length check would fail.
   */
  score(
    ref: Uint8Array | Uint8ClampedArray,
    dist: Uint8Array | Uint8ClampedArray,
    width: number,
    height: number,
  ): number;
}

declare var moduleFactory: EmscriptenWasm.ModuleFactory<Ssimulacra2Module>;

export default moduleFactory;
