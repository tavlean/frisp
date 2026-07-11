// SVGO and gzip stay behind one lazy worker boundary so loading the raster
// editor never pays their parse cost and optimization cannot block interaction.

import { gzipSync, strToU8 } from 'fflate';
import { optimize } from 'svgo/browser';
import type { SvgOptimizeJob, SvgOptimizeReply } from './svg-worker-protocol';

self.onmessage = ({ data }: MessageEvent<SvgOptimizeJob>) => {
  let reply: SvgOptimizeReply;
  try {
    const svg = optimize(data.source, data.config).data;
    const bytes = strToU8(svg);
    reply = {
      id: data.id,
      ok: true,
      svg,
      rawBytes: bytes.length,
      gzipBytes: gzipSync(bytes, { level: 9 }).length,
    };
  } catch (error) {
    reply = {
      id: data.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  self.postMessage(reply);
};
