/**
 * Copyright 2026 Sqush Contributors.
 * Licensed under the Apache License, Version 2.0.
 */
const assert = require('assert/strict');
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('fs');
const { dirname, join } = require('path');
const ts = require('typescript');

const repoRoot = join(__dirname, '..');
const outDir = join(repoRoot, '.tmp', 'bulk-helper-tests');
const sourceFiles = [
  'src/client/lazy-app/bulk/settings.ts',
  'src/client/lazy-app/bulk/session.ts',
  'src/client/lazy-app/bulk/import.ts',
  'src/client/lazy-app/bulk/queue.ts',
  'src/client/lazy-app/bulk/export.ts',
  'src/client/lazy-app/bulk/processor.ts',
  'src/client/lazy-app/bulk/runner.ts',
  'src/client/lazy-app/bulk/size.ts',
  'src/client/lazy-app/bulk/urls.ts',
  'src/client/lazy-app/util/canvas.ts',
  'src/client/lazy-app/util/index.ts',
  'src/client/lazy-app/util/clean-modify.ts',
  'src/client/lazy-app/util/svg.ts',
  'src/client/lazy-app/Compress/processor-state.ts',
  'src/client/lazy-app/Compress/saved-settings.ts',
  'src/client/lazy-app/Compress/Results/pretty-bytes.ts',
];

function compileTestModule(sourcePath) {
  const inputPath = join(repoRoot, sourcePath);
  const outputPath = join(
    outDir,
    sourcePath.replace(/^src\/client\/lazy-app\//, '').replace(/\.ts$/, '.js'),
  );
  const source = readFileSync(inputPath, 'utf8');
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2019,
      esModuleInterop: true,
    },
    fileName: inputPath,
  });

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, result.outputText);
}

function makeFile(name, type, size, lastModified = 1) {
  return { name, type, size, lastModified };
}

mkdirSync(outDir, { recursive: true });
for (const sourceFile of sourceFiles) compileTestModule(sourceFile);
writeFileSync(
  join(outDir, 'image-pipeline.js'),
  [
    'exports.decodeImage = async () => { throw Error("stub decodeImage"); };',
    'exports.preprocessImage = async () => { throw Error("stub preprocessImage"); };',
    'exports.processImage = async () => { throw Error("stub processImage"); };',
    'exports.compressImage = async () => { throw Error("stub compressImage"); };',
  ].join('\n'),
);
writeFileSync(
  join(outDir, 'feature-meta.js'),
  [
    'exports.defaultPreprocessorState = { rotate: { rotate: 0 } };',
    'exports.encoderMap = { webP: {}, mozJPEG: {}, "browser-webp": {} };',
  ].join('\n'),
);

global.navigator = global.navigator || { userAgent: 'node' };

const settings = require(join(outDir, 'bulk', 'settings.js'));
const session = require(join(outDir, 'bulk', 'session.js'));
const bulkImport = require(join(outDir, 'bulk', 'import.js'));
const queue = require(join(outDir, 'bulk', 'queue.js'));
const bulkExport = require(join(outDir, 'bulk', 'export.js'));
const bulkProcessor = require(join(outDir, 'bulk', 'processor.js'));
const bulkRunner = require(join(outDir, 'bulk', 'runner.js'));
const bulkSize = require(join(outDir, 'bulk', 'size.js'));
const bulkUrls = require(join(outDir, 'bulk', 'urls.js'));
const lazyUtil = require(join(outDir, 'util', 'index.js'));
const cleanModify = require(join(outDir, 'util', 'clean-modify.js'));
const svgUtil = require(join(outDir, 'util', 'svg.js'));
const processorState = require(join(outDir, 'Compress', 'processor-state.js'));
const savedSettings = require(join(outDir, 'Compress', 'saved-settings.js'));
const prettyBytes = require(join(
  outDir,
  'Compress',
  'Results',
  'pretty-bytes.js',
)).default;

const globalSettings = {
  encoderState: {
    type: 'browser-webp',
    options: { quality: 75 },
  },
  processorState: {
    resize: {
      enabled: true,
      width: 1200,
      height: 800,
    },
  },
};

const effectiveSettings = settings.getEffectiveSettings(globalSettings, {
  processorState: {
    resize: {
      width: 900,
    },
  },
});

assert.equal(effectiveSettings.encoderState, globalSettings.encoderState);
assert.deepEqual(effectiveSettings.processorState.resize, {
  enabled: true,
  width: 900,
  height: 800,
});
assert.deepEqual(
  settings.getEffectiveSettings(globalSettings, {
    processorState: {
      resize: {
        enabled: false,
        width: 0,
      },
    },
  }).processorState.resize,
  {
    enabled: false,
    width: 0,
    height: 800,
  },
);
assert.equal(settings.hasSettingsOverrides(undefined), false);
assert.equal(settings.hasSettingsOverrides({}), false);
assert.equal(
  settings.hasSettingsOverrides({
    processorState: {
      resize: {},
    },
  }),
  false,
);
assert.equal(
  settings.hasSettingsOverrides({ processorState: { resize: { width: 900 } } }),
  true,
);
assert.deepEqual(
  settings.getSettingsOverridePaths({
    processorState: {
      resize: {
        width: 900,
        height: undefined,
      },
    },
  }),
  ['processorState.resize.width'],
);
assert.deepEqual(
  settings.getSettingsOverridePaths({
    encoderState: globalSettings.encoderState,
    processorState: {
      resize: {},
    },
  }),
  ['encoderState'],
);
assert.equal(
  settings.settingsHash({
    processorState: { b: 2, a: 1 },
  }),
  settings.settingsHash({
    processorState: { a: 1, b: 2 },
  }),
);

