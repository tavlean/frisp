declare module 'wasm-feature-detect' {
  export function simd(): Promise<boolean>;
  export function threads(): Promise<boolean>;
}
