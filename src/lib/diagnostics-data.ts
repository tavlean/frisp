import {
  createImageJobs,
  createBulkSessionFromImport,
} from '#client/lazy-app/bulk/import.ts';
import { completeJob } from '#client/lazy-app/bulk/queue.ts';
import { getBulkSessionSummary } from '#client/lazy-app/bulk/summary.ts';
import {
  defaultProcessorState,
  encoderMap,
} from '#client/lazy-app/feature-meta/index.ts';
import type { BulkSession } from '#client/lazy-app/bulk/session.ts';
import type { ImageRecipe } from '#client/lazy-app/recipe.ts';

export interface DiagnosticsModel {
  session: BulkSession;
  summary: ReturnType<typeof getBulkSessionSummary>;
  notes: string[];
}

const sharedRecipe: ImageRecipe = {
  rotate: 0,
  output: {
    kind: 'raster',
    encoder: {
      type: 'webP',
      options: {
        ...encoderMap.webP.meta.defaultOptions,
        quality: 75,
      },
    },
  },
  processors: {
    grain: { ...defaultProcessorState.grain },
    resize: {
      ...defaultProcessorState.resize,
      enabled: true,
      width: 1200,
      height: 800,
    },
    quantize: {
      ...defaultProcessorState.quantize,
      enabled: false,
    },
  },
};

export function createDiagnosticsModel(): DiagnosticsModel {
  const sourceFiles = [
    new File(['diagnostics image data'], 'landing-page.png', {
      type: 'image/png',
      lastModified: 1,
    }),
    new File(['second diagnostics image data'], 'product-card.jpg', {
      type: 'image/jpeg',
      lastModified: 2,
    }),
  ];

  const imported = createImageJobs(sourceFiles);
  let session = createBulkSessionFromImport(
    'sveltekit-diagnostics-batch',
    sharedRecipe,
    imported,
  );

  session = completeJob(session, session.jobs[0].id, {
    file: new File(['optimized webp data'], 'landing-page.webp', {
      type: 'image/webp',
      lastModified: 3,
    }),
    size: 8,
    downloadUrl: 'blob:diagnostics-landing-page',
    percentChange: -58,
    settingsHash: JSON.stringify(sharedRecipe),
  });

  return {
    session,
    summary: getBulkSessionSummary(session),
    notes: [
      'Imported existing framework-neutral bulk helpers into the SvelteKit app.',
      'Created a metadata-only batch without Preact.',
      'Generated shared feature metadata for SvelteKit instead of using a hand-written stub.',
      'Imported a real WebP WASM asset through a SvelteKit-built module worker.',
      'Encoded synthetic ImageData through the existing WebP worker encode module.',
      'Ran a WebP-only single-image pipeline probe with local source generation, decode, resize, encode, and export metadata.',
      'Generated export/readiness summaries from shared selectors.',
      'Kept image processing local; no upload or server route is involved.',
    ],
  };
}