const disabledProcessorA = {
  resize: { enabled: false, width: 100 },
  quantize: { enabled: false, numColors: 32 },
};
const disabledProcessorB = {
  resize: { enabled: false, width: 200 },
  quantize: { enabled: false, numColors: 64 },
};
const sharedResize = { enabled: true, width: 100 };
const sharedQuantize = { enabled: false, numColors: 32 };

assert.equal(
  processorState.processorStateEquivalent(
    disabledProcessorA,
    disabledProcessorB,
  ),
  true,
);
assert.equal(
  processorState.processorStateEquivalent(
    {
      resize: sharedResize,
      quantize: sharedQuantize,
    },
    {
      resize: sharedResize,
      quantize: sharedQuantize,
    },
  ),
  true,
);
assert.equal(
  processorState.processorStateEquivalent(
    {
      resize: { enabled: true, width: 100 },
      quantize: sharedQuantize,
    },
    {
      resize: { enabled: true, width: 100 },
      quantize: sharedQuantize,
    },
  ),
  false,
);

const png = makeFile('hero.png', 'image/png', 1000);
assert.equal(bulkSize.getPercentChange(1000, 500), -50);
assert.equal(bulkSize.getPercentChange(1000, 1250), 25);
assert.equal(bulkSize.getPercentChange(0, 500), 0);

const avifWithoutMime = makeFile('hero.AVIF', '', 800);
const jfifWithoutMime = makeFile('photo.jfif', '', 700);
const tiffWithoutMime = makeFile('scan.TIFF', '', 600);
const bmpWithoutMime = makeFile('diagram.bmp', '', 500);
const text = makeFile('notes.txt', 'text/plain', 100);
const noExtension = makeFile('image-file', '', 100);
const trailingDot = makeFile('image.', '', 100);
const imported = bulkImport.createImageJobs([
  png,
  avifWithoutMime,
  jfifWithoutMime,
  tiffWithoutMime,
  bmpWithoutMime,
  text,
  noExtension,
  trailingDot,
]);

assert.equal(imported.accepted.length, 5);
assert.equal(imported.rejected.length, 3);
assert.equal(imported.accepted[0].originalSize, 1000);
assert.equal(imported.accepted[1].originalSize, 800);
assert.equal(imported.accepted[2].originalSize, 700);
assert.equal(imported.accepted[3].originalSize, 600);
assert.equal(imported.accepted[4].originalSize, 500);
assert.deepEqual(bulkImport.getBulkImportSummary(imported), {
  accepted: 5,
  rejected: 3,
  totalAcceptedSize: 3600,
  totalRejectedSize: 300,
});

assert.deepEqual(
  [
    'queued',
    'decoding',
    'processing',
    'encoded',
    'exported',
    'failed',
    'skipped',
  ].map((status) => session.getJobStatusGroup(status)),
  ['pending', 'active', 'active', 'complete', 'complete', 'failed', 'skipped'],
);

let bulkSession = session.createBulkSession('batch-1', globalSettings);
bulkSession = session.addJobs(bulkSession, [imported.accepted[0]]);

assert.equal(session.getSelectedJob(bulkSession).id, imported.accepted[0].id);
assert.deepEqual(
  session.getJobEffectiveSettings(bulkSession, imported.accepted[0].id),
  globalSettings,
);
assert.equal(
  session.getJobEffectiveSettings(bulkSession, 'missing-job'),
  undefined,
);

const queuedSession = session.createBulkSession(
  'queued-batch',
  globalSettings,
  imported.accepted.slice(0, 3),
);
assert.equal(queue.getRunnableJobs(queuedSession, 1.9).length, 1);
assert.equal(queue.getRunnableJobs(queuedSession, -1).length, 0);
assert.equal(queue.getRunnableJobs(queuedSession, Infinity).length, 2);
assert.equal(queue.getRunnableJobs(queuedSession, NaN).length, 2);

const duplicateIdSession = session.addJobs(
  session.createBulkSession('duplicate-id-batch', globalSettings, [
    session.createImageJob('duplicate-id', png),
  ]),
  [
    session.createImageJob('duplicate-id', png),
    session.createImageJob('duplicate-id', png),
  ],
);

assert.deepEqual(
  duplicateIdSession.jobs.map((job) => job.id),
  ['duplicate-id', 'duplicate-id-2', 'duplicate-id-3'],
);

