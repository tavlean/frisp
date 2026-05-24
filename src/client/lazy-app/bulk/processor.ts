import {
  compressImage,
  decodeImage,
  preprocessImage,
  processImage,
  SourceImage,
} from '../image-pipeline';
import { defaultPreprocessorState } from '../feature-meta';
import type { PreprocessorState } from '../feature-meta';
import type WorkerBridge from '../worker-bridge';
import { getEffectiveSettings, settingsHash } from './settings';
import type { BulkImageSettings } from './settings';
import type { ImageJob, ImageOutput } from './session';
import { getPercentChange } from './size';

export interface BulkProcessorPipeline {
  decodeImage: typeof decodeImage;
  preprocessImage: typeof preprocessImage;
  processImage: typeof processImage;
  compressImage: typeof compressImage;
}

export interface BulkProcessJobOptions {
  job: ImageJob;
  globalSettings: BulkImageSettings;
  workerBridge: WorkerBridge;
  signal: AbortSignal;
  preprocessorState?: PreprocessorState;
  pipeline?: BulkProcessorPipeline;
  createDownloadUrl?: (file: File) => string;
}

export interface BulkProcessPlan {
  effectiveSettings: BulkImageSettings;
  encoderState: NonNullable<BulkImageSettings['encoderState']>;
  settingsHash: string;
  sourceFileName: string;
}

const defaultPipeline: BulkProcessorPipeline = {
  decodeImage,
  preprocessImage,
  processImage,
  compressImage,
};

export function createBulkProcessPlan(
  job: ImageJob,
  globalSettings: BulkImageSettings,
): BulkProcessPlan {
  const effectiveSettings = getEffectiveSettings(globalSettings, job.overrides);

  if (!effectiveSettings.encoderState) {
    throw Error('Bulk job requires an encoder');
  }

  return {
    effectiveSettings,
    encoderState: effectiveSettings.encoderState,
    settingsHash: settingsHash(effectiveSettings),
    sourceFileName: job.sourceFile.name,
  };
}

export async function processBulkImageJob({
  job,
  globalSettings,
  workerBridge,
  signal,
  preprocessorState = defaultPreprocessorState,
  pipeline = defaultPipeline,
  createDownloadUrl = (file) => URL.createObjectURL(file),
}: BulkProcessJobOptions): Promise<ImageOutput> {
  const plan = createBulkProcessPlan(job, globalSettings);

  const decoded = await pipeline.decodeImage(
    signal,
    job.sourceFile,
    workerBridge,
  );
  const preprocessed = await pipeline.preprocessImage(
    signal,
    decoded,
    preprocessorState,
    workerBridge,
  );
  const source: SourceImage = {
    file: job.sourceFile,
    decoded,
    preprocessed,
  };
  const processed = await pipeline.processImage(
    signal,
    source,
    plan.effectiveSettings.processorState,
    workerBridge,
  );
  const file = await pipeline.compressImage(
    signal,
    processed,
    plan.encoderState,
    plan.sourceFileName,
    workerBridge,
  );

  return {
    file,
    size: file.size,
    downloadUrl: createDownloadUrl(file),
    percentChange: getPercentChange(job.originalSize, file.size),
    settingsHash: plan.settingsHash,
  };
}
