import type {
  BulkSession,
  ImageJob,
  ImageJobStatus,
} from '../../src/client/lazy-app/bulk/session';
import {
  createBulkSession,
  createImageJob,
  type ImageOutput,
} from '../../src/client/lazy-app/bulk/session';
import {
  type BulkImageOverrides,
  type BulkImageSettings,
  settingsHash,
} from '../../src/client/lazy-app/bulk/settings';

export function fakeFile(
  name = 'photo.jpg',
  {
    size = 100,
    type = 'image/jpeg',
    lastModified = 1_700_000_000_000,
  }: { size?: number; type?: string; lastModified?: number } = {},
): File {
  return new File([new Uint8Array(size)], name, { type, lastModified });
}

export function settings(
  overrides: Partial<BulkImageSettings> = {},
): BulkImageSettings {
  return {
    encoderState: {
      type: 'webP',
      options: {
        quality: 75,
        target_size: 0,
        target_PSNR: 0,
        method: 4,
        sns_strength: 50,
        filter_strength: 60,
        filter_sharpness: 0,
        filter_type: 1,
        partitions: 0,
        segments: 4,
        pass: 1,
        show_compressed: 0,
        preprocessing: 0,
        autofilter: 0,
        partition_limit: 0,
        alpha_compression: 1,
        alpha_filtering: 1,
        alpha_quality: 100,
        lossless: 0,
        exact: 0,
        image_hint: 0,
        emulate_jpeg_size: 0,
        thread_level: 0,
        low_memory: 0,
        near_lossless: 100,
        use_delta_palette: 0,
        use_sharp_yuv: 0,
      },
    },
    processorState: {
      quantize: {
        enabled: false,
        numColors: 256,
        dither: 1,
      },
      resize: {
        enabled: false,
        width: 0,
        height: 0,
        method: 'lanczos3',
        fitMethod: 'stretch',
        premultiply: true,
        linearRGB: true,
      },
    },
    ...overrides,
  } as BulkImageSettings;
}

export function fakeOutput({
  fileName = 'photo.webp',
  fileSize = 60,
  originalSize = 100,
  hash,
  url = `blob:${fileName}`,
}: {
  fileName?: string;
  fileSize?: number;
  originalSize?: number;
  hash?: string;
  url?: string;
} = {}): ImageOutput {
  return {
    file: fakeFile(fileName, { size: fileSize, type: 'image/webp' }),
    size: fileSize,
    downloadUrl: url,
    percentChange: originalSize ? (fileSize / originalSize - 1) * 100 : 0,
    settingsHash: hash ?? settingsHash(settings()),
  };
}

export function job(
  id = 'job-1',
  {
    fileName = `${id}.jpg`,
    fileSize = 100,
    status = 'queued',
    output,
    overrides,
    error,
    previewUrl,
    thumbnailUrl,
    sourceWidth,
    sourceHeight,
  }: {
    fileName?: string;
    fileSize?: number;
    status?: ImageJobStatus;
    output?: ImageOutput;
    overrides?: BulkImageOverrides;
    error?: string;
    previewUrl?: string;
    thumbnailUrl?: string;
    sourceWidth?: number;
    sourceHeight?: number;
  } = {},
): ImageJob {
  return {
    ...createImageJob(id, fakeFile(fileName, { size: fileSize })),
    status,
    output,
    overrides,
    error,
    previewUrl,
    thumbnailUrl,
    sourceWidth,
    sourceHeight,
  };
}

export function session(
  jobs: ImageJob[] = [job()],
  {
    id = 'bulk-session',
    globalSettings = settings(),
    selectedJobId,
  }: {
    id?: string;
    globalSettings?: BulkImageSettings;
    selectedJobId?: string;
  } = {},
): BulkSession {
  return {
    ...createBulkSession(id, globalSettings, jobs),
    selectedJobId: selectedJobId ?? jobs[0]?.id,
  };
}
