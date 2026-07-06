import type { EncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
import { defineControl, type BulkControl } from './types';

export const mozJPEGControls: readonly BulkControl<EncodeOptions>[] = [
  defineControl({
    id: 'mozjpeg.quality',
    label: 'Quality',
    fields: ['quality'],
  }),
  defineControl({
    id: 'mozjpeg.channels',
    label: 'Channels',
    fields: ['color_space'],
  }),
  defineControl({
    id: 'mozjpeg.auto-subsample-chroma',
    label: 'Auto subsample chroma',
    fields: ['auto_subsample'],
  }),
  defineControl({
    id: 'mozjpeg.subsample-chroma-by',
    label: 'Subsample chroma by',
    fields: ['chroma_subsample'],
  }),
  defineControl({
    id: 'mozjpeg.separate-chroma-quality',
    label: 'Separate chroma quality',
    fields: ['separate_chroma_quality'],
  }),
  defineControl({
    id: 'mozjpeg.chroma-quality',
    label: 'Chroma quality',
    fields: ['chroma_quality'],
  }),
  defineControl({
    id: 'mozjpeg.pointless-spec-compliance',
    label: 'Pointless spec compliance',
    fields: ['baseline'],
  }),
  defineControl({
    id: 'mozjpeg.progressive-rendering',
    label: 'Progressive rendering',
    fields: ['progressive'],
  }),
  defineControl({
    id: 'mozjpeg.optimize-huffman-table',
    label: 'Optimize Huffman table',
    fields: ['optimize_coding'],
  }),
  defineControl({
    id: 'mozjpeg.smoothing',
    label: 'Smoothing',
    fields: ['smoothing'],
  }),
  defineControl({
    id: 'mozjpeg.quantization',
    label: 'Quantization',
    fields: ['quant_table'],
  }),
  defineControl({
    id: 'mozjpeg.trellis-multipass',
    label: 'Trellis multipass',
    fields: ['trellis_multipass'],
  }),
  defineControl({
    id: 'mozjpeg.optimize-zero-block-runs',
    label: 'Optimize zero block runs',
    fields: ['trellis_opt_zero'],
  }),
  defineControl({
    id: 'mozjpeg.optimize-after-trellis-quantization',
    label: 'Optimize after trellis quantization',
    fields: ['trellis_opt_table'],
  }),
  defineControl({
    id: 'mozjpeg.trellis-quantization-passes',
    label: 'Trellis quantization passes',
    fields: ['trellis_loops'],
  }),
];
