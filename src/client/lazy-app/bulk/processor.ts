import { imagePipeline } from '../image-pipeline';
import type { ImagePipelineWorkerBridge, SourceImage } from '../image-pipeline';
import { recipeSignature, type ImageRecipe } from '../recipe';
import { hasPositiveDimensions } from './settings';
import {
  getJobSourceDimensions,
  type ImageJob,
  type ImageOutput,
} from './session';
import { getPercentChange } from './size';

export interface BulkProcessorPipeline {
  decodeSourceImage: typeof imagePipeline.decodeSourceImage;
  preprocessImage: typeof imagePipeline.preprocessImage;
  processImage: typeof imagePipeline.processImage;
  compressImage: typeof imagePipeline.compressImage;
}

export interface BulkProcessJobOptions {
  job: ImageJob;
  /** The job's effective recipe (see effectiveRecipe). Raster output only:
   *  the SVG lane lives in $lib (optimizeImage), which the engine never
   *  imports. */
  recipe: ImageRecipe;
  workerBridge: ImagePipelineWorkerBridge;
  signal: AbortSignal;
  pipeline?: BulkProcessorPipeline;
  createDownloadUrl?: (file: File) => string;
}

const defaultPipeline: BulkProcessorPipeline = imagePipeline;

/**
 * Headless raster processing of one job, for the diagnostics probe and the
 * engine-level runner. The production bulk runtime goes through optimizeImage
 * instead, so it gets the SVG and transcode lanes too.
 */
export async function processBulkImageJob({
  job,
  recipe,
  workerBridge,
  signal,
  pipeline = defaultPipeline,
  createDownloadUrl = (file) => URL.createObjectURL(file),
}: BulkProcessJobOptions): Promise<ImageOutput> {
  const { output } = recipe;
  if (output.kind !== 'raster') {
    throw Error('processBulkImageJob encodes raster output only');
  }
  const dimensions = getJobSourceDimensions(job);

  const decodedSource = await pipeline.decodeSourceImage(
    signal,
    job.sourceFile,
    workerBridge,
  );
  const preprocessed = await pipeline.preprocessImage(
    signal,
    decodedSource.decoded,
    { rotate: { rotate: recipe.rotate } },
    workerBridge,
  );
  const source: SourceImage = {
    file: job.sourceFile,
    decoded: decodedSource.decoded,
    preprocessed,
    vectorImage: decodedSource.vectorImage,
  };
  const processed = await pipeline.processImage(
    signal,
    source,
    recipe.processors,
    workerBridge,
  );
  const file = await pipeline.compressImage(
    signal,
    processed,
    output.encoder,
    job.sourceFile.name,
    workerBridge,
  );

  return {
    file,
    size: file.size,
    downloadUrl: createDownloadUrl(file),
    percentChange: getPercentChange(job.originalSize, file.size),
    settingsHash: recipeSignature(
      recipe,
      hasPositiveDimensions(dimensions) ? dimensions : undefined,
    ),
  };
}