const restoredSession = session.createBulkSession(
  'restored-batch',
  globalSettings,
  [
    {
      ...session.createImageJob('restored-active', png),
      status: 'processing',
    },
    {
      ...session.createImageJob('restored-exported', png),
      status: 'exported',
    },
  ],
);
assert.equal(restoredSession.activeJobs, 1);
assert.equal(restoredSession.exportedCount, 1);

const addedRestoredSession = session.addJobs(
  session.createBulkSession('add-restored-batch', globalSettings),
  [
    {
      ...session.createImageJob('added-active', png),
      status: 'processing',
    },
    {
      ...session.createImageJob('added-exported', png),
      status: 'exported',
    },
  ],
);
assert.equal(addedRestoredSession.activeJobs, 1);
assert.equal(addedRestoredSession.exportedCount, 1);

const removableJobs = [
  session.createImageJob('remove-1', makeFile('remove-1.png', 'image/png', 10)),
  session.createImageJob('remove-2', makeFile('remove-2.png', 'image/png', 10)),
  session.createImageJob('remove-3', makeFile('remove-3.png', 'image/png', 10)),
];
let removableSession = session.createBulkSession(
  'remove-batch',
  globalSettings,
  removableJobs,
);
removableSession = session.selectJob(removableSession, 'remove-2');
assert.equal(
  session.selectPreviousJob(removableSession).selectedJobId,
  'remove-1',
);
assert.equal(session.selectNextJob(removableSession).selectedJobId, 'remove-3');
assert.equal(
  session.selectPreviousJob(session.selectJob(removableSession, 'remove-1'))
    .selectedJobId,
  'remove-1',
);
assert.equal(
  session.selectNextJob(session.selectJob(removableSession, 'remove-3'))
    .selectedJobId,
  'remove-3',
);
assert.equal(
  session.selectNextJob({
    ...removableSession,
    selectedJobId: 'missing-job',
  }).selectedJobId,
  'remove-1',
);
assert.equal(
  session.selectPreviousJob({
    ...removableSession,
    selectedJobId: 'missing-job',
  }).selectedJobId,
  'remove-1',
);
const selectedContext = session.getSelectedJobContext(removableSession);
assert.deepEqual(
  {
    ...selectedContext,
    job: selectedContext.job?.id,
  },
  {
    job: 'remove-2',
    index: 1,
    total: 3,
    canSelectPrevious: true,
    canSelectNext: true,
  },
);
const firstSelectedContext = session.getSelectedJobContext(
  session.selectJob(removableSession, 'remove-1'),
);
assert.deepEqual(
  {
    ...firstSelectedContext,
    job: firstSelectedContext.job?.id,
  },
  {
    job: 'remove-1',
    index: 0,
    total: 3,
    canSelectPrevious: false,
    canSelectNext: true,
  },
);
assert.deepEqual(
  session.getSelectedJobContext({
    ...removableSession,
    selectedJobId: 'missing-job',
  }),
  {
    job: undefined,
    index: -1,
    total: 3,
    canSelectPrevious: false,
    canSelectNext: false,
  },
);
removableSession = queue.startJob(removableSession, 'remove-1');
removableSession = session.removeJobs(removableSession, [
  'remove-1',
  'remove-2',
]);

assert.deepEqual(
  removableSession.jobs.map((job) => job.id),
  ['remove-3'],
);
assert.equal(removableSession.selectedJobId, 'remove-3');
assert.equal(removableSession.activeJobs, 0);

bulkSession = session.updateJobOverrides(bulkSession, imported.accepted[0].id, {
  processorState: {
    resize: {
      width: 900,
    },
  },
});
assert.deepEqual(bulkSession.jobs[0].overrides.processorState.resize, {
  width: 900,
});
assert.deepEqual(
  session.getJobEffectiveSettings(bulkSession, imported.accepted[0].id)
    .processorState.resize,
  {
    enabled: true,
    width: 900,
    height: 800,
  },
);
assert.deepEqual(
  session.getOverriddenJobs(bulkSession).map((job) => job.id),
  [imported.accepted[0].id],
);
assert.deepEqual(session.getOverrideSummary(bulkSession), {
  overridden: 1,
  total: 1,
});
bulkSession = session.updateJobOverrides(bulkSession, imported.accepted[0].id, {
  processorState: {
    resize: {},
  },
});
assert.equal(bulkSession.jobs[0].overrides, undefined);
assert.deepEqual(session.getOverriddenJobs(bulkSession), []);
bulkSession = session.updateJobOverrides(bulkSession, imported.accepted[0].id, {
  processorState: {
    resize: {
      width: 900,
    },
  },
});
bulkSession = session.clearJobOverrides(bulkSession, imported.accepted[0].id);
assert.equal(bulkSession.jobs[0].overrides, undefined);
assert.deepEqual(session.getOverrideSummary(bulkSession), {
  overridden: 0,
  total: 1,
});
assert.deepEqual(session.getBatchProgress(bulkSession), {
  total: 1,
  completed: 0,
  failed: 0,
});
assert.deepEqual(session.getDetailedBatchProgress(bulkSession), {
  total: 1,
  queued: 1,
  active: 0,
  completed: 0,
  failed: 0,
  skipped: 0,
  exported: 0,
});
assert.deepEqual(session.getBulkActionState(bulkSession), {
  hasActiveJobs: false,
  hasRetryableJobs: false,
  hasIncompleteJobs: true,
});
assert.equal(bulkExport.canExportBulkSession(bulkSession), false);

