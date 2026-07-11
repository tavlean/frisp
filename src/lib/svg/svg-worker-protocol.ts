export interface SvgOptimizeJob {
  id: number;
  source: string;
  config: import('svgo/browser').Config;
}

export interface SvgOptimizeReply {
  id: number;
  ok: boolean;
  /** Present when ok. */
  svg?: string;
  rawBytes?: number; // UTF-8 length of `svg`
  gzipBytes?: number; // fflate gzipSync(level 9) length
  error?: string; // present when !ok; message only, no stack
}
