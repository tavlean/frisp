import {
  createImageJobs,
  createBulkSessionFromImport,
} from '../../../../src/client/lazy-app/bulk/import';
import { completeJob } from '../../../../src/client/lazy-app/bulk/queue';
import { getBulkSessionSummary } from '../../../../src/client/lazy-app/bulk/summary';
import type { BulkSession } from '../../../../src/client/lazy-app/bulk/session';
import type { BulkImageSettings } from '../../../../src/client/lazy-app/bulk/settings';

export interface PrototypeModel {
  session: BulkSession;
  summary: ReturnType<typeof getBulkSessionSummary>;
  notes: string[];
}

const globalSettings: BulkImageSettings = {
  encoderState: {
    type: 'webP',
    options: {
      quality: 75,
    },
  },
  processorState: {
    resize: {
      enabled: true,
      width: 1200,
      height: 800,
    },
    quantize: {
      enabled: false,
    },
  },
};

export function createPrototypeModel(): PrototypeModel {
  const sourceFiles = [
    new File(['prototype image data'], 'landing-page.png', {
      type: 'image/png',
      lastModified: 1,
    }),
    new File(['second prototype image data'], 'product-card.jpg', {
      type: 'image/jpeg',
      lastModified: 2,
    }),
  ];

  const imported = createImageJobs(sourceFiles);
  let session = createBulkSessionFromImport(
    'sveltekit-prototype-batch',
    globalSettings,
    imported,
  );

  session = completeJob(session, session.jobs[0].id, {
    file: new File(['optimized webp data'], 'landing-page.webp', {
      type: 'image/webp',
      lastModified: 3,
    }),
    size: 8,
    downloadUrl: 'blob:prototype-landing-page',
    percentChange: -58,
    settingsHash: JSON.stringify(globalSettings),
  });

  return {
    session,
    summary: getBulkSessionSummary(session),
    notes: [
      'Imported existing framework-neutral bulk helpers into SvelteKit.',
      'Created a metadata-only batch without Preact.',
      'Generated export/readiness summaries from shared selectors.',
      'Kept image processing local; no upload or server route is involved.',
    ],
  };
}