bulkSession = queue.startJob(bulkSession, imported.accepted[0].id);
assert.equal(bulkSession.activeJobs, 1);
assert.deepEqual(session.getBulkActionState(bulkSession), {
  hasActiveJobs: true,
  hasRetryableJobs: false,
  hasIncompleteJobs: true,
});
assert.equal(queue.getRunnableJobs(bulkSession).length, 0);
assert.equal(
  queue.startJob(bulkSession, imported.accepted[0].id).activeJobs,
  1,
);
assert.equal(queue.startJob(bulkSession, 'missing-job').activeJobs, 1);

const output = {
  file: makeFile('hero.webp', 'image/webp', 500),
  size: 500,
  downloadUrl: 'blob:test',
  percentChange: -50,
  settingsHash: settings.settingsHash(globalSettings),
};

bulkSession = queue.completeJob(bulkSession, imported.accepted[0].id, output);
assert.equal(bulkSession.activeJobs, 0);
assert.deepEqual(session.getBatchProgress(bulkSession), {
  total: 1,
  completed: 1,
  failed: 0,
});
assert.deepEqual(session.getDetailedBatchProgress(bulkSession), {
  total: 1,
  queued: 0,
  active: 0,
  completed: 1,
  failed: 0,
  skipped: 0,
  exported: 0,
});
assert.equal(queue.isJobOutputStale(bulkSession, bulkSession.jobs[0]), false);
assert.deepEqual(bulkExport.getExportableJobs(bulkSession), [
  bulkSession.jobs[0],
]);
assert.deepEqual(session.getBulkActionState(bulkSession), {
  hasActiveJobs: false,
  hasRetryableJobs: false,
  hasIncompleteJobs: false,
});
assert.equal(bulkExport.canExportBulkSession(bulkSession), true);
assert.deepEqual(bulkExport.getBulkExportSummary(bulkSession), {
  ready: 1,
  failed: 0,
  pending: 0,
  skipped: 0,
  totalOriginalSize: 1000,
  totalOutputSize: 500,
  percentChange: -50,
});
assert.deepEqual(bulkExport.getBulkOutputSummary(bulkSession), {
  optimized: 1,
  stale: 0,
  totalOriginalSize: 1000,
  totalOutputSize: 500,
  percentChange: -50,
});
assert.deepEqual(
  bulkExport.getBulkExportEntries(bulkSession).map((entry) => ({
    fileName: entry.fileName,
    downloadUrl: entry.downloadUrl,
    size: entry.size,
  })),
  [
    {
      fileName: 'hero.webp',
      downloadUrl: 'blob:test',
      size: 500,
    },
  ],
);

bulkSession = session.updateGlobalSettings(bulkSession, {
  ...globalSettings,
  processorState: {
    resize: {
      enabled: true,
      width: 640,
      height: 480,
    },
  },
});

assert.equal(queue.isJobOutputStale(bulkSession, bulkSession.jobs[0]), true);
assert.deepEqual(bulkExport.getExportableJobs(bulkSession), []);
assert.equal(bulkExport.canExportBulkSession(bulkSession), false);
assert.deepEqual(bulkExport.getBulkOutputSummary(bulkSession), {
  optimized: 0,
  stale: 1,
  totalOriginalSize: 0,
  totalOutputSize: 0,
  percentChange: 0,
});
assert.deepEqual(bulkExport.getBulkExportSummary(bulkSession), {
  ready: 0,
  failed: 0,
  pending: 1,
  skipped: 0,
  totalOriginalSize: 0,
  totalOutputSize: 0,
  percentChange: 0,
});

bulkSession = session.updateGlobalSettings(bulkSession, {
  ...globalSettings,
  processorState: {
    resize: {
      enabled: true,
      width: 1200,
      height: 800,
    },
  },
});

assert.equal(queue.isJobOutputStale(bulkSession, bulkSession.jobs[0]), false);

bulkSession = session.updateJobOverrides(bulkSession, imported.accepted[0].id, {
  processorState: {
    resize: {
      width: 640,
    },
  },
});

assert.equal(queue.isJobOutputStale(bulkSession, bulkSession.jobs[0]), true);

assert.equal(bulkExport.getBulkExportName(bulkSession), 'batch-1-optimized');
assert.equal(
  bulkExport.getBulkExportName(
    session.createBulkSession('../Unsafe: Batch?', globalSettings),
  ),
  'Unsafe-Batch-optimized',
);
assert.equal(
  queue.completeJob(bulkSession, 'missing-job', output).activeJobs,
  0,
);
assert.equal(
  queue.failJob(bulkSession, 'missing-job', 'missing').activeJobs,
  0,
);

const failedJob = {
  ...session.createImageJob('failed-retry', png),
  status: 'failed',
  error: 'decode failed',
  output,
};
const skippedJob = {
  ...session.createImageJob('skipped-retry', png),
  status: 'skipped',
  error: 'unsupported',
  output,
};
const encodedJob = {
  ...session.createImageJob('encoded-no-retry', png),
  status: 'encoded',
  output,
};
const retrySession = queue.requeueIncompleteJobs(
  session.createBulkSession('retry-batch', globalSettings, [
    failedJob,
    skippedJob,
    encodedJob,
  ]),
);

assert.deepEqual(
  retrySession.jobs.map((job) => ({
    id: job.id,
    status: job.status,
    error: job.error,
    hasOutput: Boolean(job.output),
  })),
  [
    {
      id: 'failed-retry',
      status: 'queued',
      error: undefined,
      hasOutput: false,
    },
    {
      id: 'skipped-retry',
      status: 'queued',
      error: undefined,
      hasOutput: false,
    },
    {
      id: 'encoded-no-retry',
      status: 'encoded',
      error: undefined,
      hasOutput: true,
    },
  ],
);
assert.deepEqual(
  session.getBulkActionState(
    session.createBulkSession('retryable-batch', globalSettings, [
      failedJob,
      skippedJob,
      encodedJob,
    ]),
  ),
  {
    hasActiveJobs: false,
    hasRetryableJobs: true,
    hasIncompleteJobs: true,
  },
);

const duplicateExportSession = session.createBulkSession('duplicate-batch', {
  ...globalSettings,
  processorState: {
    resize: {
      enabled: true,
      width: 1200,
      height: 800,
    },
  },
});
const duplicateJobs = [
  session.createImageJob('duplicate-1', makeFile('Hero.PNG', 'image/png', 100)),
  session.createImageJob(
    'duplicate-2',
    makeFile('hero.jpg', 'image/jpeg', 100),
  ),
  session.createImageJob(
    'duplicate-3',
    makeFile('folder/bad:name.png', 'image/png', 100),
  ),
  session.createImageJob('duplicate-4', makeFile('???.png', 'image/png', 100)),
  session.createImageJob(
    'duplicate-5',
    makeFile('  .hidden.  .png', 'image/png', 100),
  ),
  session.createImageJob(
    'duplicate-6',
    makeFile('hero-2.png', 'image/png', 100),
  ),
];
const duplicateReadySession = duplicateJobs.reduce(
  (nextSession, job, index) =>
    queue.completeJob(queue.startJob(nextSession, job.id), job.id, {
      file: makeFile(`output-${index}.webp`, 'image/webp', 50),
      size: 50,
      downloadUrl: `blob:duplicate-${index}`,
      percentChange: -50,
      settingsHash: settings.settingsHash(nextSession.globalSettings),
    }),
  session.addJobs(duplicateExportSession, duplicateJobs),
);

assert.deepEqual(
  bulkExport.getBulkExportEntries(duplicateReadySession).map((entry) => ({
    fileName: entry.fileName,
    downloadUrl: entry.downloadUrl,
  })),
  [
    {
      fileName: 'Hero.webp',
      downloadUrl: 'blob:duplicate-0',
    },
    {
      fileName: 'hero-2.webp',
      downloadUrl: 'blob:duplicate-1',
    },
    {
      fileName: 'folder-bad-name.webp',
      downloadUrl: 'blob:duplicate-2',
    },
    {
      fileName: 'image.webp',
      downloadUrl: 'blob:duplicate-3',
    },
    {
      fileName: 'hidden.webp',
      downloadUrl: 'blob:duplicate-4',
    },
    {
      fileName: 'hero-2-2.webp',
      downloadUrl: 'blob:duplicate-5',
    },
  ],
);

const exportedSession = session.markJobsExported(duplicateReadySession, [
  'duplicate-1',
  'missing-job',
]);

assert.equal(exportedSession.jobs[0].status, 'exported');
assert.equal(exportedSession.jobs[1].status, 'encoded');
assert.equal(exportedSession.exportedCount, 1);
assert.equal(bulkExport.getExportableJobs(exportedSession).length, 5);
assert.deepEqual(bulkExport.getBulkOutputSummary(exportedSession), {
  optimized: 6,
  stale: 0,
  totalOriginalSize: 600,
  totalOutputSize: 300,
  percentChange: -50,
});
assert.deepEqual(session.getDetailedBatchProgress(exportedSession), {
  total: 6,
  queued: 0,
  active: 0,
  completed: 6,
  failed: 0,
  skipped: 0,
  exported: 1,
});
assert.equal(
  session.markJobsExported(exportedSession, ['duplicate-1']).exportedCount,
  1,
);
const requeuedExportedSession = queue.requeueJob(
  exportedSession,
  'duplicate-1',
);
assert.equal(requeuedExportedSession.jobs[0].status, 'queued');
assert.equal(requeuedExportedSession.jobs[0].output, undefined);
assert.equal(requeuedExportedSession.exportedCount, 0);
assert.equal(
  queue.completeJob(exportedSession, 'duplicate-1', output).exportedCount,
  0,
);
assert.equal(
  queue.failJob(exportedSession, 'duplicate-1', 'export failed').exportedCount,
  0,
);
assert.equal(
  queue.failJob(exportedSession, 'duplicate-1', 'export failed').jobs[0].output,
  undefined,
);
assert.equal(
  session.removeJobs(exportedSession, ['duplicate-1']).exportedCount,
  0,
);
const staleExportedSession = queue.requeueStaleJobs(
  session.updateGlobalSettings(exportedSession, {
    ...exportedSession.globalSettings,
    processorState: {
      resize: {
        enabled: true,
        width: 1,
        height: 1,
      },
    },
  }),
);
assert.equal(staleExportedSession.exportedCount, 0);
assert.equal(staleExportedSession.activeJobs, 0);
assert.deepEqual(
  staleExportedSession.jobs.map((job) => ({
    status: job.status,
    hasOutput: Boolean(job.output),
  })),
  [
    { status: 'queued', hasOutput: false },
    { status: 'queued', hasOutput: false },
    { status: 'queued', hasOutput: false },
    { status: 'queued', hasOutput: false },
    { status: 'queued', hasOutput: false },
    { status: 'queued', hasOutput: false },
  ],
);
assert.equal(existsSync(join(outDir, 'bulk', 'queue.js')), true);

const original = {
  encoder: {
    options: {
      quality: 75,
      method: 4,
    },
  },
  untouched: true,
};
const changed = cleanModify.cleanSet(original, 'encoder.options.quality', 80);
assert.equal(changed.encoder.options.quality, 80);
assert.equal(changed.encoder.options.method, 4);
assert.equal(original.encoder.options.quality, 75);
assert.notEqual(changed, original);
assert.notEqual(changed.encoder, original.encoder);
assert.notEqual(changed.encoder.options, original.encoder.options);
assert.equal(changed.untouched, true);

const merged = cleanModify.cleanMerge(original, 'encoder.options', {
  effort: 6,
});
assert.deepEqual(merged.encoder.options, {
  quality: 75,
  method: 4,
  effort: 6,
});
assert.deepEqual(original.encoder.options, {
  quality: 75,
  method: 4,
});

const list = [{ value: 1 }, { value: 2 }];
const changedList = cleanModify.cleanSet(list, [1, 'value'], 3);
assert.deepEqual(changedList, [{ value: 1 }, { value: 3 }]);
assert.deepEqual(list, [{ value: 1 }, { value: 2 }]);

assert.deepEqual(prettyBytes(0), { value: '0', unit: 'B' });
assert.deepEqual(prettyBytes(999), { value: '999', unit: 'B' });
assert.deepEqual(prettyBytes(1000), { value: '1.00', unit: 'kB' });
assert.deepEqual(prettyBytes(1234567), { value: '1.23', unit: 'MB' });
assert.deepEqual(prettyBytes(-1234), { value: '-1.23', unit: 'kB' });

assert.deepEqual(svgUtil.parseSvgViewBoxSize('0 0 100 200'), {
  width: '100',
  height: '200',
});
assert.deepEqual(svgUtil.parseSvgViewBoxSize('0,0,100,200'), {
  width: '100',
  height: '200',
});
assert.deepEqual(svgUtil.parseSvgViewBoxSize('0, 0, 100, 200'), {
  width: '100',
  height: '200',
});
assert.equal(svgUtil.parseSvgViewBoxSize('0 0 100'), undefined);

const savedSideSettings = {
  latestSettings: {
    processorState: {
      resize: { enabled: false },
      quantize: { enabled: true },
    },
    encoderState: {
      type: 'webP',
      options: { quality: 80 },
    },
  },
  encodedSettings: {
    processorState: {
      resize: { enabled: false },
      quantize: { enabled: true },
    },
    encoderState: {
      type: 'mozJPEG',
      options: { quality: 75 },
    },
  },
};

assert.deepEqual(
  savedSettings.parseSavedSideSettings(JSON.stringify(savedSideSettings)),
  savedSideSettings,
);
assert.deepEqual(
  savedSettings.parseSavedSideSettings(
    savedSettings.serializeSavedSideSettings(savedSideSettings),
  ),
  savedSideSettings,
);
assert.equal(
  savedSettings.parseSavedSideSettings('{this is not json'),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(JSON.stringify([savedSideSettings])),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      latestSettings: {
        ...savedSideSettings.latestSettings,
        encoderState: { type: 'unknown', options: {} },
      },
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      latestSettings: {
        ...savedSideSettings.latestSettings,
        encoderState: { type: 'webP' },
      },
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      latestSettings: {
        ...savedSideSettings.latestSettings,
        encoderState: { type: 'webP', options: [] },
      },
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      latestSettings: {
        ...savedSideSettings.latestSettings,
        encoderState: { type: 'webP', options: { quality: null } },
      },
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      latestSettings: {
        ...savedSideSettings.latestSettings,
        processorState: {
          resize: { enabled: 'false' },
          quantize: { enabled: true },
        },
      },
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      encodedSettings: {
        ...savedSideSettings.encodedSettings,
        encoderState: { type: 'mozJPEG', options: { quality: null } },
      },
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      latestSettings: {
        ...savedSideSettings.latestSettings,
        processorState: {
          resize: { enabled: false, width: null },
          quantize: { enabled: true },
        },
      },
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      ...savedSideSettings,
      encodedSettings: {
        encoderState: savedSideSettings.encodedSettings.encoderState,
      },
    }),
  ),
  undefined,
);

async function testBulkProcessor() {
  const calls = [];
  const fakeWorkerBridge = {};
  const fakeDecoded = { width: 100, height: 50 };
  const fakePreprocessed = { width: 100, height: 50 };
  const fakeProcessed = { width: 50, height: 25 };
  const fakeOutputFile = makeFile('hero.webp', 'image/webp', 400);
  const signal = new AbortController().signal;
  const job = session.createImageJob('job-1', png);
  const processorSettings = {
    ...globalSettings,
    encoderState: {
      type: 'webP',
      options: { quality: 80 },
    },
  };

  const processorOutput = await bulkProcessor.processBulkImageJob({
    job,
    globalSettings: processorSettings,
    workerBridge: fakeWorkerBridge,
    signal,
    createDownloadUrl: (file) => `download:${file.name}`,
    pipeline: {
      async decodeImage(receivedSignal, file, workerBridge) {
        calls.push(['decode', receivedSignal, file, workerBridge]);
        return fakeDecoded;
      },
      async preprocessImage(receivedSignal, data, preprocessorState) {
        calls.push(['preprocess', receivedSignal, data, preprocessorState]);
        return fakePreprocessed;
      },
      async processImage(receivedSignal, source, processorState) {
        calls.push(['process', receivedSignal, source, processorState]);
        return fakeProcessed;
      },
      async compressImage(receivedSignal, image, encoderState, sourceName) {
        calls.push([
          'compress',
          receivedSignal,
          image,
          encoderState,
          sourceName,
        ]);
        return fakeOutputFile;
      },
    },
  });

  assert.deepEqual(
    calls.map((call) => call[0]),
    ['decode', 'preprocess', 'process', 'compress'],
  );
  assert.equal(calls[0][1], signal);
  assert.equal(calls[0][2], png);
  assert.equal(calls[0][3], fakeWorkerBridge);
  assert.equal(calls[2][2].file, png);
  assert.equal(calls[2][2].decoded, fakeDecoded);
  assert.equal(calls[2][2].preprocessed, fakePreprocessed);
  assert.equal(calls[3][2], fakeProcessed);
  assert.deepEqual(calls[3][3], processorSettings.encoderState);
  assert.deepEqual(processorOutput, {
    file: fakeOutputFile,
    size: 400,
    downloadUrl: 'download:hero.webp',
    percentChange: -60,
    settingsHash: settings.settingsHash(processorSettings),
  });

  const zeroSizeOutput = await bulkProcessor.processBulkImageJob({
    job: session.createImageJob('zero-size-job', makeFile('empty.webp', '', 0)),
    globalSettings: processorSettings,
    workerBridge: fakeWorkerBridge,
    signal,
    createDownloadUrl: (file) => `download:${file.name}`,
    pipeline: {
      async decodeImage() {
        return fakeDecoded;
      },
      async preprocessImage() {
        return fakePreprocessed;
      },
      async processImage() {
        return fakeProcessed;
      },
      async compressImage() {
        return fakeOutputFile;
      },
    },
  });

  assert.equal(zeroSizeOutput.percentChange, 0);

  await assert.rejects(
    () =>
      bulkProcessor.processBulkImageJob({
        job,
        globalSettings: {
          processorState: processorSettings.processorState,
        },
        workerBridge: fakeWorkerBridge,
        signal,
        pipeline: {
          async decodeImage() {
            throw Error('should not decode');
          },
          async preprocessImage() {
            throw Error('should not preprocess');
          },
          async processImage() {
            throw Error('should not process');
          },
          async compressImage() {
            throw Error('should not compress');
          },
        },
      }),
    /requires an encoder/,
  );
}

async function testBulkRunner() {
  const workerA = { name: 'a' };
  const workerB = { name: 'b' };
  const signal = new AbortController().signal;
  const runnerFiles = [
    makeFile('one.png', 'image/png', 1000),
    makeFile('two.png', 'image/png', 2000),
    makeFile('three.png', 'image/png', 3000),
  ];
  const runnerJobs = runnerFiles.map((file, index) =>
    session.createImageJob(`runner-${index}`, file),
  );
  const runnerSession = session.createBulkSession(
    'runner-batch',
    globalSettings,
    runnerJobs,
  );
  const processed = [];

  const processedSession = await bulkRunner.processRunnableBulkJobs(
    runnerSession,
    {
      signal,
      workerBridges: [workerA, workerB],
      concurrency: 2,
      async processJob(job, workerBridge) {
        processed.push([job.id, workerBridge.name]);
        if (job.id === 'runner-1') throw Error('encode failed');
        return {
          file: makeFile(`${job.id}.webp`, 'image/webp', 500),
          size: 500,
          downloadUrl: `download:${job.id}`,
          percentChange: -50,
          settingsHash: 'hash',
        };
      },
    },
  );

  assert.deepEqual(processed, [
    ['runner-0', 'a'],
    ['runner-1', 'b'],
  ]);
  assert.equal(processedSession.activeJobs, 0);
  assert.equal(processedSession.jobs[0].status, 'encoded');
  assert.equal(
    processedSession.jobs[0].output.downloadUrl,
    'download:runner-0',
  );
  assert.equal(processedSession.jobs[1].status, 'failed');
  assert.equal(processedSession.jobs[1].error, 'encode failed');
  assert.equal(processedSession.jobs[2].status, 'queued');

  const abortedController = new AbortController();
  abortedController.abort();
  let abortedProcessCalls = 0;
  await assert.rejects(
    () =>
      bulkRunner.processRunnableBulkJobs(runnerSession, {
        signal: abortedController.signal,
        workerBridges: [workerA],
        async processJob() {
          abortedProcessCalls += 1;
          throw Error('should not process');
        },
      }),
    (err) => err instanceof Error && err.name === 'AbortError',
  );
  assert.equal(abortedProcessCalls, 0);

  await assert.rejects(
    () =>
      bulkRunner.processRunnableBulkJobs(runnerSession, {
        signal,
        workerBridges: [],
      }),
    /requires at least one worker bridge/,
  );

  await assert.rejects(
    () =>
      bulkRunner.processRunnableBulkJobs(runnerSession, {
        signal,
        workerBridges: [workerA],
        concurrency: 1,
        async processJob() {
          const err = new Error('aborted');
          err.name = 'AbortError';
          throw err;
        },
      }),
    /aborted/,
  );
}

function testBulkUrls() {
  const job = {
    ...session.createImageJob('url-job', png),
    previewUrl: 'blob:preview',
    thumbnailUrl: 'blob:thumbnail',
    output: {
      file: makeFile('url-job.webp', 'image/webp', 400),
      size: 400,
      downloadUrl: 'blob:download',
      percentChange: -60,
      settingsHash: 'hash',
    },
  };
  const revoked = [];

  assert.deepEqual(bulkUrls.collectJobObjectUrls(job), [
    'blob:preview',
    'blob:thumbnail',
    'blob:download',
  ]);

  bulkUrls.revokeJobObjectUrls(job, (url) => revoked.push(url));
  assert.deepEqual(revoked, [
    'blob:preview',
    'blob:thumbnail',
    'blob:download',
  ]);

  const sessionRevoked = [];
  bulkUrls.revokeSessionObjectUrls(
    session.createBulkSession('url-batch', globalSettings, [
      job,
      session.createImageJob('empty-url-job', png),
    ]),
    (url) => sessionRevoked.push(url),
  );
  assert.deepEqual(sessionRevoked, [
    'blob:preview',
    'blob:thumbnail',
    'blob:download',
  ]);

  const duplicateUrlJob = {
    ...session.createImageJob('duplicate-url-job', png),
    previewUrl: 'blob:shared',
    thumbnailUrl: 'blob:shared',
    output: {
      file: makeFile('duplicate-url-job.webp', 'image/webp', 400),
      size: 400,
      downloadUrl: 'blob:shared',
      percentChange: -60,
      settingsHash: 'hash',
    },
  };
  const duplicateRevoked = [];

  assert.deepEqual(bulkUrls.collectJobObjectUrls(duplicateUrlJob), [
    'blob:shared',
  ]);

  bulkUrls.revokeSessionObjectUrls(
    session.createBulkSession('duplicate-url-batch', globalSettings, [
      duplicateUrlJob,
      {
        ...session.createImageJob('second-duplicate-url-job', png),
        previewUrl: 'blob:shared',
      },
    ]),
    (url) => duplicateRevoked.push(url),
  );
  assert.deepEqual(duplicateRevoked, ['blob:shared']);
}

class TestAbortSignal extends EventTarget {
  constructor() {
    super();
    this.aborted = false;
    this.addedListeners = 0;
    this.removedListeners = 0;
  }

  addEventListener(type, listener, options) {
    if (type === 'abort') this.addedListeners += 1;
    return super.addEventListener(type, listener, options);
  }

  removeEventListener(type, listener, options) {
    if (type === 'abort') this.removedListeners += 1;
    return super.removeEventListener(type, listener, options);
  }

  abort() {
    this.aborted = true;
    this.dispatchEvent(new Event('abort'));
  }
}

async function testAbortable() {
  const resolvedSignal = new TestAbortSignal();
  assert.equal(
    await lazyUtil.abortable(resolvedSignal, Promise.resolve('done')),
    'done',
  );
  assert.equal(resolvedSignal.addedListeners, 1);
  assert.equal(resolvedSignal.removedListeners, 1);

  const abortedSignal = new TestAbortSignal();
  await assert.rejects(
    async () => {
      const result = lazyUtil.abortable(abortedSignal, new Promise(() => {}));
      abortedSignal.abort();
      await result;
    },
    (err) => err instanceof Error && err.name === 'AbortError',
  );
  assert.equal(abortedSignal.addedListeners, 1);
  assert.equal(abortedSignal.removedListeners, 1);
}

testBulkProcessor()
  .then(testBulkRunner)
  .then(testBulkUrls)
  .then(testAbortable)
  .then(() => {
    console.log('Helper tests passed');
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
