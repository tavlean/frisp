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
  'src/client/lazy-app/bulk/changes.ts',
  'src/client/lazy-app/bulk/detail.ts',
  'src/client/lazy-app/bulk/settings.ts',
  'src/client/lazy-app/bulk/session.ts',
  'src/client/lazy-app/bulk/import.ts',
  'src/client/lazy-app/bulk/index.ts',
  'src/client/lazy-app/bulk/queue.ts',
  'src/client/lazy-app/bulk/export.ts',
  'src/client/lazy-app/bulk/processor.ts',
  'src/client/lazy-app/bulk/runner.ts',
  'src/client/lazy-app/bulk/snapshot.ts',
  'src/client/lazy-app/bulk/size.ts',
  'src/client/lazy-app/bulk/strip.ts',
  'src/client/lazy-app/bulk/summary.ts',
  'src/client/lazy-app/bulk/urls.ts',
  'src/client/lazy-app/abort.ts',
  'src/client/lazy-app/image-decode.ts',
  'src/client/lazy-app/output-filename.ts',
  'src/client/lazy-app/storage.ts',
  'src/client/lazy-app/sw-bridge/support.ts',
  'src/client/lazy-app/util/canvas.ts',
  'src/client/lazy-app/util/index.ts',
  'src/client/lazy-app/util/clean-modify.ts',
  'src/client/lazy-app/util/svg.ts',
  'src/client/lazy-app/Compress/document-title.ts',
  'src/client/lazy-app/Compress/editor-cleanup.ts',
  'src/client/lazy-app/Compress/editor-lifecycle.ts',
  'src/client/lazy-app/Compress/editor-update-workflow.ts',
  'src/client/lazy-app/Compress/display-state.ts',
  'src/client/lazy-app/Compress/editor-state.ts',
  'src/client/lazy-app/Compress/layout-state.ts',
  'src/client/lazy-app/Compress/processing-errors.ts',
  'src/client/lazy-app/Compress/processor-state.ts',
  'src/client/lazy-app/Compress/render-state.ts',
  'src/client/lazy-app/Compress/result-cache.ts',
  'src/client/lazy-app/Compress/side-copy.ts',
  'src/client/lazy-app/Compress/side-copy-workflow.ts',
  'src/client/lazy-app/Compress/side-job-runner.ts',
  'src/client/lazy-app/Compress/side-workflow.ts',
  'src/client/lazy-app/Compress/side-state.ts',
  'src/client/lazy-app/Compress/saved-settings.ts',
  'src/client/lazy-app/Compress/saved-settings-workflow.ts',
  'src/client/lazy-app/Compress/source-job-runner.ts',
  'src/client/lazy-app/Compress/source-workflow.ts',
  'src/client/lazy-app/Compress/source-state.ts',
  'src/client/lazy-app/Compress/update-workflow.ts',
  'src/client/lazy-app/Compress/update-queue.ts',
  'src/client/lazy-app/Compress/update-scheduler.ts',
  'src/client/lazy-app/Compress/viewport-state.ts',
  'src/client/lazy-app/Compress/work-start-runner.ts',
  'src/client/lazy-app/Compress/work-plan.ts',
  'src/client/lazy-app/Compress/Options/encoder-select-state.ts',
  'src/client/lazy-app/Compress/Options/encoder-support.ts',
  'src/client/lazy-app/Compress/Options/Expander/state.ts',
  'src/client/lazy-app/Compress/Options/processor-controls-state.ts',
  'src/client/lazy-app/Compress/Options/Range/state.ts',
  'src/client/lazy-app/Compress/Options/render-state.ts',
  'src/client/lazy-app/Compress/Options/saved-settings-state.ts',
  'src/client/lazy-app/Compress/Options/state.ts',
  'src/client/lazy-app/Compress/Options/workflow.ts',
  'src/client/lazy-app/Compress/Output/control-state.ts',
  'src/client/lazy-app/Compress/Output/draw-state.ts',
  'src/client/lazy-app/Compress/Output/preview-state.ts',
  'src/client/lazy-app/Compress/Output/render-state.ts',
  'src/client/lazy-app/Compress/Output/workflow.ts',
  'src/client/lazy-app/Compress/Results/download-state.ts',
  'src/client/lazy-app/Compress/Results/loading-workflow.ts',
  'src/client/lazy-app/Compress/Results/loading-state.ts',
  'src/client/lazy-app/Compress/Results/pretty-bytes.ts',
  'src/client/lazy-app/Compress/Results/render-state.ts',
  'src/client/lazy-app/Compress/Results/size-state.ts',
  'src/client/initial-app/App/state.ts',
  'src/client/initial-app/App/workflow.ts',
  'src/features/processors/resize/client/preset-state.ts',
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
    'exports.decodeSourceImage = async () => { throw Error("stub decodeSourceImage"); };',
    'exports.preprocessImage = async () => { throw Error("stub preprocessImage"); };',
    'exports.processImage = async () => { throw Error("stub processImage"); };',
    'exports.compressImage = async () => { throw Error("stub compressImage"); };',
  ].join('\n'),
);
writeFileSync(
  join(outDir, 'feature-meta.js'),
  [
    'exports.defaultPreprocessorState = { rotate: { rotate: 0 } };',
    'exports.defaultProcessorState = { resize: { enabled: false }, quantize: { enabled: false } };',
    'exports.encoderMap = { webP: { meta: { defaultOptions: { quality: 80 } } }, mozJPEG: { meta: { defaultOptions: { quality: 75 } } }, "browser-webp": {} };',
  ].join('\n'),
);

global.navigator = global.navigator || { userAgent: 'node' };
const localStorageItems = new Map();
global.localStorage = {
  getItem(key) {
    return localStorageItems.has(key) ? localStorageItems.get(key) : null;
  },
  setItem(key, value) {
    localStorageItems.set(key, String(value));
  },
};

const settings = require(join(outDir, 'bulk', 'settings.js'));
const bulkChanges = require(join(outDir, 'bulk', 'changes.js'));
const bulkDetail = require(join(outDir, 'bulk', 'detail.js'));
const session = require(join(outDir, 'bulk', 'session.js'));
const bulkImport = require(join(outDir, 'bulk', 'import.js'));
const queue = require(join(outDir, 'bulk', 'queue.js'));
const bulkExport = require(join(outDir, 'bulk', 'export.js'));
const bulkProcessor = require(join(outDir, 'bulk', 'processor.js'));
const bulkRunner = require(join(outDir, 'bulk', 'runner.js'));
const bulkSnapshot = require(join(outDir, 'bulk', 'snapshot.js'));
const bulkSize = require(join(outDir, 'bulk', 'size.js'));
const bulkStrip = require(join(outDir, 'bulk', 'strip.js'));
const bulkSummary = require(join(outDir, 'bulk', 'summary.js'));
const bulkUrls = require(join(outDir, 'bulk', 'urls.js'));
const outputFilename = require(join(outDir, 'output-filename.js'));
const lazyStorage = require(join(outDir, 'storage.js'));
const serviceWorkerSupport = require(join(outDir, 'sw-bridge', 'support.js'));
const lazyUtil = require(join(outDir, 'util', 'index.js'));
const cleanModify = require(join(outDir, 'util', 'clean-modify.js'));
const svgUtil = require(join(outDir, 'util', 'svg.js'));
const documentTitle = require(join(outDir, 'Compress', 'document-title.js'));
const editorCleanup = require(join(outDir, 'Compress', 'editor-cleanup.js'));
const editorLifecycle = require(join(
  outDir,
  'Compress',
  'editor-lifecycle.js',
));
const editorUpdateWorkflow = require(join(
  outDir,
  'Compress',
  'editor-update-workflow.js',
));
const editorState = require(join(outDir, 'Compress', 'editor-state.js'));
const displayState = require(join(outDir, 'Compress', 'display-state.js'));
const layoutState = require(join(outDir, 'Compress', 'layout-state.js'));
const processingErrors = require(join(
  outDir,
  'Compress',
  'processing-errors.js',
));
const processorState = require(join(outDir, 'Compress', 'processor-state.js'));
const compressionRenderState = require(join(
  outDir,
  'Compress',
  'render-state.js',
));
const sideState = require(join(outDir, 'Compress', 'side-state.js'));
const sideCopy = require(join(outDir, 'Compress', 'side-copy.js'));
const sideCopyWorkflow = require(join(
  outDir,
  'Compress',
  'side-copy-workflow.js',
));
const sideJobRunner = require(join(outDir, 'Compress', 'side-job-runner.js'));
const sideWorkflow = require(join(outDir, 'Compress', 'side-workflow.js'));
const savedSettings = require(join(outDir, 'Compress', 'saved-settings.js'));
const savedSettingsWorkflow = require(join(
  outDir,
  'Compress',
  'saved-settings-workflow.js',
));
const sourceJobRunner = require(join(
  outDir,
  'Compress',
  'source-job-runner.js',
));
const sourceWorkflow = require(join(outDir, 'Compress', 'source-workflow.js'));
const sourceState = require(join(outDir, 'Compress', 'source-state.js'));
const updateWorkflow = require(join(outDir, 'Compress', 'update-workflow.js'));
const updateScheduler = require(join(
  outDir,
  'Compress',
  'update-scheduler.js',
));
const updateQueue = require(join(outDir, 'Compress', 'update-queue.js'));
const viewportState = require(join(outDir, 'Compress', 'viewport-state.js'));
const workStartRunner = require(join(
  outDir,
  'Compress',
  'work-start-runner.js',
));
const workPlan = require(join(outDir, 'Compress', 'work-plan.js'));
const encoderSelectState = require(join(
  outDir,
  'Compress',
  'Options',
  'encoder-select-state.js',
));
const encoderSupport = require(join(
  outDir,
  'Compress',
  'Options',
  'encoder-support.js',
));
const expanderState = require(join(
  outDir,
  'Compress',
  'Options',
  'Expander',
  'state.js',
));
const processorControlsState = require(join(
  outDir,
  'Compress',
  'Options',
  'processor-controls-state.js',
));
const rangeState = require(join(
  outDir,
  'Compress',
  'Options',
  'Range',
  'state.js',
));
const optionsRenderState = require(join(
  outDir,
  'Compress',
  'Options',
  'render-state.js',
));
const optionsSavedSettings = require(join(
  outDir,
  'Compress',
  'Options',
  'saved-settings-state.js',
));
const optionsState = require(join(outDir, 'Compress', 'Options', 'state.js'));
const optionsWorkflow = require(join(
  outDir,
  'Compress',
  'Options',
  'workflow.js',
));
const outputControlState = require(join(
  outDir,
  'Compress',
  'Output',
  'control-state.js',
));
const outputDrawState = require(join(
  outDir,
  'Compress',
  'Output',
  'draw-state.js',
));
const outputPreviewState = require(join(
  outDir,
  'Compress',
  'Output',
  'preview-state.js',
));
const outputRenderState = require(join(
  outDir,
  'Compress',
  'Output',
  'render-state.js',
));
const outputWorkflow = require(join(
  outDir,
  'Compress',
  'Output',
  'workflow.js',
));
const resultLoadingState = require(join(
  outDir,
  'Compress',
  'Results',
  'loading-state.js',
));
const resultRenderState = require(join(
  outDir,
  'Compress',
  'Results',
  'render-state.js',
));
const resultLoadingWorkflow = require(join(
  outDir,
  'Compress',
  'Results',
  'loading-workflow.js',
));
const resizePresetState = require(join(
  outDir,
  'src',
  'features',
  'processors',
  'resize',
  'client',
  'preset-state.js',
));
const resultDownloadState = require(join(
  outDir,
  'Compress',
  'Results',
  'download-state.js',
));
const ResultCache = require(join(
  outDir,
  'Compress',
  'result-cache.js',
)).default;
const prettyBytes = require(join(
  outDir,
  'Compress',
  'Results',
  'pretty-bytes.js',
)).default;
const resultSizeState = require(join(
  outDir,
  'Compress',
  'Results',
  'size-state.js',
));
const initialAppState = require(join(
  outDir,
  'src',
  'client',
  'initial-app',
  'App',
  'state.js',
));
const initialAppWorkflow = require(join(
  outDir,
  'src',
  'client',
  'initial-app',
  'App',
  'workflow.js',
));

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

const pickedFile = makeFile('picked.png', 'image/png', 123);
assert.deepEqual(
  initialAppState.getInitialAppState('https://sqush.app/?share-target'),
  {
    awaitingShareTarget: true,
    isEditorOpen: false,
    file: undefined,
    Compress: undefined,
  },
);
assert.deepEqual(initialAppState.getInitialAppState('https://sqush.app/'), {
  awaitingShareTarget: false,
  isEditorOpen: false,
  file: undefined,
  Compress: undefined,
});
assert.deepEqual(initialAppState.getCompressLoadedState('Compress'), {
  Compress: 'Compress',
});
assert.deepEqual(initialAppState.getShareTargetErrorState(), {
  awaitingShareTarget: false,
});
assert.deepEqual(initialAppState.getFileEntryState(pickedFile), {
  file: pickedFile,
  isEditorOpen: true,
});
assert.deepEqual(initialAppState.getShareTargetImageState(pickedFile), {
  file: pickedFile,
  awaitingShareTarget: false,
  isEditorOpen: true,
});
assert.deepEqual(initialAppState.getPopStateRouteState('/editor'), {
  isEditorOpen: true,
});
assert.deepEqual(initialAppState.getPopStateRouteState('/'), {
  isEditorOpen: false,
});
assert.deepEqual(initialAppState.getEditorOpenState(), {
  isEditorOpen: true,
});
assert.equal(
  initialAppState.getEditorUrl('https://sqush.app/?share-target'),
  'https://sqush.app/editor?share-target',
);
assert.deepEqual(
  initialAppState.getInitialAppRenderState({
    awaitingShareTarget: true,
    isEditorOpen: false,
    Compress: undefined,
  }),
  { showSpinner: true, showEditor: false, showIntro: false },
);
assert.deepEqual(
  initialAppState.getInitialAppRenderState({
    awaitingShareTarget: false,
    isEditorOpen: true,
    Compress: undefined,
  }),
  { showSpinner: true, showEditor: false, showIntro: false },
);
assert.deepEqual(
  initialAppState.getInitialAppRenderState({
    awaitingShareTarget: false,
    isEditorOpen: true,
    Compress: 'Compress',
  }),
  { showSpinner: false, showEditor: true, showIntro: false },
);
assert.deepEqual(
  initialAppState.getInitialAppRenderState({
    awaitingShareTarget: false,
    isEditorOpen: false,
    Compress: undefined,
  }),
  { showSpinner: false, showEditor: false, showIntro: true },
);

async function testInitialAppWorkflow() {
  const compressEvents = [];
  await initialAppWorkflow.runInitialAppCompressLoadWorkflow({
    compressPromise: Promise.resolve({ default: 'Compress' }),
    isUnmounted: () => false,
    setState: (state) => compressEvents.push(['state', state]),
    showSnack: (message) => compressEvents.push(['snack', message]),
  });
  assert.deepEqual(compressEvents, [['state', { Compress: 'Compress' }]]);

  const failedCompressEvents = [];
  await initialAppWorkflow.runInitialAppCompressLoadWorkflow({
    compressPromise: Promise.reject(new Error('load failed')),
    isUnmounted: () => false,
    setState: (state) => failedCompressEvents.push(['state', state]),
    showSnack: (message) => failedCompressEvents.push(['snack', message]),
  });
  assert.deepEqual(failedCompressEvents, [['snack', 'Failed to load app']]);

  const unmountedCompressEvents = [];
  await initialAppWorkflow.runInitialAppCompressLoadWorkflow({
    compressPromise: Promise.resolve({ default: 'Compress' }),
    isUnmounted: () => true,
    setState: (state) => unmountedCompressEvents.push(['state', state]),
    showSnack: (message) => unmountedCompressEvents.push(['snack', message]),
  });
  assert.deepEqual(unmountedCompressEvents, []);

  const sharedFile = makeFile('shared.png', 'image/png', 123);
  const shareEvents = [];
  await initialAppWorkflow.runInitialAppShareTargetWorkflow({
    swBridgePromise: Promise.resolve({
      offliner(showSnack) {
        shareEvents.push(['offliner']);
        showSnack('Ready offline');
      },
      async getSharedImage() {
        shareEvents.push(['getSharedImage']);
        return sharedFile;
      },
    }),
    isUnmounted: () => false,
    isAwaitingShareTarget: () => true,
    showSnack: (message) => shareEvents.push(['snack', message]),
    setState: (state) => shareEvents.push(['state', state]),
    openEditor: () => shareEvents.push(['openEditor']),
    replaceUrl: (url) => shareEvents.push(['replaceUrl', url]),
  });
  assert.deepEqual(shareEvents, [
    ['offliner'],
    ['snack', 'Ready offline'],
    ['getSharedImage'],
    ['replaceUrl', '/'],
    ['openEditor'],
    [
      'state',
      { file: sharedFile, awaitingShareTarget: false, isEditorOpen: true },
    ],
  ]);

  const ignoredShareEvents = [];
  await initialAppWorkflow.runInitialAppShareTargetWorkflow({
    swBridgePromise: Promise.resolve({
      offliner() {
        ignoredShareEvents.push(['offliner']);
      },
      async getSharedImage() {
        ignoredShareEvents.push(['getSharedImage']);
        return sharedFile;
      },
    }),
    isUnmounted: () => false,
    isAwaitingShareTarget: () => false,
    showSnack: (message) => ignoredShareEvents.push(['snack', message]),
    setState: (state) => ignoredShareEvents.push(['state', state]),
    openEditor: () => ignoredShareEvents.push(['openEditor']),
    replaceUrl: (url) => ignoredShareEvents.push(['replaceUrl', url]),
  });
  assert.deepEqual(ignoredShareEvents, [['offliner']]);

  const failedShareEvents = [];
  await initialAppWorkflow.runInitialAppShareTargetWorkflow({
    swBridgePromise: Promise.resolve({
      offliner() {
        failedShareEvents.push(['offliner']);
      },
      async getSharedImage() {
        throw new Error('missing shared image');
      },
    }),
    isUnmounted: () => false,
    isAwaitingShareTarget: () => true,
    showSnack: (message) => failedShareEvents.push(['snack', message]),
    setState: (state) => failedShareEvents.push(['state', state]),
    openEditor: () => failedShareEvents.push(['openEditor']),
    replaceUrl: (url) => failedShareEvents.push(['replaceUrl', url]),
  });
  assert.deepEqual(failedShareEvents, [
    ['offliner'],
    ['snack', 'Failed to load shared image'],
    ['state', { awaitingShareTarget: false }],
  ]);
}

assert.deepEqual(
  expanderState.getExpanderDerivedState(undefined, {
    children: 'advanced controls',
    outgoingChildren: undefined,
  }),
  { children: undefined, outgoingChildren: 'advanced controls' },
);
assert.deepEqual(
  expanderState.getExpanderDerivedState('new controls', {
    children: 'old controls',
    outgoingChildren: 'closing controls',
  }),
  { children: 'new controls', outgoingChildren: undefined },
);
assert.equal(
  expanderState.getExpanderDerivedState('same controls', {
    children: 'same controls',
    outgoingChildren: undefined,
  }),
  null,
);
assert.deepEqual(expanderState.getExpanderTransitionCompleteState(), {
  outgoingChildren: undefined,
});
assert.deepEqual(rangeState.getRangeTextFocusState(true), {
  textFocused: true,
});
assert.deepEqual(rangeState.getRangeTextFocusState(false), {
  textFocused: false,
});
assert.equal(
  rangeState.getRangeTextValue({ textFocused: true }, '75', 50),
  '75',
);
assert.equal(
  rangeState.getRangeTextValue({ textFocused: false }, '75', 50),
  50,
);
assert.equal(rangeState.getRangeInputValueForCommit(' 75 '), ' 75 ');
assert.equal(rangeState.getRangeInputValueForCommit('   '), undefined);
assert.equal(rangeState.getRangeDisplayPrecision('', '0.25'), 2);
assert.equal(rangeState.getRangeDisplayPrecision('3', '1'), 3);
assert.equal(rangeState.getRangeDisplayValue(7.25, '', '0.1'), '7.3');
assert.equal(rangeState.getRangeDisplayValue(7.25, '2', '1'), '7.25');
assert.equal(rangeState.getRangeDisplayValue(7.25, '', '1'), '7');
assert.equal(rangeState.getRangeDisplayValue(10500, '2', '1'), '10.5k');
assert.deepEqual(
  optionsState.getInitialOptionsState({
    hasLeftSideSettings: true,
    hasRightSideSettings: false,
  }),
  {
    supportedEncoderMap: undefined,
    hasLeftSideSettings: true,
    hasRightSideSettings: false,
  },
);
const supportedEncoderMapForOptions = {
  webP: true,
  avif: false,
};
assert.deepEqual(
  optionsState.getSupportedEncoderMapLoadedState(supportedEncoderMapForOptions),
  { supportedEncoderMap: supportedEncoderMapForOptions },
);
async function testOptionsWorkflow() {
  const calls = [];
  await optionsWorkflow.runSupportedEncoderLoadWorkflow({
    supportedEncoderMapPromise: Promise.resolve(supportedEncoderMapForOptions),
    isUnmounted: () => false,
    onLoaded: (state) => calls.push(['loaded', state]),
  });
  assert.deepEqual(calls, [
    [
      'loaded',
      {
        supportedEncoderMap: supportedEncoderMapForOptions,
      },
    ],
  ]);
  calls.length = 0;
  await optionsWorkflow.runSupportedEncoderLoadWorkflow({
    supportedEncoderMapPromise: Promise.resolve(supportedEncoderMapForOptions),
    isUnmounted: () => true,
    onLoaded: (state) => calls.push(['loaded', state]),
  });
  assert.deepEqual(calls, []);

  const listeners = {
    leftSideSettings: () => calls.push(['left-listener']),
    rightSideSettings: () => calls.push(['right-listener']),
  };
  const eventTarget = {
    addEventListener: (eventKey, listener) => {
      calls.push(['add', eventKey, listener]);
    },
    removeEventListener: (eventKey, listener) => {
      calls.push(['remove', eventKey, listener]);
    },
  };
  optionsWorkflow.addSavedSideSettingsListeners(eventTarget, listeners);
  optionsWorkflow.removeSavedSideSettingsListeners(eventTarget, listeners);
  assert.deepEqual(calls, [
    ['add', 'leftSideSettings', listeners.leftSideSettings],
    ['add', 'rightSideSettings', listeners.rightSideSettings],
    ['remove', 'leftSideSettings', listeners.leftSideSettings],
    ['remove', 'rightSideSettings', listeners.rightSideSettings],
  ]);
}
async function testCompressionUpdateWorkflow() {
  const file = makeFile('same-source.png', 'image/png', 100);
  const preprocessorState = { rotate: { rotate: 0 } };
  const processorState = {
    resize: { enabled: false },
    quantize: { enabled: false },
  };
  const encoderState = { type: 'webP', options: { quality: 80 } };
  const sideSettings = { processorState, encoderState };
  const state = {
    source: { file },
    sides: [
      { latestSettings: sideSettings, encodedSettings: sideSettings },
      { latestSettings: sideSettings, encodedSettings: sideSettings },
    ],
    loading: false,
    preprocessorState,
    encodedPreprocessorState: preprocessorState,
  };
  let runtime = {
    mainJob: undefined,
    sideJobs: [undefined, undefined],
    mainAbortController: new AbortController(),
    sideAbortControllers: [new AbortController(), new AbortController()],
  };
  const appliedStates = [];
  const calledPipeline = () => {
    throw Error('pipeline should not run when no image work is needed');
  };

  await updateWorkflow.runCompressionUpdateWorkflow({
    sourceFile: file,
    currentState: state,
    getRuntime: () => runtime,
    setRuntime: (nextRuntime) => {
      runtime = nextRuntime;
    },
    encodeCache: {
      match: () => undefined,
      add: calledPipeline,
    },
    workerBridges: [{}, {}],
    pipeline: {
      decodeSourceImage: calledPipeline,
      preprocessImage: calledPipeline,
      processImage: calledPipeline,
      compressImage: calledPipeline,
      decodeImage: calledPipeline,
    },
    isUnmounted: () => false,
    showSnack: calledPipeline,
    applyState: (patch) => appliedStates.push(patch),
  });

  assert.deepEqual(runtime.sideJobs, [undefined, undefined]);
  assert.equal(runtime.mainJob, undefined);
  assert.deepEqual(appliedStates, []);
}
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
assert.equal(
  processingErrors.getImageProcessingErrorMessage(
    'source-decoding',
    Error('bad input'),
  ),
  'Source decoding error: Error: bad input',
);
assert.equal(
  processingErrors.getImageProcessingErrorMessage('preprocessing', 'resize'),
  'Preprocessing error: resize',
);
assert.equal(
  processingErrors.getImageProcessingErrorMessage(
    'processing',
    Error('encode failed'),
  ),
  'Processing error: Error: encode failed',
);
assert.equal(encoderSelectState.getEncoderSelectValue(undefined), 'identity');
assert.equal(
  encoderSelectState.getEncoderSelectValue({
    type: 'webP',
    options: { quality: 80 },
  }),
  'webP',
);
assert.equal(
  encoderSelectState.getOriginalImageOptionLabel(undefined),
  'Original Image',
);
assert.equal(
  encoderSelectState.getOriginalImageOptionLabel({
    file: { name: 'photo.png' },
  }),
  'Original Image (photo.png)',
);
assert.deepEqual(
  encoderSelectState.getEncoderSelectOptions({
    webP: { meta: { label: 'WebP' } },
    mozJPEG: { meta: { label: 'MozJPEG' } },
  }),
  [
    { value: 'webP', label: 'WebP' },
    { value: 'mozJPEG', label: 'MozJPEG' },
  ],
);
assert.equal(
  processorControlsState.getProcessorTypeFromControlName('resize.enable'),
  'resize',
);
assert.equal(
  processorControlsState.getProcessorTypeFromControlName('quantize.enable'),
  'quantize',
);
assert.deepEqual(
  processorControlsState.getProcessorStateWithEnabledControl(
    {
      resize: { enabled: false, width: 100 },
      quantize: { enabled: false },
    },
    'resize.enable',
    true,
  ),
  {
    resize: { enabled: true, width: 100 },
    quantize: { enabled: false },
  },
);
assert.deepEqual(
  processorControlsState.getProcessorStateWithOptions(
    {
      resize: { enabled: false, width: 100 },
      quantize: { enabled: false },
    },
    'resize',
    { width: 320 },
  ),
  {
    resize: { enabled: false, width: 320 },
    quantize: { enabled: false },
  },
);
assert.deepEqual(processorControlsState.getResizeOptionsState(undefined), {
  isVector: false,
  inputWidth: 1,
  inputHeight: 1,
});
assert.deepEqual(
  processorControlsState.getResizeOptionsState({
    vectorImage: {},
    preprocessed: {
      width: 640,
      height: 480,
    },
  }),
  {
    isVector: true,
    inputWidth: 640,
    inputHeight: 480,
  },
);
assert.deepEqual(resizePresetState.getResizePresetSize(640, 480, 0.5), {
  width: 320,
  height: 240,
});
assert.deepEqual(resizePresetState.getResizePresetSize(300, 200, 0.3333), {
  width: 100,
  height: 67,
});
assert.equal(
  resizePresetState.getMatchingResizePreset(
    { width: 320, height: 240 },
    640,
    480,
  ),
  0.5,
);
assert.equal(
  resizePresetState.getMatchingResizePreset(
    { width: 321, height: 240 },
    640,
    480,
  ),
  'custom',
);
assert.deepEqual(
  optionsRenderState.getOptionsRenderState({
    index: 1,
    source: {
      file: { name: 'photo.png' },
      preprocessed: { width: 640, height: 480 },
    },
    encoderState: {
      type: 'webP',
      options: { quality: 80 },
    },
    processorState: {
      resize: { enabled: true, width: 320 },
      quantize: { enabled: false },
    },
    savedSideSettingsAvailability: {
      hasLeftSideSettings: false,
      hasRightSideSettings: true,
    },
  }),
  {
    isOriginalImage: false,
    canImportSavedSettings: true,
    resizeOptionsState: {
      isVector: false,
      inputWidth: 640,
      inputHeight: 480,
    },
    resizeEnabled: true,
    quantizeEnabled: false,
    encoderSelectValue: 'webP',
    originalImageOptionLabel: 'Original Image (photo.png)',
  },
);
assert.deepEqual(
  optionsRenderState.getOptionsRenderState({
    index: 0,
    source: undefined,
    encoderState: undefined,
    processorState: {
      resize: { enabled: false },
      quantize: { enabled: true },
    },
    savedSideSettingsAvailability: {
      hasLeftSideSettings: false,
      hasRightSideSettings: true,
    },
  }),
  {
    isOriginalImage: true,
    canImportSavedSettings: false,
    resizeOptionsState: {
      isVector: false,
      inputWidth: 1,
      inputHeight: 1,
    },
    resizeEnabled: false,
    quantizeEnabled: true,
    encoderSelectValue: 'identity',
    originalImageOptionLabel: 'Original Image',
  },
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

const enabledProcessor = processorState.setProcessorEnabled(
  disabledProcessorA,
  'resize',
  true,
);
assert.notEqual(enabledProcessor, disabledProcessorA);
assert.deepEqual(enabledProcessor, {
  resize: { enabled: true, width: 100 },
  quantize: { enabled: false, numColors: 32 },
});
assert.deepEqual(disabledProcessorA, {
  resize: { enabled: false, width: 100 },
  quantize: { enabled: false, numColors: 32 },
});
const resizedProcessor = processorState.mergeProcessorOptions(
  disabledProcessorA,
  'resize',
  { width: 320 },
);
assert.notEqual(resizedProcessor, disabledProcessorA);
assert.deepEqual(resizedProcessor, {
  resize: { enabled: false, width: 320 },
  quantize: { enabled: false, numColors: 32 },
});
assert.deepEqual(disabledProcessorA.resize, { enabled: false, width: 100 });

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
assert.equal(
  documentTitle.getDocumentTitle('Sqush', {
    loading: false,
  }),
  'Sqush',
);
assert.equal(
  documentTitle.getDocumentTitle('Sqush', {
    loading: true,
    filename: 'photo.png',
  }),
  '⏳ photo.png - Sqush',
);
assert.equal(
  documentTitle.getDocumentTitle('Sqush', {
    loading: false,
    filename: 'photo.png',
  }),
  'photo.png - Sqush',
);
const idleTitleState = {
  loading: false,
  source: undefined,
  sides: [{ loading: false }, { loading: false }],
};
const loadingTitleState = {
  loading: false,
  source: {
    file: {
      name: 'photo.png',
    },
  },
  sides: [{ loading: false }, { loading: true }],
};
assert.equal(documentTitle.isEditorLoading(idleTitleState), false);
assert.equal(documentTitle.isEditorLoading(loadingTitleState), true);
assert.deepEqual(documentTitle.getLoadingFileInfo(loadingTitleState), {
  loading: true,
  filename: 'photo.png',
});
assert.equal(
  documentTitle.shouldUpdateDocumentTitle(idleTitleState, loadingTitleState),
  true,
);
assert.equal(
  documentTitle.shouldUpdateDocumentTitle(loadingTitleState, {
    ...loadingTitleState,
    sides: [{ loading: true }, { loading: false }],
  }),
  false,
);
assert.equal(
  documentTitle.shouldUpdateDocumentTitle(loadingTitleState, {
    ...loadingTitleState,
    source: {
      file: {
        name: 'other.png',
      },
    },
  }),
  true,
);
const sharedFile = makeFile('shared.png', 'image/png', 100);
assert.deepEqual(
  editorLifecycle.getEditorUpdateEffects(
    { file: makeFile('old.png', 'image/png', 1) },
    { file: makeFile('new.png', 'image/png', 1) },
    loadingTitleState,
    idleTitleState,
  ),
  {
    sourceFile: makeFile('new.png', 'image/png', 1),
    queueUpdate: 'immediate',
  },
);
assert.deepEqual(
  editorLifecycle.getEditorUpdateEffects(
    { file: sharedFile },
    { file: sharedFile },
    idleTitleState,
    loadingTitleState,
  ),
  {
    loadingFileInfo: {
      loading: true,
      filename: 'photo.png',
    },
    queueUpdate: 'deferred',
  },
);
assert.deepEqual(
  editorLifecycle.getEditorUpdateEffects(
    { file: sharedFile },
    { file: sharedFile },
    loadingTitleState,
    {
      ...loadingTitleState,
      sides: [{ loading: true }, { loading: false }],
    },
  ),
  {
    loadingFileInfo: undefined,
    queueUpdate: 'deferred',
  },
);
assert.deepEqual(
  editorLifecycle.getEditorUpdateScheduleOptions({
    queueUpdate: 'immediate',
  }),
  { immediate: true },
);
assert.deepEqual(
  editorLifecycle.getEditorUpdateScheduleOptions({
    queueUpdate: 'deferred',
  }),
  {},
);
{
  const calls = [];
  const nextFile = makeFile('workflow-new.png', 'image/png', 10);
  editorUpdateWorkflow.runEditorUpdateWorkflow({
    previousProps: { file: makeFile('workflow-old.png', 'image/png', 10) },
    currentProps: { file: nextFile },
    previousState: loadingTitleState,
    currentState: idleTitleState,
    setSourceFile: (file) => calls.push(['source', file]),
    updateDocumentTitle: (loadingFileInfo) =>
      calls.push(['title', loadingFileInfo]),
    queueUpdateImage: (options) => calls.push(['queue', options]),
  });
  assert.deepEqual(calls, [
    ['source', nextFile],
    ['queue', { immediate: true }],
  ]);
}
{
  const calls = [];
  editorUpdateWorkflow.runEditorUpdateWorkflow({
    previousProps: { file: sharedFile },
    currentProps: { file: sharedFile },
    previousState: idleTitleState,
    currentState: loadingTitleState,
    setSourceFile: (file) => calls.push(['source', file]),
    updateDocumentTitle: (loadingFileInfo) =>
      calls.push(['title', loadingFileInfo]),
    queueUpdateImage: (options) => calls.push(['queue', options]),
  });
  assert.deepEqual(calls, [
    [
      'title',
      {
        loading: true,
        filename: 'photo.png',
      },
    ],
    ['queue', {}],
  ]);
}
{
  const calls = [];
  editorUpdateWorkflow.runEditorUpdateWorkflow({
    previousProps: { file: sharedFile },
    currentProps: { file: sharedFile },
    previousState: loadingTitleState,
    currentState: {
      ...loadingTitleState,
      sides: [{ loading: true }, { loading: false }],
    },
    setSourceFile: (file) => calls.push(['source', file]),
    updateDocumentTitle: (loadingFileInfo) =>
      calls.push(['title', loadingFileInfo]),
    queueUpdateImage: (options) => calls.push(['queue', options]),
  });
  assert.deepEqual(calls, [['queue', {}]]);
}
assert.deepEqual(updateScheduler.getImageUpdateSchedule(), {
  kind: 'deferred',
  delay: 100,
});
assert.deepEqual(updateScheduler.getImageUpdateSchedule({}, 250), {
  kind: 'deferred',
  delay: 250,
});
assert.deepEqual(updateScheduler.getImageUpdateSchedule({ immediate: true }), {
  kind: 'immediate',
});
{
  const events = [];
  const timers = {
    clearTimeout(timeout) {
      events.push(['clear', timeout]);
    },
    setTimeout(callback, delay) {
      events.push(['set', delay]);
      events.push(['callback-type', typeof callback]);
      return 42;
    },
  };
  assert.equal(
    updateQueue.queueImageUpdate({
      currentTimeout: 7,
      runUpdate() {
        events.push(['run']);
      },
      timers,
    }),
    42,
  );
  assert.deepEqual(events, [
    ['clear', 7],
    ['set', 100],
    ['callback-type', 'function'],
  ]);

  const immediateEvents = [];
  assert.equal(
    updateQueue.queueImageUpdate({
      currentTimeout: 42,
      options: { immediate: true },
      runUpdate() {
        immediateEvents.push(['run']);
      },
      timers: {
        clearTimeout(timeout) {
          immediateEvents.push(['clear', timeout]);
        },
        setTimeout() {
          throw Error('immediate update should not set a timeout');
        },
      },
    }),
    undefined,
  );
  assert.deepEqual(immediateEvents, [['clear', 42], ['run']]);
}
assert.equal(viewportState.mobileWidthMediaQuery, '(max-width: 599px)');
assert.deepEqual(viewportState.getViewportState(true), { mobileView: true });
assert.deepEqual(viewportState.getViewportState(false), { mobileView: false });
const initialDesktopEditorState = editorState.getInitialCompressionState(
  [undefined, undefined],
  false,
);
assert.deepEqual(initialDesktopEditorState.source, undefined);
assert.equal(initialDesktopEditorState.loading, false);
assert.equal(initialDesktopEditorState.mobileView, false);
assert.deepEqual(initialDesktopEditorState.preprocessorState, {
  rotate: { rotate: 0 },
});
assert.deepEqual(
  initialDesktopEditorState.sides[0],
  sideState.getDefaultSideState(0),
);
assert.deepEqual(
  initialDesktopEditorState.sides[1],
  sideState.getDefaultSideState(1),
);
const savedInitialEditorState = editorState.getInitialCompressionState(
  [
    {
      latestSettings: {
        processorState: { resize: { enabled: true, width: 320 } },
        encoderState: {
          type: 'webP',
          options: { quality: 80 },
        },
      },
    },
    undefined,
  ],
  true,
);
assert.equal(savedInitialEditorState.mobileView, true);
assert.equal(
  savedInitialEditorState.sides[0].latestSettings.encoderState.type,
  'webP',
);
assert.deepEqual(
  savedInitialEditorState.sides[0].latestSettings.processorState.resize,
  { enabled: true, width: 320 },
);
assert.equal(savedInitialEditorState.sides[0].loading, false);
assert.deepEqual(
  optionsSavedSettings.getSavedSideSettingsAvailability(
    (key) => key === 'leftSideSettings',
  ),
  {
    hasLeftSideSettings: true,
    hasRightSideSettings: false,
  },
);
assert.equal(
  optionsSavedSettings.canImportSavedSideSettings(
    {
      hasLeftSideSettings: true,
      hasRightSideSettings: false,
    },
    0,
  ),
  true,
);
assert.deepEqual(
  optionsSavedSettings.getSavedSideSettingsAvailabilityUpdate(
    'leftSideSettings',
    {
      hasLeftSideSettings: true,
      hasRightSideSettings: false,
    },
  ),
  { hasLeftSideSettings: true },
);
assert.deepEqual(
  optionsSavedSettings.getSavedSideSettingsAvailabilityUpdate(
    'rightSideSettings',
    {
      hasLeftSideSettings: false,
      hasRightSideSettings: true,
    },
  ),
  { hasRightSideSettings: true },
);
assert.equal(
  optionsSavedSettings.canImportSavedSideSettings(
    {
      hasLeftSideSettings: true,
      hasRightSideSettings: false,
    },
    1,
  ),
  false,
);
assert.equal(sideCopy.getOtherSideIndex(0), 1);
assert.equal(sideCopy.getOtherSideIndex(1), 0);
assert.deepEqual(sideCopy.getCopySideAction(), {
  message: 'Settings copied across',
  timeout: 5000,
  actions: ['undo', 'dismiss'],
});
const copyFile = makeFile('copy.webp', 'image/webp', 123);
const copySourceSides = [
  {
    id: 'left',
    file: copyFile,
    downloadUrl: 'blob:left',
    latestSettings: { id: 'left-settings' },
  },
  {
    id: 'right',
    file: makeFile('right.webp', 'image/webp', 456),
    downloadUrl: 'blob:right',
    latestSettings: { id: 'right-settings' },
  },
];
const copiedSides = sideCopy.copySideToOther(
  copySourceSides,
  0,
  (file) => `blob:copy-${file.name}`,
);
assert.equal(copiedSides.oldSide, copySourceSides[1]);
assert.notEqual(copiedSides.sides, copySourceSides);
assert.equal(copiedSides.sides[0], copySourceSides[0]);
assert.notEqual(copiedSides.sides[1], copySourceSides[0]);
assert.equal(copiedSides.sides[1].file, copyFile);
assert.equal(copiedSides.sides[1].downloadUrl, 'blob:copy-copy.webp');
assert.deepEqual(copiedSides.sides[1].latestSettings, {
  id: 'left-settings',
});
const copiedState = sideCopy.getCopySideChangeState(
  {
    sides: copySourceSides,
    untouched: true,
  },
  1,
  (file) => `blob:copy-${file.name}`,
);
assert.equal(copiedState.oldSide, copySourceSides[0]);
assert.equal(copiedState.sides[1], copySourceSides[1]);
assert.equal(copiedState.sides[0].file.name, 'right.webp');
assert.equal(copiedState.sides[0].downloadUrl, 'blob:copy-right.webp');

async function testSideCopyWorkflow() {
  const applyEvents = [];
  const copyAction = await sideCopyWorkflow.runCopySideToOther({
    index: 0,
    state: { sides: copySourceSides },
    getChangeState(state, index) {
      applyEvents.push(['change', index, state.sides === copySourceSides]);
      return {
        sides: copiedSides.sides,
        oldSide: copiedSides.oldSide,
      };
    },
    onApply(sides) {
      applyEvents.push(['apply', sides === copiedSides.sides]);
    },
    async showSnack(message, options) {
      applyEvents.push(['snack', message, options.timeout, options.actions]);
      return 'undo';
    },
    onRestore(sideIndex, oldSide) {
      applyEvents.push(['restore', sideIndex, oldSide === copySourceSides[1]]);
    },
  });
  assert.deepEqual(copyAction, sideCopy.getCopySideAction());
  assert.deepEqual(applyEvents, [
    ['change', 0, true],
    ['apply', true],
    ['snack', 'Settings copied across', 5000, ['undo', 'dismiss']],
    ['restore', 1, true],
  ]);

  const dismissEvents = [];
  await sideCopyWorkflow.runCopySideToOther({
    index: 1,
    state: { sides: copySourceSides },
    getChangeState() {
      return {
        sides: copiedState.sides,
        oldSide: copiedState.oldSide,
      };
    },
    onApply() {
      dismissEvents.push('apply');
    },
    async showSnack() {
      return 'dismiss';
    },
    onRestore() {
      dismissEvents.push('restore');
    },
  });
  assert.deepEqual(dismissEvents, ['apply']);

  const unmountedEvents = [];
  await sideCopyWorkflow.runCopySideToOther({
    index: 1,
    state: { sides: copySourceSides },
    isUnmounted: () => true,
    getChangeState() {
      return {
        sides: copiedState.sides,
        oldSide: copiedState.oldSide,
      };
    },
    onApply() {
      unmountedEvents.push('apply');
    },
    async showSnack() {
      return 'undo';
    },
    onRestore() {
      unmountedEvents.push('restore');
    },
  });
  assert.deepEqual(unmountedEvents, ['apply']);
}

const sharedPreprocessor = { rotate: { rotate: 0 } };
const sharedProcessor = {
  resize: sharedResize,
  quantize: sharedQuantize,
};
const sharedEncoder = {
  type: 'browser-webp',
  options: { quality: 80 },
};
const stretchResize = {
  ...sharedResize,
  enabled: true,
  fitMethod: 'stretch',
};
const containResize = {
  ...sharedResize,
  enabled: true,
  fitMethod: 'contain',
};
const displayLatestSettings = {
  processorState: {
    resize: containResize,
    quantize: sharedQuantize,
  },
  encoderState: sharedEncoder,
};
const displayEncodedSettings = {
  processorState: {
    resize: stretchResize,
    quantize: sharedQuantize,
  },
  encoderState: sharedEncoder,
};
assert.equal(
  displayState.getDisplaySettings({
    latestSettings: displayLatestSettings,
  }),
  displayLatestSettings,
);
assert.equal(
  displayState.getDisplaySettings({
    latestSettings: displayLatestSettings,
    encodedSettings: displayEncodedSettings,
  }),
  displayEncodedSettings,
);
assert.equal(
  displayState.shouldContainImage({
    latestSettings: displayLatestSettings,
  }),
  true,
);
assert.equal(
  displayState.shouldContainImage({
    latestSettings: displayLatestSettings,
    encodedSettings: displayEncodedSettings,
  }),
  false,
);
assert.equal(
  displayState.shouldContainImage({
    latestSettings: {
      processorState: {
        resize: {
          ...containResize,
          enabled: false,
        },
        quantize: sharedQuantize,
      },
      encoderState: sharedEncoder,
    },
  }),
  false,
);
assert.equal(
  displayState.getSideTypeLabel(
    {
      latestSettings: displayLatestSettings,
    },
    (encoderState) => `Encoder ${encoderState.type}`,
  ),
  'Encoder browser-webp',
);
assert.equal(
  displayState.getSideTypeLabel(
    {
      file: copyFile,
      latestSettings: {
        processorState: sharedProcessor,
        encoderState: undefined,
      },
    },
    () => 'unused',
  ),
  'copy.webp',
);
assert.equal(
  displayState.getSideTypeLabel(
    {
      latestSettings: {
        processorState: sharedProcessor,
        encoderState: undefined,
      },
    },
    () => 'unused',
  ),
  'Original Image',
);
const displaySides = [
  {
    file: copyFile,
    downloadUrl: 'blob:left-display',
    data: { id: 'left-image-data' },
    loading: false,
    latestSettings: displayLatestSettings,
  },
  {
    file: undefined,
    downloadUrl: undefined,
    data: { id: 'right-image-data' },
    loading: true,
    latestSettings: {
      processorState: sharedProcessor,
      encoderState: undefined,
    },
    encodedSettings: displayEncodedSettings,
  },
];
assert.deepEqual(displayState.getOutputDisplayState(displaySides), {
  leftCompressed: { id: 'left-image-data' },
  rightCompressed: { id: 'right-image-data' },
  leftImgContain: true,
  rightImgContain: false,
});
assert.deepEqual(
  displayState.getResultDisplayStates(
    displaySides,
    false,
    false,
    (encoderState) => `Encoder ${encoderState.type}`,
  ),
  [
    {
      downloadUrl: 'blob:left-display',
      imageFile: copyFile,
      loading: false,
      flipSide: false,
      typeLabel: 'Encoder browser-webp',
    },
    {
      downloadUrl: undefined,
      imageFile: undefined,
      loading: true,
      flipSide: true,
      typeLabel: 'Original Image',
    },
  ],
);
assert.deepEqual(
  displayState
    .getResultDisplayStates(displaySides, true, true, () => 'unused')
    .map((side) => ({ loading: side.loading, flipSide: side.flipSide })),
  [
    { loading: true, flipSide: true },
    { loading: true, flipSide: true },
  ],
);
assert.deepEqual(
  displayState.getCompressionDisplayState(
    displaySides,
    false,
    false,
    (encoderState) => `Encoder ${encoderState.type}`,
  ),
  {
    output: {
      leftCompressed: { id: 'left-image-data' },
      rightCompressed: { id: 'right-image-data' },
      leftImgContain: true,
      rightImgContain: false,
    },
    results: [
      {
        downloadUrl: 'blob:left-display',
        imageFile: copyFile,
        loading: false,
        flipSide: false,
        typeLabel: 'Encoder browser-webp',
      },
      {
        downloadUrl: undefined,
        imageFile: undefined,
        loading: true,
        flipSide: true,
        typeLabel: 'Original Image',
      },
    ],
  },
);
assert.deepEqual(
  compressionRenderState.getCompressionRenderState({
    sides: displaySides,
    loading: false,
    mobileView: true,
    getEncoderLabel: (encoderState) => `Encoder ${encoderState.type}`,
  }),
  {
    displayState: {
      output: {
        leftCompressed: { id: 'left-image-data' },
        rightCompressed: { id: 'right-image-data' },
        leftImgContain: true,
        rightImgContain: false,
      },
      results: [
        {
          downloadUrl: 'blob:left-display',
          imageFile: copyFile,
          loading: false,
          flipSide: true,
          typeLabel: 'Encoder browser-webp',
        },
        {
          downloadUrl: undefined,
          imageFile: undefined,
          loading: true,
          flipSide: true,
          typeLabel: 'Original Image',
        },
      ],
    },
    panelLayout: layoutState.getCompressionPanelLayout(true),
  },
);
assert.equal(
  compressionRenderState.getEncoderMapLabel(
    {
      webP: { meta: { label: 'WebP' } },
    },
    { type: 'webP' },
  ),
  'WebP',
);
assert.deepEqual(
  outputPreviewState.getOutputPreviewState({
    mobileView: false,
    originalImage: { width: 640, height: 480 },
    leftImgContain: true,
    rightImgContain: false,
  }),
  {
    orientation: 'horizontal',
    leftImage: {
      width: 640,
      height: 480,
      objectFit: 'contain',
    },
    rightImage: {
      width: 640,
      height: 480,
      objectFit: '',
    },
  },
);
assert.deepEqual(
  outputPreviewState.getOutputPreviewState({
    mobileView: true,
    originalImage: undefined,
    leftImgContain: false,
    rightImgContain: true,
  }),
  {
    orientation: 'vertical',
    leftImage: {
      width: '',
      height: '',
      objectFit: '',
    },
    rightImage: {
      width: '',
      height: '',
      objectFit: 'contain',
    },
  },
);
assert.deepEqual(
  outputRenderState.getOutputRenderState({
    mobileView: true,
    source: {
      file: sharedFile,
      preprocessed: { width: 640, height: 480, id: 'original-image' },
    },
    leftCompressed: { width: 320, height: 240, id: 'left-output' },
    rightCompressed: undefined,
    leftImgContain: false,
    rightImgContain: true,
    scale: 1.234,
  }),
  {
    leftDraw: { width: 320, height: 240, id: 'left-output' },
    rightDraw: { width: 640, height: 480, id: 'original-image' },
    originalImage: { width: 640, height: 480, id: 'original-image' },
    previewState: {
      orientation: 'vertical',
      leftImage: {
        width: 640,
        height: 480,
        objectFit: '',
      },
      rightImage: {
        width: 640,
        height: 480,
        objectFit: 'contain',
      },
    },
    scalePercent: 123,
  },
);
assert.equal(outputControlState.getNextOutputScale(2, 'in'), 2.5);
assert.equal(outputControlState.getNextOutputScale(2, 'out'), 1.6);
assert.deepEqual(outputControlState.getInitialOutputViewControlState(), {
  scale: 1,
  editingScale: false,
  altBackground: false,
  aliasing: false,
});
assert.equal(outputControlState.getOutputScaleFromPercent('125'), 1.25);
assert.equal(outputControlState.getOutputScaleFromPercent(''), undefined);
assert.equal(outputControlState.getOutputScalePercent(1.234), 123);
assert.deepEqual(
  outputControlState.getAliasingToggleState({ aliasing: false }),
  {
    aliasing: true,
  },
);
assert.deepEqual(
  outputControlState.getBackgroundToggleState({ altBackground: true }),
  {
    altBackground: false,
  },
);
assert.deepEqual(outputControlState.getEditingScaleState(true), {
  editingScale: true,
});
assert.deepEqual(outputControlState.getPinchZoomScaleState(1.75), {
  scale: 1.75,
});
assert.equal(
  outputControlState.shouldRetargetOutputEvent({
    eventType: 'mousedown',
    isTwoUpHandle: true,
    alreadyRetargeted: false,
  }),
  false,
);
assert.equal(
  outputControlState.shouldRetargetOutputEvent({
    eventType: 'wheel',
    isTwoUpHandle: true,
    alreadyRetargeted: false,
  }),
  true,
);
assert.equal(
  outputControlState.shouldRetargetOutputEvent({
    eventType: 'touchmove',
    isTwoUpHandle: false,
    alreadyRetargeted: true,
  }),
  false,
);
assert.equal(
  outputControlState.shouldBlurActiveElementAfterOutputRetarget(
    'touchend',
    true,
  ),
  true,
);
assert.equal(
  outputControlState.shouldBlurActiveElementAfterOutputRetarget(
    'touchmove',
    true,
  ),
  false,
);
assert.equal(
  outputControlState.shouldBlurActiveElementAfterOutputRetarget(
    'touchend',
    false,
  ),
  false,
);
assert.deepEqual(
  outputControlState.getRotatedPreprocessorState({
    rotate: { rotate: 270 },
  }),
  {
    rotate: { rotate: 0 },
  },
);
assert.deepEqual(layoutState.getCompressionPanelLayout(false), {
  mode: 'desktop',
  mobileSlots: [
    { key: '0-result', side: 0, content: 'result' },
    { key: '0-options', side: 0, content: 'options' },
    { key: '1-result', side: 1, content: 'result' },
    { key: '1-options', side: 1, content: 'options' },
  ],
  desktopColumns: [
    {
      key: 'left',
      side: 0,
      slots: [
        { key: '0-options', side: 0, content: 'options' },
        { key: '0-result', side: 0, content: 'result' },
      ],
    },
    {
      key: 'right',
      side: 1,
      slots: [
        { key: '1-options', side: 1, content: 'options' },
        { key: '1-result', side: 1, content: 'result' },
      ],
    },
  ],
});
assert.deepEqual(
  layoutState
    .getCompressionPanelLayout(true)
    .mobileSlots.map((slot) => `${slot.side}:${slot.content}`),
  ['0:result', '0:options', '1:result', '1:options'],
);
const sourceDrawable = { id: 'source-drawable' };
const compressedDrawable = { id: 'compressed-drawable' };
assert.deepEqual(
  outputDrawState.getOutputDrawableState({
    source: { file: sharedFile, preprocessed: sourceDrawable },
    leftCompressed: compressedDrawable,
  }),
  {
    leftDraw: compressedDrawable,
    rightDraw: sourceDrawable,
  },
);
assert.equal(
  outputDrawState.didOutputSourceFileChange(
    { source: { file: sharedFile, preprocessed: sourceDrawable } },
    { source: { file: sharedFile, preprocessed: { id: 'new-data' } } },
  ),
  false,
);
assert.equal(
  outputDrawState.didOutputSourceFileChange(
    { source: { file: sharedFile, preprocessed: sourceDrawable } },
    { source: { file: makeFile('other.png', 'image/png', 1) } },
  ),
  true,
);
assert.deepEqual(
  outputDrawState.getOutputPinchZoomUpdate(
    { width: 200, height: 100 },
    { width: 120, height: 120 },
    { x: 10, y: 20, scale: 0.5 },
  ),
  {
    allowChangeEvent: true,
    x: -15,
    y: 45,
  },
);
assert.equal(
  outputDrawState.getOutputPinchZoomUpdate(sourceDrawable, sourceDrawable, {
    x: 10,
    y: 20,
    scale: 0.5,
  }),
  undefined,
);
assert.deepEqual(
  outputDrawState.getOutputUpdatePlan(
    {
      source: {
        file: sharedFile,
        preprocessed: { id: 'old-source', width: 200, height: 100 },
      },
    },
    {
      source: { file: sharedFile, preprocessed: { width: 120, height: 120 } },
      rightCompressed: compressedDrawable,
    },
    { x: 10, y: 20, scale: 0.5 },
  ),
  {
    resetPinchZoom: false,
    pinchZoomUpdate: {
      allowChangeEvent: true,
      x: -15,
      y: 45,
    },
    redrawLeft: true,
    redrawRight: true,
  },
);
assert.deepEqual(
  outputDrawState.getOutputUpdatePlan(
    { source: { file: sharedFile, preprocessed: sourceDrawable } },
    { source: { file: makeFile('other.png', 'image/png', 1) } },
    { x: 10, y: 20, scale: 0.5 },
  ),
  {
    resetPinchZoom: true,
    pinchZoomUpdate: undefined,
    redrawLeft: false,
    redrawRight: false,
  },
);
{
  const calls = [];
  const leftDrawable = { id: 'left-mount', width: 200, height: 100 };
  const rightDrawable = { id: 'right-mount', width: 120, height: 120 };
  outputWorkflow.runOutputMountWorkflow({
    currentProps: {
      source: { file: sharedFile, preprocessed: sourceDrawable },
      leftCompressed: leftDrawable,
      rightCompressed: rightDrawable,
    },
    setPinchZoomTransform: (transform) => calls.push(['transform', transform]),
    drawLeft: (drawable) => calls.push(['left', drawable]),
    drawRight: (drawable) => calls.push(['right', drawable]),
  });
  assert.deepEqual(calls, [
    [
      'transform',
      {
        allowChangeEvent: true,
        x: 0,
        y: 0,
        scale: 1,
      },
    ],
    ['left', leftDrawable],
    ['right', rightDrawable],
  ]);
}
{
  const calls = [];
  const previousPreprocessed = { id: 'old-output', width: 200, height: 100 };
  const nextPreprocessed = { id: 'next-output', width: 120, height: 120 };
  const nextRight = { id: 'next-right', width: 80, height: 80 };
  outputWorkflow.runOutputUpdateWorkflow({
    previousProps: {
      source: { file: sharedFile, preprocessed: previousPreprocessed },
    },
    currentProps: {
      source: { file: sharedFile, preprocessed: nextPreprocessed },
      rightCompressed: nextRight,
    },
    pinchZoom: { x: 10, y: 20, scale: 0.5 },
    setPinchZoomTransform: (transform) => calls.push(['transform', transform]),
    drawLeft: (drawable) => calls.push(['left', drawable]),
    drawRight: (drawable) => calls.push(['right', drawable]),
  });
  assert.deepEqual(calls, [
    [
      'transform',
      {
        allowChangeEvent: true,
        x: -15,
        y: 45,
      },
    ],
    ['left', nextPreprocessed],
    ['right', nextRight],
  ]);
}
{
  const calls = [];
  outputWorkflow.runOutputUpdateWorkflow({
    previousProps: {
      source: { file: sharedFile, preprocessed: sourceDrawable },
    },
    currentProps: {
      source: {
        file: makeFile('other.png', 'image/png', 1),
        preprocessed: sourceDrawable,
      },
    },
    pinchZoom: { x: 10, y: 20, scale: 0.5 },
    setPinchZoomTransform: (transform) => calls.push(['transform', transform]),
    drawLeft: (drawable) => calls.push(['left', drawable]),
    drawRight: (drawable) => calls.push(['right', drawable]),
  });
  assert.deepEqual(calls, [
    [
      'transform',
      {
        allowChangeEvent: true,
        x: 0,
        y: 0,
        scale: 1,
      },
    ],
  ]);
}
assert.deepEqual(
  workPlan.getImageWorkPlan(
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
  ),
  {
    needsDecoding: false,
    needsPreprocessing: false,
    sideWorksNeeded: [
      {
        processing: false,
        encoding: false,
      },
    ],
    jobNeeded: false,
  },
);
assert.deepEqual(
  workPlan.getImageWorkAbortPlan({
    mainJobState: {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    sideJobStates: [
      undefined,
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
  }),
  {
    main: true,
    sides: [false, true],
  },
);
assert.deepEqual(
  workPlan.getRunnableSideJobIndexes([
    { processing: false, encoding: false },
    { processing: true, encoding: true },
    { processing: false, encoding: true },
  ]),
  [1, 2],
);
assert.deepEqual(
  workPlan.getRunnableSideJobs(
    [
      { processing: false, encoding: false },
      { processing: true, encoding: true },
      { processing: false, encoding: true },
    ],
    [
      {
        processorState: sharedProcessor,
        encoderState: undefined,
      },
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
      {
        processorState: sharedProcessor,
        encoderState: undefined,
      },
    ],
  ),
  [
    {
      sideIndex: 1,
      sideWorkNeeded: { processing: true, encoding: true },
      jobState: {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    },
    {
      sideIndex: 2,
      sideWorkNeeded: { processing: false, encoding: true },
      jobState: {
        processorState: sharedProcessor,
        encoderState: undefined,
      },
    },
  ],
);
assert.deepEqual(
  workPlan.getRunnableSideJobs(
    [
      { processing: true, encoding: true },
      { processing: false, encoding: true },
    ],
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
  ),
  [
    {
      sideIndex: 0,
      sideWorkNeeded: { processing: true, encoding: true },
      jobState: {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    },
  ],
);
const activeMainJob = {
  file: copyFile,
  preprocessorState: { rotate: { rotate: 90 } },
};
const activeSideJob = {
  processorState: sharedProcessor,
  encoderState: sharedEncoder,
};
const nextSideJob = {
  processorState: sharedProcessor,
  encoderState: {
    type: 'browser-webp',
    options: { quality: 60 },
  },
};
assert.deepEqual(
  workPlan.getActiveImageJobsAfterStarts(
    {
      mainJob: activeMainJob,
      sideJobs: [activeSideJob, undefined],
    },
    {
      mainJobState: undefined,
      sideJobStates: [undefined, nextSideJob],
    },
  ),
  {
    mainJob: activeMainJob,
    sideJobs: [activeSideJob, nextSideJob],
  },
);
assert.deepEqual(
  workPlan.getActiveImageJobsAfterStarts(
    {
      mainJob: activeMainJob,
      sideJobs: [activeSideJob, undefined],
    },
    {
      mainJobState: {
        file: sharedFile,
        preprocessorState: sharedPreprocessor,
      },
      sideJobStates: [undefined, undefined],
    },
  ),
  {
    mainJob: {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    sideJobs: [activeSideJob, undefined],
  },
);
{
  const oldMainController = new AbortController();
  const oldSideControllers = [new AbortController(), new AbortController()];
  const createdControllers = [];
  const createAbortController = () => {
    const controller = new AbortController();
    createdControllers.push(controller);
    return controller;
  };
  const started = workStartRunner.startImageWork(
    {
      mainJob: activeMainJob,
      sideJobs: [activeSideJob, undefined],
      mainAbortController: oldMainController,
      sideAbortControllers: oldSideControllers,
    },
    {
      mainJobState: {
        file: sharedFile,
        preprocessorState: sharedPreprocessor,
      },
      sideJobStates: [undefined, nextSideJob],
    },
    createAbortController,
  );

  assert.equal(oldMainController.signal.aborted, true);
  assert.equal(oldSideControllers[0].signal.aborted, false);
  assert.equal(oldSideControllers[1].signal.aborted, true);
  assert.equal(started.mainAbortController, createdControllers[0]);
  assert.equal(started.sideAbortControllers[0], oldSideControllers[0]);
  assert.equal(started.sideAbortControllers[1], createdControllers[1]);
  assert.equal(started.mainSignal, started.mainAbortController.signal);
  assert.deepEqual(started.sideSignals, [
    oldSideControllers[0].signal,
    createdControllers[1].signal,
  ]);
  assert.deepEqual(started.abortPlan, {
    main: true,
    sides: [false, true],
  });
  assert.deepEqual(
    {
      mainJob: started.mainJob,
      sideJobs: started.sideJobs,
    },
    {
      mainJob: {
        file: sharedFile,
        preprocessorState: sharedPreprocessor,
      },
      sideJobs: [activeSideJob, nextSideJob],
    },
  );
}
{
  const mainAbortController = new AbortController();
  const sideAbortControllers = [new AbortController(), new AbortController()];
  const started = workStartRunner.startImageWork(
    {
      mainJob: activeMainJob,
      sideJobs: [activeSideJob, nextSideJob],
      mainAbortController,
      sideAbortControllers,
    },
    {
      mainJobState: undefined,
      sideJobStates: [undefined, undefined],
    },
  );

  assert.equal(started.mainAbortController, mainAbortController);
  assert.deepEqual(started.sideAbortControllers, sideAbortControllers);
  assert.equal(mainAbortController.signal.aborted, false);
  assert.equal(sideAbortControllers[0].signal.aborted, false);
  assert.equal(sideAbortControllers[1].signal.aborted, false);
  assert.deepEqual(started.abortPlan, {
    main: false,
    sides: [false, false],
  });
  assert.deepEqual(started.sideJobs, [activeSideJob, nextSideJob]);
}
assert.deepEqual(
  workPlan.getActiveImageJobsAfterMainCompletion({
    mainJob: activeMainJob,
    sideJobs: [activeSideJob, nextSideJob],
  }),
  {
    mainJob: undefined,
    sideJobs: [activeSideJob, nextSideJob],
  },
);
assert.deepEqual(
  workPlan.getActiveImageJobsAfterSideCompletion(
    {
      mainJob: activeMainJob,
      sideJobs: [activeSideJob, nextSideJob],
    },
    0,
  ),
  {
    mainJob: activeMainJob,
    sideJobs: [undefined, nextSideJob],
  },
);
assert.deepEqual(
  workPlan.getImageWorkPlan(
    {},
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    [{}],
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
  ),
  {
    needsDecoding: true,
    needsPreprocessing: true,
    sideWorksNeeded: [
      {
        processing: true,
        encoding: true,
      },
    ],
    jobNeeded: true,
  },
);
assert.deepEqual(
  workPlan.getImageWorkPlan(
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    [
      {
        processorState: sharedProcessor,
      },
    ],
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
  ).sideWorksNeeded,
  [
    {
      processing: true,
      encoding: true,
    },
  ],
);
assert.deepEqual(
  workPlan.getImageWorkPlan(
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
    [
      {
        processorState: sharedProcessor,
        encoderState: {
          type: 'browser-webp',
          options: { quality: 60 },
        },
      },
    ],
  ).sideWorksNeeded,
  [
    {
      processing: false,
      encoding: true,
    },
  ],
);
assert.deepEqual(
  workPlan.getLatestMainJobState(undefined, sharedFile, sharedPreprocessor),
  {
    file: sharedFile,
    preprocessorState: sharedPreprocessor,
  },
);
assert.deepEqual(
  workPlan.getLatestMainJobState(
    {
      file: copyFile,
      preprocessorState: { rotate: { rotate: 90 } },
    },
    sharedFile,
    sharedPreprocessor,
  ),
  {
    file: copyFile,
    preprocessorState: { rotate: { rotate: 90 } },
  },
);
assert.deepEqual(
  workPlan.getLatestSideJobStates(
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
      undefined,
    ],
    [
      {
        latestSettings: {
          processorState: {
            resize: sharedResize,
            quantize: sharedQuantize,
          },
          encoderState: sharedEncoder,
        },
      },
      {
        latestSettings: {
          processorState: sharedProcessor,
          encoderState: sharedEncoder,
        },
        encodedSettings: {
          processorState: sharedProcessor,
          encoderState: sharedEncoder,
        },
      },
    ],
  ),
  [
    {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
  ],
);
assert.deepEqual(workPlan.getMainJobState(sharedFile, sharedPreprocessor), {
  file: sharedFile,
  preprocessorState: sharedPreprocessor,
});
assert.deepEqual(
  workPlan.getSideJobStates([
    {
      latestSettings: {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    },
    {
      latestSettings: {
        processorState: sharedProcessor,
        encoderState: undefined,
      },
    },
  ]),
  [
    {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    {
      processorState: {
        resize: { enabled: false },
        quantize: { enabled: false },
      },
      encoderState: undefined,
    },
  ],
);
assert.deepEqual(
  workPlan.getPlannedImageWork(undefined, [undefined, undefined], sharedFile, {
    source: undefined,
    encodedPreprocessorState: undefined,
    preprocessorState: sharedPreprocessor,
    sides: [
      {
        latestSettings: {
          processorState: sharedProcessor,
          encoderState: sharedEncoder,
        },
      },
      {
        latestSettings: {
          processorState: sharedProcessor,
          encoderState: undefined,
        },
      },
    ],
  }),
  {
    mainJobState: {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    sideJobStates: [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
      {
        processorState: {
          resize: { enabled: false },
          quantize: { enabled: false },
        },
        encoderState: undefined,
      },
    ],
    workStarts: {
      mainJobState: {
        file: sharedFile,
        preprocessorState: sharedPreprocessor,
      },
      sideJobStates: [
        {
          processorState: sharedProcessor,
          encoderState: sharedEncoder,
        },
        {
          processorState: {
            resize: { enabled: false },
            quantize: { enabled: false },
          },
          encoderState: undefined,
        },
      ],
    },
    workPlan: {
      needsDecoding: true,
      needsPreprocessing: true,
      sideWorksNeeded: [
        {
          processing: true,
          encoding: true,
        },
        {
          processing: true,
          encoding: true,
        },
      ],
      jobNeeded: true,
    },
  },
);
assert.deepEqual(
  workPlan.getImageWorkStarts(
    {
      needsDecoding: false,
      needsPreprocessing: false,
      sideWorksNeeded: [
        { processing: false, encoding: false },
        { processing: false, encoding: true },
      ],
      jobNeeded: true,
    },
    {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
      {
        processorState: sharedProcessor,
        encoderState: {
          type: 'browser-webp',
          options: { quality: 60 },
        },
      },
    ],
  ),
  {
    mainJobState: undefined,
    sideJobStates: [
      undefined,
      {
        processorState: sharedProcessor,
        encoderState: {
          type: 'browser-webp',
          options: { quality: 60 },
        },
      },
    ],
  },
);
const sharedPreprocessed = { id: 'preprocessed' };
const sharedProcessed = { id: 'processed' };
const sharedEncodedData = { id: 'encoded-data' };
const sharedEncodedFile = makeFile('encoded.webp', 'image/webp', 80);
assert.deepEqual(
  workPlan.getSideEncodingPlan({
    jobState: {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    sideWorkNeeded: { processing: false, encoding: false },
    sourceFile: sharedFile,
    sourcePreprocessed: sharedPreprocessed,
  }),
  { kind: 'skip' },
);
assert.deepEqual(
  workPlan.getSideEncodingPlan({
    jobState: {
      processorState: sharedProcessor,
      encoderState: undefined,
    },
    sideWorkNeeded: { processing: true, encoding: true },
    sourceFile: sharedFile,
    sourcePreprocessed: sharedPreprocessed,
  }),
  {
    kind: 'original',
    result: {
      file: sharedFile,
      data: sharedPreprocessed,
    },
  },
);
assert.deepEqual(
  workPlan.getSideEncodingPlan({
    cacheResult: {
      file: sharedEncodedFile,
      processed: sharedProcessed,
      data: sharedEncodedData,
    },
    jobState: {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    sideWorkNeeded: { processing: false, encoding: true },
    sourceFile: sharedFile,
    sourcePreprocessed: sharedPreprocessed,
  }),
  {
    kind: 'cache',
    result: {
      file: sharedEncodedFile,
      processed: sharedProcessed,
      data: sharedEncodedData,
    },
  },
);
assert.deepEqual(
  workPlan.getSideEncodingPlan({
    currentProcessed: sharedProcessed,
    jobState: {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    sideWorkNeeded: { processing: false, encoding: true },
    sourceFile: sharedFile,
    sourcePreprocessed: sharedPreprocessed,
  }),
  {
    kind: 'encode',
    encoderState: sharedEncoder,
    needsProcessing: false,
    processed: sharedProcessed,
    processorState: sharedProcessor,
  },
);
assert.deepEqual(
  workPlan.getSideEncodingPlan({
    currentProcessed: sharedProcessed,
    jobState: {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    sideWorkNeeded: { processing: true, encoding: true },
    sourceFile: sharedFile,
    sourcePreprocessed: sharedPreprocessed,
  }),
  {
    kind: 'encode',
    encoderState: sharedEncoder,
    needsProcessing: true,
    processed: undefined,
    processorState: sharedProcessor,
  },
);
let cacheLookupCount = 0;
assert.deepEqual(
  workPlan.getSideJobExecutionPlan({
    currentProcessed: sharedProcessed,
    getCacheResult() {
      cacheLookupCount += 1;
      return {
        file: sharedEncodedFile,
        processed: sharedProcessed,
        data: sharedEncodedData,
      };
    },
    jobState: {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    sideWorkNeeded: { processing: false, encoding: true },
    sourceFile: sharedFile,
    sourcePreprocessed: sharedPreprocessed,
  }),
  {
    kind: 'cache',
    result: {
      file: sharedEncodedFile,
      processed: sharedProcessed,
      data: sharedEncodedData,
    },
  },
);
assert.equal(cacheLookupCount, 1);
assert.deepEqual(
  workPlan.getSideJobExecutionPlan({
    getCacheResult() {
      cacheLookupCount += 1;
      return undefined;
    },
    jobState: {
      processorState: sharedProcessor,
      encoderState: undefined,
    },
    sideWorkNeeded: { processing: true, encoding: true },
    sourceFile: sharedFile,
    sourcePreprocessed: sharedPreprocessed,
  }),
  {
    kind: 'original',
    result: {
      file: sharedFile,
      data: sharedPreprocessed,
    },
  },
);
assert.equal(cacheLookupCount, 1);
assert.deepEqual(
  workPlan.getSideJobEncodedResult(
    {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    {
      file: sharedEncodedFile,
      processed: sharedProcessed,
      data: sharedEncodedData,
    },
  ),
  {
    file: sharedEncodedFile,
    processed: sharedProcessed,
    data: sharedEncodedData,
    processorState: sharedProcessor,
    encoderState: sharedEncoder,
  },
);
const cacheableSidePlan = workPlan.getSideEncodingPlan({
  currentProcessed: sharedProcessed,
  jobState: {
    processorState: sharedProcessor,
    encoderState: sharedEncoder,
  },
  sideWorkNeeded: { processing: false, encoding: true },
  sourceFile: sharedFile,
  sourcePreprocessed: sharedPreprocessed,
});
assert.deepEqual(
  workPlan.getSideJobCacheEntry(
    cacheableSidePlan,
    {
      file: sharedEncodedFile,
      processed: sharedProcessed,
      data: sharedEncodedData,
    },
    sharedPreprocessed,
  ),
  {
    file: sharedEncodedFile,
    processed: sharedProcessed,
    data: sharedEncodedData,
    preprocessed: sharedPreprocessed,
    processorState: sharedProcessor,
    encoderState: sharedEncoder,
  },
);
assert.equal(
  workPlan.getSideJobCacheEntry(
    {
      kind: 'original',
      result: {
        file: sharedFile,
        data: sharedPreprocessed,
      },
    },
    {
      file: sharedFile,
      data: sharedPreprocessed,
    },
    sharedPreprocessed,
  ),
  undefined,
);

async function testSideJobRunner() {
  const signal = new AbortController().signal;
  const workerBridge = { id: 'worker' };
  const source = {
    decoded: { id: 'decoded' },
    preprocessed: sharedPreprocessed,
    file: sharedFile,
  };
  const passthroughPipeline = {
    async processImage() {
      throw Error('processImage should not run');
    },
    async compressImage() {
      throw Error('compressImage should not run');
    },
    async decodeImage() {
      throw Error('decodeImage should not run');
    },
  };

  assert.equal(
    await sideJobRunner.runSideEncodingPlan({
      signal,
      sidePlan: { kind: 'skip' },
      source,
      sourceFileName: sharedFile.name,
      workerBridge,
      pipeline: passthroughPipeline,
    }),
    undefined,
  );
  assert.deepEqual(
    await sideJobRunner.runSideEncodingPlan({
      signal,
      sidePlan: {
        kind: 'original',
        result: {
          file: sharedFile,
          data: sharedPreprocessed,
        },
      },
      source,
      sourceFileName: sharedFile.name,
      workerBridge,
      pipeline: passthroughPipeline,
    }),
    {
      file: sharedFile,
      data: sharedPreprocessed,
    },
  );

  const runEvents = [];
  const processedFromPipeline = { id: 'processed-from-pipeline' };
  const encodedFromPipeline = makeFile('pipeline.webp', 'image/webp', 90);
  const decodedFromPipeline = { id: 'decoded-from-pipeline' };
  const pipeline = {
    async processImage(
      actualSignal,
      actualSource,
      processorState,
      actualWorker,
    ) {
      runEvents.push([
        'process',
        actualSignal === signal,
        actualSource === source,
        processorState === sharedProcessor,
        actualWorker === workerBridge,
      ]);
      return processedFromPipeline;
    },
    async compressImage(
      actualSignal,
      processed,
      encoderState,
      sourceFileName,
      actualWorker,
    ) {
      runEvents.push([
        'compress',
        actualSignal === signal,
        processed === processedFromPipeline,
        encoderState === sharedEncoder,
        sourceFileName,
        actualWorker === workerBridge,
      ]);
      return encodedFromPipeline;
    },
    async decodeImage(actualSignal, file, actualWorker) {
      runEvents.push([
        'decode',
        actualSignal === signal,
        file === encodedFromPipeline,
        actualWorker === workerBridge,
      ]);
      return decodedFromPipeline;
    },
  };
  let processedCallback;
  let cacheCallback;
  const encodedResult = await sideJobRunner.runSideEncodingPlan({
    signal,
    sidePlan: {
      kind: 'encode',
      encoderState: sharedEncoder,
      needsProcessing: true,
      processorState: sharedProcessor,
    },
    source,
    sourceFileName: sharedFile.name,
    workerBridge,
    pipeline,
    onProcessingStart() {
      runEvents.push(['start']);
    },
    onProcessed(processed, processorState) {
      processedCallback = { processed, processorState };
      runEvents.push(['processed']);
    },
    onCacheEntry(cacheEntry) {
      cacheCallback = cacheEntry;
      runEvents.push(['cache']);
    },
  });

  assert.deepEqual(encodedResult, {
    file: encodedFromPipeline,
    data: decodedFromPipeline,
    processed: processedFromPipeline,
  });
  assert.deepEqual(processedCallback, {
    processed: processedFromPipeline,
    processorState: sharedProcessor,
  });
  assert.deepEqual(cacheCallback, {
    file: encodedFromPipeline,
    data: decodedFromPipeline,
    processed: processedFromPipeline,
    preprocessed: sharedPreprocessed,
    processorState: sharedProcessor,
    encoderState: sharedEncoder,
  });
  assert.deepEqual(runEvents, [
    ['start'],
    ['process', true, true, true, true],
    ['processed'],
    ['compress', true, true, true, sharedFile.name, true],
    ['decode', true, true, true],
    ['cache'],
  ]);

  const runnableEvents = [];
  let encodedCallback;
  let completedSideIndex;
  await Promise.all(
    sideJobRunner.runRunnableSideJobs({
      runnableSideJobs: [
        {
          sideIndex: 1,
          sideWorkNeeded: { processing: true, encoding: true },
          jobState: {
            processorState: sharedProcessor,
            encoderState: sharedEncoder,
          },
        },
      ],
      sideSignals: [new AbortController().signal, signal],
      source,
      getCurrentProcessed(sideIndex) {
        runnableEvents.push(['current-processed', sideIndex]);
        return undefined;
      },
      getCacheResult(preprocessed, processorState, encoderState) {
        runnableEvents.push([
          'cache-result',
          preprocessed === sharedPreprocessed,
          processorState === sharedProcessor,
          encoderState === sharedEncoder,
        ]);
        return undefined;
      },
      getWorkerBridge(sideIndex) {
        runnableEvents.push(['worker', sideIndex]);
        return workerBridge;
      },
      pipeline,
      onProcessingStart(sideIndex, actualSignal) {
        runnableEvents.push([
          'runnable-start',
          sideIndex,
          actualSignal === signal,
        ]);
      },
      onProcessed(sideIndex, actualSignal, processed, processorState) {
        runnableEvents.push([
          'runnable-processed',
          sideIndex,
          actualSignal === signal,
          processed === processedFromPipeline,
          processorState === sharedProcessor,
        ]);
      },
      onCacheEntry(cacheEntry) {
        runnableEvents.push([
          'runnable-cache',
          cacheEntry.file === encodedFromPipeline,
        ]);
      },
      onEncodedResult(sideIndex, actualSignal, result) {
        encodedCallback = result;
        runnableEvents.push([
          'runnable-encoded',
          sideIndex,
          actualSignal === signal,
        ]);
      },
      onSideComplete(sideIndex) {
        completedSideIndex = sideIndex;
        runnableEvents.push(['runnable-complete', sideIndex]);
      },
    }),
  );
  assert.deepEqual(encodedCallback, {
    data: decodedFromPipeline,
    file: encodedFromPipeline,
    processed: processedFromPipeline,
    processorState: sharedProcessor,
    encoderState: sharedEncoder,
  });
  assert.equal(completedSideIndex, 1);
  assert.deepEqual(runnableEvents, [
    ['current-processed', 1],
    ['cache-result', true, true, true],
    ['worker', 1],
    ['runnable-start', 1, true],
    ['runnable-processed', 1, true, true, true],
    ['runnable-cache', true],
    ['runnable-encoded', 1, true],
    ['runnable-complete', 1],
  ]);

  const expectedError = Error('side runner failed');
  const errorEvents = [];
  await Promise.all(
    sideJobRunner.runRunnableSideJobs({
      runnableSideJobs: [
        {
          sideIndex: 0,
          sideWorkNeeded: { processing: true, encoding: true },
          jobState: {
            processorState: sharedProcessor,
            encoderState: sharedEncoder,
          },
        },
      ],
      sideSignals: [signal],
      source,
      getCurrentProcessed() {
        return undefined;
      },
      getCacheResult() {
        return undefined;
      },
      getWorkerBridge() {
        return workerBridge;
      },
      pipeline: {
        ...pipeline,
        async processImage() {
          throw expectedError;
        },
      },
      onError(sideIndex, actualSignal, error) {
        errorEvents.push([
          'error',
          sideIndex,
          actualSignal === signal,
          error === expectedError,
        ]);
      },
    }),
  );
  assert.deepEqual(errorEvents, [['error', 0, true, true]]);
  await assert.rejects(
    () =>
      Promise.all(
        sideJobRunner.runRunnableSideJobs({
          runnableSideJobs: [
            {
              sideIndex: 0,
              sideWorkNeeded: { processing: true, encoding: true },
              jobState: {
                processorState: sharedProcessor,
                encoderState: sharedEncoder,
              },
            },
          ],
          sideSignals: [signal],
          source,
          getCurrentProcessed() {
            return undefined;
          },
          getCacheResult() {
            return undefined;
          },
          getWorkerBridge() {
            return workerBridge;
          },
          pipeline: {
            ...pipeline,
            async processImage() {
              throw expectedError;
            },
          },
        }),
      ),
    expectedError,
  );
}

async function testSideWorkflow() {
  const signal = new AbortController().signal;
  const workerBridge = { id: 'side-workflow-worker' };
  const source = {
    decoded: { id: 'decoded' },
    preprocessed: sharedPreprocessed,
    file: sharedFile,
  };
  const processedFromPipeline = { id: 'workflow-processed' };
  const encodedFromPipeline = makeFile('workflow.webp', 'image/webp', 91);
  const decodedFromPipeline = { id: 'workflow-decoded' };
  const events = [];
  const cacheEntries = [];
  const pipeline = {
    async processImage(actualSignal, actualSource, processorState, worker) {
      events.push([
        'process',
        actualSignal === signal,
        actualSource === source,
        processorState === sharedProcessor,
        worker === workerBridge,
      ]);
      return processedFromPipeline;
    },
    async compressImage(
      actualSignal,
      processed,
      encoderState,
      sourceFileName,
      worker,
    ) {
      events.push([
        'compress',
        actualSignal === signal,
        processed === processedFromPipeline,
        encoderState === sharedEncoder,
        sourceFileName,
        worker === workerBridge,
      ]);
      return encodedFromPipeline;
    },
    async decodeImage(actualSignal, file, worker) {
      events.push([
        'decode',
        actualSignal === signal,
        file === encodedFromPipeline,
        worker === workerBridge,
      ]);
      return decodedFromPipeline;
    },
  };

  await Promise.all(
    sideWorkflow.runSideImageWorkflow({
      sideWorksNeeded: [{ processing: true, encoding: true }],
      sideJobStates: [
        {
          processorState: sharedProcessor,
          encoderState: sharedEncoder,
        },
      ],
      sideSignals: [signal],
      source,
      sides: [{ processed: undefined }],
      encodeCache: {
        match(preprocessed, processorState, encoderState) {
          events.push([
            'cache-match',
            preprocessed === sharedPreprocessed,
            processorState === sharedProcessor,
            encoderState === sharedEncoder,
          ]);
          return undefined;
        },
        add(cacheEntry) {
          cacheEntries.push(cacheEntry);
          events.push(['cache-add']);
        },
      },
      getWorkerBridge(sideIndex) {
        events.push(['worker', sideIndex]);
        return workerBridge;
      },
      pipeline,
      isUnmounted: () => false,
      showSnack(message) {
        events.push(['snack', message]);
      },
      onProcessingStart(sideIndex, actualSignal) {
        events.push(['start', sideIndex, actualSignal === signal]);
      },
      onProcessed(sideIndex, actualSignal, processed, processorState) {
        events.push([
          'processed',
          sideIndex,
          actualSignal === signal,
          processed === processedFromPipeline,
          processorState === sharedProcessor,
        ]);
      },
      onEncodedResult(sideIndex, actualSignal, result) {
        events.push([
          'encoded',
          sideIndex,
          actualSignal === signal,
          result.file === encodedFromPipeline,
          result.data === decodedFromPipeline,
        ]);
      },
      onSideComplete(sideIndex) {
        events.push(['complete', sideIndex]);
      },
    }),
  );
  assert.equal(cacheEntries.length, 1);
  assert.deepEqual(events, [
    ['cache-match', true, true, true],
    ['worker', 0],
    ['start', 0, true],
    ['process', true, true, true, true],
    ['processed', 0, true, true, true],
    ['compress', true, true, true, sharedFile.name, true],
    ['decode', true, true, true],
    ['cache-add'],
    ['encoded', 0, true, true, true],
    ['complete', 0],
  ]);

  const expectedError = Error('workflow failed');
  const errorEvents = [];
  await assert.rejects(
    () =>
      Promise.all(
        sideWorkflow.runSideImageWorkflow({
          sideWorksNeeded: [{ processing: true, encoding: true }],
          sideJobStates: [
            {
              processorState: sharedProcessor,
              encoderState: sharedEncoder,
            },
          ],
          sideSignals: [signal],
          source,
          sides: [{}],
          encodeCache: {
            match() {
              return undefined;
            },
            add() {
              throw Error('cache should not update on error');
            },
          },
          getWorkerBridge() {
            return workerBridge;
          },
          pipeline: {
            ...pipeline,
            async processImage() {
              throw expectedError;
            },
          },
          isUnmounted: () => false,
          showSnack(message) {
            errorEvents.push(['snack', message.includes('Processing')]);
          },
          onProcessingError(sideIndex, actualSignal, error) {
            errorEvents.push([
              'processing-error',
              sideIndex,
              actualSignal === signal,
              error === expectedError,
            ]);
          },
        }),
      ),
    expectedError,
  );
  assert.deepEqual(errorEvents, [
    ['processing-error', 0, true, true],
    ['snack', true],
  ]);

  const abortEvents = [];
  const abortError = Error('aborted');
  abortError.name = 'AbortError';
  await Promise.all(
    sideWorkflow.runSideImageWorkflow({
      sideWorksNeeded: [{ processing: true, encoding: true }],
      sideJobStates: [
        {
          processorState: sharedProcessor,
          encoderState: sharedEncoder,
        },
      ],
      sideSignals: [signal],
      source,
      sides: [{}],
      encodeCache: {
        match() {
          return undefined;
        },
        add() {
          abortEvents.push('cache');
        },
      },
      getWorkerBridge() {
        return workerBridge;
      },
      pipeline: {
        ...pipeline,
        async processImage() {
          throw abortError;
        },
      },
      isUnmounted: () => false,
      showSnack() {
        abortEvents.push('snack');
      },
      onProcessingError() {
        abortEvents.push('processing-error');
      },
    }),
  );
  assert.deepEqual(abortEvents, []);
}

async function testSourceJobRunner() {
  const signal = new AbortController().signal;
  const workerBridge = { id: 'source-worker' };
  const decodedSource = {
    file: sharedFile,
    decoded: { id: 'decoded' },
    vectorImage: { id: 'vector-image' },
  };
  const preprocessed = { id: 'source-preprocessed' };
  const runEvents = [];
  const pipeline = {
    async decodeSourceImage(actualSignal, file, actualWorker) {
      runEvents.push([
        'decode',
        actualSignal === signal,
        file === sharedFile,
        actualWorker === workerBridge,
      ]);
      return decodedSource;
    },
    async preprocessImage(
      actualSignal,
      decoded,
      preprocessorState,
      actualWorker,
    ) {
      runEvents.push([
        'preprocess',
        actualSignal === signal,
        decoded === decodedSource.decoded,
        preprocessorState === sharedPreprocessor,
        actualWorker === workerBridge,
      ]);
      return preprocessed;
    },
  };
  let decodedCallback;
  const actualDecodedSource = await sourceJobRunner.runSourceDecode({
    signal,
    file: sharedFile,
    workerBridge,
    pipeline,
    onDecodeStart() {
      runEvents.push(['decode-start']);
    },
    onDecoded(result) {
      decodedCallback = result;
      runEvents.push(['decoded']);
    },
  });
  assert.equal(actualDecodedSource, decodedSource);
  assert.equal(decodedCallback, decodedSource);

  let preprocessedCallback;
  const source = await sourceJobRunner.runSourcePreprocess({
    signal,
    decodedSource,
    preprocessorState: sharedPreprocessor,
    workerBridge,
    pipeline,
    onPreprocessStart() {
      runEvents.push(['preprocess-start']);
    },
    onPreprocessed(result) {
      preprocessedCallback = result;
      runEvents.push(['preprocessed']);
    },
  });
  assert.deepEqual(source, {
    ...decodedSource,
    preprocessed,
  });
  assert.deepEqual(preprocessedCallback, source);
  assert.deepEqual(runEvents, [
    ['decode-start'],
    ['decode', true, true, true],
    ['decoded'],
    ['preprocess-start'],
    ['preprocess', true, true, true, true],
    ['preprocessed'],
  ]);

  const abortedController = new AbortController();
  abortedController.abort();
  const abortedEvents = [];
  await assert.rejects(
    () =>
      sourceJobRunner.runSourceDecode({
        signal: abortedController.signal,
        file: sharedFile,
        workerBridge,
        pipeline: {
          async decodeSourceImage() {
            abortedEvents.push('decode');
            return decodedSource;
          },
        },
        onDecodeStart() {
          abortedEvents.push('decode-start');
        },
      }),
    { name: 'AbortError' },
  );
  assert.deepEqual(abortedEvents, []);
}

async function testSourceWorkflow() {
  const signal = new AbortController().signal;
  const workerBridge = { id: 'source-workflow-worker' };
  const decodedSource = {
    file: sharedFile,
    decoded: { id: 'workflow-decoded' },
    vectorImage: undefined,
  };
  const preprocessed = { id: 'workflow-preprocessed' };
  const source = {
    ...decodedSource,
    preprocessed,
  };
  const events = [];
  const pipeline = {
    async decodeSourceImage(actualSignal, file, actualWorker) {
      events.push([
        'decode',
        actualSignal === signal,
        file === sharedFile,
        actualWorker === workerBridge,
      ]);
      return decodedSource;
    },
    async preprocessImage(
      actualSignal,
      decoded,
      preprocessorState,
      actualWorker,
    ) {
      events.push([
        'preprocess',
        actualSignal === signal,
        decoded === decodedSource.decoded,
        preprocessorState === sharedPreprocessor,
        actualWorker === workerBridge,
      ]);
      return preprocessed;
    },
  };

  const actualSource = await sourceWorkflow.runSourceImageWorkflow({
    signal,
    currentSource: undefined,
    mainJobState: {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    workPlan: {
      needsDecoding: true,
      needsPreprocessing: true,
    },
    workerBridge,
    pipeline,
    isUnmounted: () => false,
    showSnack(message) {
      events.push(['snack', message]);
    },
    onDecodeStart() {
      events.push(['decode-start']);
    },
    onDecoded(result) {
      events.push(['decoded', result === decodedSource]);
    },
    onPreprocessStart() {
      events.push(['preprocess-start']);
    },
    onPreprocessed(result) {
      events.push(['preprocessed', result.preprocessed === preprocessed]);
    },
  });
  assert.deepEqual(actualSource, source);
  assert.deepEqual(events, [
    ['decode-start'],
    ['decode', true, true, true],
    ['decoded', true],
    ['preprocess-start'],
    ['preprocess', true, true, true, true],
    ['preprocessed', true],
  ]);

  const existingSource = { ...source, preprocessed: { id: 'existing' } };
  const reusedSource = await sourceWorkflow.runSourceImageWorkflow({
    signal,
    currentSource: existingSource,
    mainJobState: {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    workPlan: {
      needsDecoding: false,
      needsPreprocessing: false,
    },
    workerBridge,
    pipeline: {
      async decodeSourceImage() {
        throw Error('decode should not run');
      },
      async preprocessImage() {
        throw Error('preprocess should not run');
      },
    },
    isUnmounted: () => false,
    showSnack() {
      throw Error('snack should not run');
    },
  });
  assert.equal(reusedSource, existingSource);

  const abortEvents = [];
  const abortedSource = await sourceWorkflow.runSourceImageWorkflow({
    signal,
    currentSource: undefined,
    mainJobState: {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    workPlan: {
      needsDecoding: true,
      needsPreprocessing: true,
    },
    workerBridge,
    pipeline: {
      async decodeSourceImage() {
        const err = Error('aborted');
        err.name = 'AbortError';
        throw err;
      },
      async preprocessImage() {
        abortEvents.push('preprocess');
        return preprocessed;
      },
    },
    isUnmounted: () => false,
    showSnack() {
      abortEvents.push('snack');
    },
  });
  assert.equal(abortedSource, undefined);
  assert.deepEqual(abortEvents, []);

  const preprocessError = Error('preprocess failed');
  const errorEvents = [];
  await assert.rejects(
    () =>
      sourceWorkflow.runSourceImageWorkflow({
        signal,
        currentSource: undefined,
        mainJobState: {
          file: sharedFile,
          preprocessorState: sharedPreprocessor,
        },
        workPlan: {
          needsDecoding: true,
          needsPreprocessing: true,
        },
        workerBridge,
        pipeline: {
          ...pipeline,
          async preprocessImage() {
            throw preprocessError;
          },
        },
        isUnmounted: () => false,
        showSnack(message) {
          errorEvents.push(['snack', message.includes('Preprocessing')]);
        },
        onPreprocessError() {
          errorEvents.push(['preprocess-error']);
        },
      }),
    preprocessError,
  );
  assert.deepEqual(errorEvents, [['preprocess-error'], ['snack', true]]);

  const unmountedErrorSource = await sourceWorkflow.runSourceImageWorkflow({
    signal,
    currentSource: undefined,
    mainJobState: {
      file: sharedFile,
      preprocessorState: sharedPreprocessor,
    },
    workPlan: {
      needsDecoding: true,
      needsPreprocessing: true,
    },
    workerBridge,
    pipeline: {
      ...pipeline,
      async decodeSourceImage() {
        throw Error('decode failed after unmount');
      },
    },
    isUnmounted: () => true,
    showSnack() {
      throw Error('snack should not run after unmount');
    },
  });
  assert.equal(unmountedErrorSource, undefined);
}

assert.deepEqual(
  workPlan.getPlannedImageWork(
    {
      file: copyFile,
      preprocessorState: { rotate: { rotate: 90 } },
    },
    [
      {
        processorState: sharedProcessor,
        encoderState: sharedEncoder,
      },
    ],
    sharedFile,
    {
      source: { file: sharedFile },
      encodedPreprocessorState: sharedPreprocessor,
      preprocessorState: sharedPreprocessor,
      sides: [
        {
          latestSettings: {
            processorState: sharedProcessor,
            encoderState: sharedEncoder,
          },
        },
      ],
    },
  ).workPlan,
  {
    needsDecoding: true,
    needsPreprocessing: true,
    sideWorksNeeded: [
      {
        processing: true,
        encoding: true,
      },
    ],
    jobNeeded: true,
  },
);
assert.deepEqual(
  sourceState.getDefaultResizeState({ width: 640, height: 480 }, false),
  {
    width: 640,
    height: 480,
    method: 'lanczos3',
    enabled: false,
  },
);
assert.deepEqual(
  sourceState.getDefaultResizeState({ width: 640, height: 480 }, true),
  {
    width: 640,
    height: 480,
    method: 'vector',
    enabled: false,
  },
);
const defaultResizeSides = [
  {
    id: 'left',
    latestSettings: {
      processorState: {
        resize: { enabled: true, width: 10, height: 20, method: 'triangle' },
        quantize: sharedQuantize,
      },
    },
  },
  {
    id: 'right',
    latestSettings: {
      processorState: {
        resize: { enabled: true, width: 30, height: 40, method: 'catrom' },
        quantize: sharedQuantize,
      },
    },
  },
];
const resetResizeSides = sourceState.getDefaultResizeSides(
  defaultResizeSides,
  { width: 640, height: 480 },
  true,
);
assert.notEqual(resetResizeSides, defaultResizeSides);
assert.equal(resetResizeSides[0].id, 'left');
assert.deepEqual(resetResizeSides[0].latestSettings.processorState.resize, {
  enabled: false,
  width: 640,
  height: 480,
  method: 'vector',
});
assert.deepEqual(resetResizeSides[1].latestSettings.processorState.resize, {
  enabled: false,
  width: 640,
  height: 480,
  method: 'vector',
});
assert.equal(
  defaultResizeSides[0].latestSettings.processorState.resize.width,
  10,
);
const decodeSuccessState = sourceState.getSourceDecodeSuccessState(
  {
    sides: defaultResizeSides,
    loading: true,
  },
  { width: 320, height: 240 },
  false,
);
assert.deepEqual(decodeSuccessState, {
  sides: [
    {
      id: 'left',
      latestSettings: {
        processorState: {
          resize: {
            enabled: false,
            width: 320,
            height: 240,
            method: 'lanczos3',
          },
          quantize: sharedQuantize,
        },
      },
    },
    {
      id: 'right',
      latestSettings: {
        processorState: {
          resize: {
            enabled: false,
            width: 320,
            height: 240,
            method: 'lanczos3',
          },
          quantize: sharedQuantize,
        },
      },
    },
  ],
});
assert.deepEqual(sourceState.getSourceDecodeStartState(), {
  source: undefined,
  loading: true,
});
assert.deepEqual(sourceState.getSourcePreprocessStartState(), {
  loading: true,
});
assert.deepEqual(sourceState.getSourcePreprocessErrorState(), {
  loading: false,
});
assert.equal(sourceState.didOrientationChange(0, 90), true);
assert.equal(sourceState.didOrientationChange(90, 270), false);
assert.equal(sourceState.didOrientationChange(180, 270), true);
assert.deepEqual(
  sourceState.getOrientationAdjustedResizeState({
    width: 640,
    height: 480,
  }),
  {
    width: 480,
    height: 640,
  },
);
const orientationSides = [
  {
    id: 'left',
    latestSettings: {
      processorState: {
        resize: { enabled: true, width: 640, height: 480, method: 'lanczos3' },
        quantize: sharedQuantize,
      },
    },
  },
  {
    id: 'right',
    latestSettings: {
      processorState: {
        resize: { enabled: false, width: 320, height: 200, method: 'vector' },
        quantize: sharedQuantize,
      },
    },
  },
];
const adjustedOrientationSides =
  sourceState.getOrientationAdjustedSides(orientationSides);
assert.notEqual(adjustedOrientationSides, orientationSides);
assert.equal(adjustedOrientationSides[0].id, 'left');
assert.deepEqual(
  adjustedOrientationSides[0].latestSettings.processorState.resize,
  {
    enabled: true,
    width: 480,
    height: 640,
    method: 'lanczos3',
  },
);
assert.deepEqual(
  adjustedOrientationSides[1].latestSettings.processorState.resize,
  {
    enabled: false,
    width: 200,
    height: 320,
    method: 'vector',
  },
);
assert.equal(
  orientationSides[0].latestSettings.processorState.resize.width,
  640,
);
const preprocessorChangeState = {
  source: { id: 'source' },
  loading: false,
  preprocessorState: { rotate: { rotate: 0 } },
  sides: orientationSides,
};
const unchangedPreprocessorUpdate = sourceState.getPreprocessorChangeState(
  preprocessorChangeState,
  { rotate: { rotate: 180 } },
);
assert.deepEqual(unchangedPreprocessorUpdate, {
  loading: true,
  preprocessorState: { rotate: { rotate: 180 } },
  sides: orientationSides,
});
const rotatedPreprocessorUpdate = sourceState.getPreprocessorChangeState(
  preprocessorChangeState,
  { rotate: { rotate: 90 } },
);
assert.equal(rotatedPreprocessorUpdate.loading, true);
assert.deepEqual(rotatedPreprocessorUpdate.preprocessorState, {
  rotate: { rotate: 90 },
});
assert.deepEqual(
  rotatedPreprocessorUpdate.sides[0].latestSettings.processorState.resize,
  {
    enabled: true,
    width: 480,
    height: 640,
    method: 'lanczos3',
  },
);
assert.deepEqual(
  sourceState.getPreprocessorChangeState(
    { ...preprocessorChangeState, source: undefined },
    { rotate: { rotate: 90 } },
  ),
  undefined,
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
assert.deepEqual(
  imported.rejections.map((rejection) => ({
    fileName: rejection.file.name,
    reason: rejection.reason,
  })),
  [
    { fileName: 'notes.txt', reason: 'unsupported-type' },
    { fileName: 'image-file', reason: 'unsupported-type' },
    { fileName: 'image.', reason: 'unsupported-type' },
  ],
);
assert.equal(imported.accepted[0].originalSize, 1000);
assert.equal(imported.accepted[1].originalSize, 800);
assert.equal(imported.accepted[2].originalSize, 700);
assert.equal(imported.accepted[3].originalSize, 600);
assert.equal(imported.accepted[4].originalSize, 500);
assert.deepEqual(bulkImport.getBulkImportSummary(imported), {
  accepted: 5,
  rejected: 3,
  rejectedUnsupported: 3,
  rejectedUnreadable: 0,
  totalAcceptedSize: 3600,
  totalRejectedSize: 300,
});
const importedSession = bulkImport.createBulkSessionFromImport(
  'imported-batch',
  globalSettings,
  imported,
);
assert.deepEqual(
  {
    ...importedSession,
    jobs: importedSession.jobs.map((job) => job.id),
  },
  {
    id: 'imported-batch',
    globalSettings,
    jobs: [
      '0-hero.png-1000-1',
      '1-hero.AVIF-800-1',
      '2-photo.jfif-700-1',
      '3-scan.TIFF-600-1',
      '4-diagram.bmp-500-1',
    ],
    selectedJobId: '0-hero.png-1000-1',
    activeJobs: 0,
    exportedCount: 0,
  },
);
const appendedImportSession = bulkImport.addBulkImportToSession(
  importedSession,
  bulkImport.createImageJobs([png, text]),
);
assert.deepEqual(
  appendedImportSession.jobs.map((job) => job.id),
  [
    '0-hero.png-1000-1',
    '1-hero.AVIF-800-1',
    '2-photo.jfif-700-1',
    '3-scan.TIFF-600-1',
    '4-diagram.bmp-500-1',
    '0-hero.png-1000-1-2',
  ],
);
assert.equal(appendedImportSession.selectedJobId, '0-hero.png-1000-1');

async function testBulkImportWithMimeSniffing() {
  const extensionlessPng = makeFile('extensionless-image', '', 400);
  const renamedImage = makeFile('renamed-image.bin', '', 300);
  const rejectedBinary = makeFile('binary.bin', '', 200);
  const unreadableFile = makeFile('unreadable.bin', '', 100);
  const sniffedTypes = new Map([
    [extensionlessPng, 'image/png'],
    [renamedImage, 'image/avif'],
    [rejectedBinary, 'application/octet-stream'],
  ]);
  const sniffedFiles = [];
  const result = await bulkImport.createImageJobsWithMimeSniffing(
    [png, extensionlessPng, renamedImage, rejectedBinary, unreadableFile],
    async (file) => {
      sniffedFiles.push(file.name);
      if (file === unreadableFile) throw new Error('cannot read file');
      return sniffedTypes.get(file) || '';
    },
  );

  assert.deepEqual(sniffedFiles, [
    'extensionless-image',
    'renamed-image.bin',
    'binary.bin',
    'unreadable.bin',
  ]);
  assert.deepEqual(
    result.accepted.map((job) => job.sourceFile.name),
    ['hero.png', 'extensionless-image', 'renamed-image.bin'],
  );
  assert.deepEqual(
    result.accepted.map((job) => job.id),
    [
      '0-hero.png-1000-1',
      '1-extensionless-image-400-1',
      '2-renamed-image.bin-300-1',
    ],
  );
  assert.deepEqual(
    result.rejected.map((file) => file.name),
    ['binary.bin', 'unreadable.bin'],
  );
  assert.deepEqual(
    result.rejections.map((rejection) => ({
      fileName: rejection.file.name,
      reason: rejection.reason,
    })),
    [
      { fileName: 'binary.bin', reason: 'unsupported-type' },
      { fileName: 'unreadable.bin', reason: 'unreadable' },
    ],
  );
  assert.deepEqual(bulkImport.getBulkImportSummary(result), {
    accepted: 3,
    rejected: 2,
    rejectedUnsupported: 1,
    rejectedUnreadable: 1,
    totalAcceptedSize: 1700,
    totalRejectedSize: 300,
  });
}

assert.deepEqual(session.imageJobStatuses, [
  'queued',
  'decoding',
  'processing',
  'encoded',
  'failed',
  'skipped',
  'exported',
]);
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
assert.deepEqual(
  ['queued', 'decoding', 'processing', 'encoded'].map((status) =>
    session.isActiveImageJobStatus(status),
  ),
  [false, true, true, false],
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
assert.deepEqual(
  {
    ...queue.getBulkQueueState(queuedSession, 2.8),
    runnableJobs: queue
      .getBulkQueueState(queuedSession, 2.8)
      .runnableJobs.map((job) => job.id),
  },
  {
    concurrency: 2,
    activeJobs: 0,
    queuedJobs: 3,
    openSlots: 2,
    runnableJobs: ['0-hero.png-1000-1', '1-hero.AVIF-800-1'],
  },
);
assert.equal(
  queue.getRunnableJobs(
    {
      ...queuedSession,
      jobs: [
        {
          ...queuedSession.jobs[0],
          status: 'processing',
        },
        queuedSession.jobs[1],
        queuedSession.jobs[2],
      ],
      activeJobs: 0,
    },
    2,
  ).length,
  1,
);

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
assert.deepEqual(session.getBulkSessionCounters(restoredSession.jobs), {
  activeJobs: 1,
  exportedCount: 1,
});

const sessionWithDriftedCounters = {
  ...restoredSession,
  activeJobs: 7,
  exportedCount: 9,
};
const normalizedSession = session.normalizeBulkSessionCounters(
  sessionWithDriftedCounters,
);
assert.equal(normalizedSession.activeJobs, 1);
assert.equal(normalizedSession.exportedCount, 1);
assert.equal(
  session.normalizeBulkSessionCounters(normalizedSession),
  normalizedSession,
);

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
const addedToDriftedSession = session.addJobs(
  {
    ...restoredSession,
    activeJobs: 7,
    exportedCount: 9,
  },
  [
    {
      ...session.createImageJob('added-to-drifted-active', png),
      status: 'processing',
    },
    {
      ...session.createImageJob('added-to-drifted-exported', png),
      status: 'exported',
    },
  ],
);
assert.equal(addedToDriftedSession.activeJobs, 2);
assert.equal(addedToDriftedSession.exportedCount, 2);

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
  hasQueuedJobs: true,
  hasRetryableJobs: false,
  hasIncompleteJobs: true,
  canProcess: true,
  canRetry: false,
  canCancel: false,
});
assert.equal(bulkExport.canExportBulkSession(bulkSession), false);

bulkSession = queue.startJob(bulkSession, imported.accepted[0].id);
assert.equal(bulkSession.activeJobs, 1);
assert.deepEqual(session.getBulkActionState(bulkSession), {
  hasActiveJobs: true,
  hasQueuedJobs: false,
  hasRetryableJobs: false,
  hasIncompleteJobs: true,
  canProcess: false,
  canRetry: false,
  canCancel: true,
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

assert.deepEqual(
  queue.getBulkJobCounterDelta({
    ...session.createImageJob('queued-delta', png),
    status: 'queued',
  }),
  {
    activeJobs: 0,
    exportedCount: 0,
  },
);
assert.deepEqual(
  queue.getBulkJobCounterDelta({
    ...session.createImageJob('processing-delta', png),
    status: 'processing',
  }),
  {
    activeJobs: 1,
    exportedCount: 0,
  },
);
assert.deepEqual(
  queue.getBulkJobCounterDelta({
    ...session.createImageJob('exported-delta', png),
    status: 'exported',
    output,
  }),
  {
    activeJobs: 0,
    exportedCount: 1,
  },
);
assert.deepEqual(
  queue.resetJobForQueue({
    ...session.createImageJob('reset-job', png),
    status: 'failed',
    output,
    error: 'decode failed',
  }),
  {
    ...session.createImageJob('reset-job', png),
    status: 'queued',
    output: undefined,
    error: undefined,
  },
);

assert.equal(
  queue.startJob({ ...bulkSession, activeJobs: 5 }, imported.accepted[0].id)
    .activeJobs,
  1,
);

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
assert.equal(session.isJobOutputStale(bulkSession, bulkSession.jobs[0]), false);
assert.equal(
  session.isJobReadyForExport(bulkSession, bulkSession.jobs[0]),
  true,
);
assert.equal(
  session.isJobCurrentExport(bulkSession, bulkSession.jobs[0]),
  false,
);
assert.deepEqual(bulkExport.getExportableJobs(bulkSession), [
  bulkSession.jobs[0],
]);
assert.deepEqual(session.getBulkActionState(bulkSession), {
  hasActiveJobs: false,
  hasQueuedJobs: false,
  hasRetryableJobs: false,
  hasIncompleteJobs: false,
  canProcess: false,
  canRetry: false,
  canCancel: false,
});
assert.equal(bulkExport.canExportBulkSession(bulkSession), true);
assert.deepEqual(bulkExport.getBulkExportSummary(bulkSession), {
  ready: 1,
  exported: 0,
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
  {
    ...bulkExport.getBulkJobSizeSummary(bulkSession, bulkSession.jobs[0]),
    job: bulkExport.getBulkJobSizeSummary(bulkSession, bulkSession.jobs[0]).job
      .id,
  },
  {
    job: imported.accepted[0].id,
    outputState: 'optimized',
    originalSize: 1000,
    outputSize: 500,
    percentChange: -50,
  },
);
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
const bulkSessionSnapshot = bulkSnapshot.createBulkSessionSnapshot({
  ...bulkSession,
  activeJobs: 9,
});
const parsedBulkSessionSnapshot = bulkSnapshot.parseBulkSessionSnapshot(
  bulkSnapshot.serializeBulkSessionSnapshot({
    ...bulkSessionSnapshot,
    activeJobs: 5,
    jobs: bulkSessionSnapshot.jobs.map((job) => ({
      ...job,
      output: job.output
        ? {
            ...job.output,
            downloadUrl: 'blob:should-not-survive',
          }
        : undefined,
    })),
  }),
);
assert.deepEqual(
  {
    version: bulkSessionSnapshot.version,
    id: bulkSessionSnapshot.id,
    selectedJobId: bulkSessionSnapshot.selectedJobId,
    activeJobs: bulkSessionSnapshot.activeJobs,
    exportedCount: bulkSessionSnapshot.exportedCount,
    jobs: bulkSessionSnapshot.jobs.map((job) => ({
      id: job.id,
      sourceFile: job.sourceFile,
      output: job.output,
      hasDownloadUrl: Boolean(job.output && 'downloadUrl' in job.output),
    })),
  },
  {
    version: 1,
    id: 'batch-1',
    selectedJobId: imported.accepted[0].id,
    activeJobs: 0,
    exportedCount: 0,
    jobs: [
      {
        id: imported.accepted[0].id,
        sourceFile: {
          name: 'hero.png',
          type: 'image/png',
          size: 1000,
          lastModified: 1,
        },
        output: {
          file: {
            name: 'hero.webp',
            type: 'image/webp',
            size: 500,
            lastModified: 1,
          },
          size: 500,
          percentChange: -50,
          settingsHash: settings.settingsHash(globalSettings),
        },
        hasDownloadUrl: false,
      },
    ],
  },
);
assert.deepEqual(parsedBulkSessionSnapshot, bulkSessionSnapshot);
const restoredBulkSession = bulkSnapshot.restoreBulkSessionSnapshot(
  parsedBulkSessionSnapshot,
);
assert.deepEqual(
  restoredBulkSession.jobs.map((job) => ({
    id: job.id,
    status: job.status,
    sourceFile: {
      name: job.sourceFile.name,
      type: job.sourceFile.type,
      size: job.sourceFile.size,
      lastModified: job.sourceFile.lastModified,
    },
    originalSize: job.originalSize,
    hasOutput: Boolean(job.output),
    previewUrl: job.previewUrl,
    thumbnailUrl: job.thumbnailUrl,
  })),
  [
    {
      id: imported.accepted[0].id,
      status: 'queued',
      sourceFile: {
        name: 'hero.png',
        type: 'image/png',
        size: 0,
        lastModified: 1,
      },
      originalSize: 1000,
      hasOutput: false,
      previewUrl: undefined,
      thumbnailUrl: undefined,
    },
  ],
);
assert.equal(restoredBulkSession.activeJobs, 0);
assert.equal(restoredBulkSession.exportedCount, 0);
assert.equal(restoredBulkSession.selectedJobId, imported.accepted[0].id);
assert.deepEqual(
  bulkSnapshot.restoreBulkSessionSnapshot({
    ...parsedBulkSessionSnapshot,
    selectedJobId: 'missing-job',
  }).selectedJobId,
  imported.accepted[0].id,
);
assert.deepEqual(
  bulkSnapshot
    .restoreSerializedBulkSessionSnapshot(
      bulkSnapshot.serializeBulkSessionSnapshot(parsedBulkSessionSnapshot),
    )
    .jobs.map((job) => ({
      id: job.id,
      status: job.status,
      hasOutput: Boolean(job.output),
    })),
  [
    {
      id: imported.accepted[0].id,
      status: 'queued',
      hasOutput: false,
    },
  ],
);
assert.equal(
  bulkSnapshot.restoreSerializedBulkSessionSnapshot('not json'),
  undefined,
);
assert.equal(bulkSnapshot.parseBulkSessionSnapshot('not json'), undefined);
assert.equal(
  bulkSnapshot.parseBulkSessionSnapshot(
    JSON.stringify({
      ...bulkSessionSnapshot,
      version: 2,
    }),
  ),
  undefined,
);
assert.equal(
  bulkSnapshot.parseBulkSessionSnapshot(
    JSON.stringify({
      ...bulkSessionSnapshot,
      jobs: [
        {
          ...bulkSessionSnapshot.jobs[0],
          sourceFile: {
            ...bulkSessionSnapshot.jobs[0].sourceFile,
            size: 'large',
          },
        },
      ],
    }),
  ),
  undefined,
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
assert.deepEqual(
  {
    ...bulkExport.getBulkJobSizeSummary(bulkSession, bulkSession.jobs[0]),
    job: bulkExport.getBulkJobSizeSummary(bulkSession, bulkSession.jobs[0]).job
      .id,
  },
  {
    job: imported.accepted[0].id,
    outputState: 'stale',
    originalSize: 1000,
  },
);
assert.deepEqual(bulkExport.getBulkOutputSummary(bulkSession), {
  optimized: 0,
  stale: 1,
  totalOriginalSize: 0,
  totalOutputSize: 0,
  percentChange: 0,
});
assert.deepEqual(bulkExport.getBulkExportSummary(bulkSession), {
  ready: 0,
  exported: 0,
  failed: 0,
  pending: 1,
  skipped: 0,
  totalOriginalSize: 0,
  totalOutputSize: 0,
  percentChange: 0,
});
const staleExportAttempt = session.markJobsExported(bulkSession, [
  imported.accepted[0].id,
]);
assert.equal(staleExportAttempt.jobs[0].status, 'encoded');
assert.equal(staleExportAttempt.exportedCount, 0);

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
const missingSizeJob = session.createImageJob('missing-size', png);
const missingSizeSummary = bulkExport.getBulkJobSizeSummary(
  bulkSession,
  missingSizeJob,
);
assert.deepEqual(
  {
    ...missingSizeSummary,
    job: missingSizeSummary.job.id,
  },
  {
    job: 'missing-size',
    outputState: 'missing',
    originalSize: 1000,
  },
);

const failedJob = {
  ...session.createImageJob('failed-retry', png),
  status: 'failed',
  error: 'decode failed',
  output,
};

const driftedProcessingSession = session.createBulkSession(
  'drifted-processing',
  globalSettings,
  [
    {
      ...session.createImageJob('drifted-job', png),
      status: 'processing',
    },
  ],
);
assert.equal(
  queue.completeJob(
    { ...driftedProcessingSession, activeJobs: 12 },
    'drifted-job',
    output,
  ).activeJobs,
  0,
);
assert.equal(
  queue.failJob(
    { ...driftedProcessingSession, activeJobs: 12 },
    'drifted-job',
    'decode failed',
  ).activeJobs,
  0,
);
assert.equal(
  queue.requeueJob(
    { ...driftedProcessingSession, activeJobs: 12 },
    'drifted-job',
  ).activeJobs,
  0,
);
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
const activeJob = {
  ...session.createImageJob('active-retry', png),
  status: 'processing',
};
const retrySession = queue.requeueIncompleteJobs(
  session.createBulkSession('retry-batch', globalSettings, [
    failedJob,
    skippedJob,
    encodedJob,
    activeJob,
  ]),
);

assert.equal(retrySession.activeJobs, 0);
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
    {
      id: 'active-retry',
      status: 'queued',
      error: undefined,
      hasOutput: false,
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
    hasQueuedJobs: false,
    hasRetryableJobs: true,
    hasIncompleteJobs: true,
    canProcess: false,
    canRetry: true,
    canCancel: false,
  },
);
const canceledSession = queue.cancelActiveJobs(
  session.createBulkSession('cancel-active-batch', globalSettings, [
    failedJob,
    skippedJob,
    encodedJob,
    activeJob,
  ]),
);
assert.equal(canceledSession.activeJobs, 0);
assert.deepEqual(
  canceledSession.jobs.map((job) => ({
    id: job.id,
    status: job.status,
    error: job.error,
    hasOutput: Boolean(job.output),
  })),
  [
    {
      id: 'failed-retry',
      status: 'failed',
      error: 'decode failed',
      hasOutput: true,
    },
    {
      id: 'skipped-retry',
      status: 'skipped',
      error: 'unsupported',
      hasOutput: true,
    },
    {
      id: 'encoded-no-retry',
      status: 'encoded',
      error: undefined,
      hasOutput: true,
    },
    {
      id: 'active-retry',
      status: 'queued',
      error: undefined,
      hasOutput: false,
    },
  ],
);
assert.equal(
  queue.cancelActiveJobs({
    ...session.createBulkSession('drifted-cancel-batch', globalSettings, [
      activeJob,
    ]),
    activeJobs: 99,
  }).activeJobs,
  0,
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
  session.createImageJob('duplicate-7', makeFile('CON.png', 'image/png', 100)),
  session.createImageJob('duplicate-8', makeFile('lpt1.png', 'image/png', 100)),
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

const globalSettingsChangeSession = bulkChanges.applyGlobalSettings(
  duplicateReadySession,
  {
    ...duplicateReadySession.globalSettings,
    processorState: {
      resize: {
        enabled: true,
        width: 1,
        height: 1,
      },
    },
  },
);
assert.deepEqual(
  globalSettingsChangeSession.jobs.map((job) => ({
    status: job.status,
    hasOutput: Boolean(job.output),
  })),
  duplicateReadySession.jobs.map(() => ({
    status: 'queued',
    hasOutput: false,
  })),
);
const matchingOverrideSession = bulkChanges.applyJobOverrides(
  duplicateReadySession,
  'duplicate-1',
  {},
);
assert.equal(matchingOverrideSession.jobs[0].status, 'encoded');
assert.equal(Boolean(matchingOverrideSession.jobs[0].output), true);
const changedOverrideSession = bulkChanges.applyJobOverrides(
  duplicateReadySession,
  'duplicate-1',
  {
    processorState: {
      resize: {
        width: 1,
      },
    },
  },
);
assert.deepEqual(
  changedOverrideSession.jobs.slice(0, 2).map((job) => ({
    status: job.status,
    hasOutput: Boolean(job.output),
  })),
  [
    {
      status: 'queued',
      hasOutput: false,
    },
    {
      status: 'encoded',
      hasOutput: true,
    },
  ],
);
const duplicateStripItems = bulkStrip.getBulkStripItems(duplicateReadySession);
assert.deepEqual(
  duplicateStripItems.slice(0, 2).map((item) => ({
    id: item.id,
    index: item.index,
    fileName: item.fileName,
    status: item.status,
    statusGroup: item.statusGroup,
    selected: item.selected,
    outputState: item.outputState,
    originalSize: item.originalSize,
    outputSize: item.outputSize,
    percentChange: item.percentChange,
    hasOverrides: item.hasOverrides,
  })),
  [
    {
      id: 'duplicate-1',
      index: 0,
      fileName: 'Hero.PNG',
      status: 'encoded',
      statusGroup: 'complete',
      selected: true,
      outputState: 'optimized',
      originalSize: 100,
      outputSize: 50,
      percentChange: -50,
      hasOverrides: false,
    },
    {
      id: 'duplicate-2',
      index: 1,
      fileName: 'hero.jpg',
      status: 'encoded',
      statusGroup: 'complete',
      selected: false,
      outputState: 'optimized',
      originalSize: 100,
      outputSize: 50,
      percentChange: -50,
      hasOverrides: false,
    },
  ],
);
assert.equal(
  bulkStrip.getSelectedBulkStripItem(duplicateReadySession).id,
  'duplicate-1',
);
assert.deepEqual(bulkStrip.getBulkStripItems(changedOverrideSession)[0], {
  id: 'duplicate-1',
  index: 0,
  fileName: 'Hero.PNG',
  status: 'queued',
  statusGroup: 'pending',
  selected: true,
  thumbnailUrl: undefined,
  previewUrl: undefined,
  outputState: 'missing',
  originalSize: 100,
  outputSize: undefined,
  percentChange: undefined,
  overridePaths: ['processorState.resize.width'],
  hasOverrides: true,
  error: undefined,
});
const selectedReadyDetail = bulkDetail.getBulkSelectedJobDetail(
  duplicateReadySession,
);
assert.deepEqual(
  {
    jobId: selectedReadyDetail.job.id,
    index: selectedReadyDetail.context.index,
    total: selectedReadyDetail.context.total,
    canSelectPrevious: selectedReadyDetail.context.canSelectPrevious,
    canSelectNext: selectedReadyDetail.context.canSelectNext,
    effectiveSettings: selectedReadyDetail.effectiveSettings,
    outputState: selectedReadyDetail.size.outputState,
    outputSize: selectedReadyDetail.size.outputSize,
    percentChange: selectedReadyDetail.size.percentChange,
    overridePaths: selectedReadyDetail.overridePaths,
    hasOverrides: selectedReadyDetail.hasOverrides,
  },
  {
    jobId: 'duplicate-1',
    index: 0,
    total: 8,
    canSelectPrevious: false,
    canSelectNext: true,
    effectiveSettings: duplicateReadySession.globalSettings,
    outputState: 'optimized',
    outputSize: 50,
    percentChange: -50,
    overridePaths: [],
    hasOverrides: false,
  },
);
const selectedOverrideDetail = bulkDetail.getBulkSelectedJobDetail(
  changedOverrideSession,
);
assert.deepEqual(
  {
    jobId: selectedOverrideDetail.job.id,
    width: selectedOverrideDetail.effectiveSettings.processorState.resize.width,
    outputState: selectedOverrideDetail.size.outputState,
    overridePaths: selectedOverrideDetail.overridePaths,
    hasOverrides: selectedOverrideDetail.hasOverrides,
  },
  {
    jobId: 'duplicate-1',
    width: 1,
    outputState: 'missing',
    overridePaths: ['processorState.resize.width'],
    hasOverrides: true,
  },
);
assert.equal(
  bulkDetail.getBulkSelectedJobDetail({
    ...duplicateReadySession,
    selectedJobId: 'missing-job',
  }),
  undefined,
);
const duplicateSessionSummary = bulkSummary.getBulkSessionSummary(
  duplicateReadySession,
);
assert.equal(duplicateSessionSummary.totalJobs, 8);
assert.deepEqual(duplicateSessionSummary.progress, {
  total: 8,
  queued: 0,
  active: 0,
  completed: 8,
  failed: 0,
  skipped: 0,
  exported: 0,
});
assert.deepEqual(
  {
    index: duplicateSessionSummary.selectedJob.index,
    total: duplicateSessionSummary.selectedJob.total,
    jobId: duplicateSessionSummary.selectedJob.job.id,
    canSelectPrevious: duplicateSessionSummary.selectedJob.canSelectPrevious,
    canSelectNext: duplicateSessionSummary.selectedJob.canSelectNext,
  },
  {
    index: 0,
    total: 8,
    jobId: 'duplicate-1',
    canSelectPrevious: false,
    canSelectNext: true,
  },
);
assert.deepEqual(duplicateSessionSummary.actions, {
  hasActiveJobs: false,
  hasQueuedJobs: false,
  hasRetryableJobs: false,
  hasIncompleteJobs: false,
  canProcess: false,
  canRetry: false,
  canCancel: false,
});
assert.deepEqual(duplicateSessionSummary.overrides, {
  overridden: 0,
  total: 8,
});
assert.deepEqual(duplicateSessionSummary.output, {
  optimized: 8,
  stale: 0,
  totalOriginalSize: 800,
  totalOutputSize: 400,
  percentChange: -50,
});
assert.deepEqual(duplicateSessionSummary.export, {
  ready: 8,
  exported: 0,
  failed: 0,
  pending: 0,
  skipped: 0,
  totalOriginalSize: 800,
  totalOutputSize: 400,
  percentChange: -50,
});
assert.deepEqual(
  {
    ...duplicateSessionSummary.queue,
    runnableJobs: duplicateSessionSummary.queue.runnableJobs.map(
      (job) => job.id,
    ),
  },
  {
    concurrency: 2,
    activeJobs: 0,
    queuedJobs: 0,
    openSlots: 2,
    runnableJobs: [],
  },
);
const changedOverrideSummary = bulkSummary.getBulkSessionSummary(
  changedOverrideSession,
  3,
);
assert.deepEqual(changedOverrideSummary.overrides, {
  overridden: 1,
  total: 8,
});
assert.equal(changedOverrideSummary.actions.canProcess, true);
assert.equal(changedOverrideSummary.export.ready, 7);
assert.equal(changedOverrideSummary.export.pending, 1);
assert.equal(changedOverrideSummary.queue.concurrency, 3);
assert.deepEqual(
  changedOverrideSummary.queue.runnableJobs.map((job) => job.id),
  ['duplicate-1'],
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
      fileName: 'bad-name.webp',
      downloadUrl: 'blob:duplicate-2',
    },
    {
      fileName: 'image.webp',
      downloadUrl: 'blob:duplicate-3',
    },
    {
      fileName: '.hidden.webp',
      downloadUrl: 'blob:duplicate-4',
    },
    {
      fileName: 'hero-2-2.webp',
      downloadUrl: 'blob:duplicate-5',
    },
    {
      fileName: 'CON-file.webp',
      downloadUrl: 'blob:duplicate-6',
    },
    {
      fileName: 'lpt1-file.webp',
      downloadUrl: 'blob:duplicate-7',
    },
  ],
);
assert.deepEqual(
  bulkExport
    .getSelectedExportableJobs(duplicateReadySession, [
      'duplicate-1',
      'duplicate-4',
      'missing-job',
    ])
    .map((job) => job.id),
  ['duplicate-1', 'duplicate-4'],
);
assert.equal(
  bulkExport.canExportBulkSession(duplicateReadySession, ['missing-job']),
  false,
);
assert.equal(
  bulkExport.canExportBulkSession(duplicateReadySession, [
    'missing-job',
    'duplicate-4',
  ]),
  true,
);
assert.deepEqual(
  bulkExport
    .getBulkExportEntries(duplicateReadySession, [
      'duplicate-1',
      'duplicate-2',
      'duplicate-4',
      'duplicate-6',
    ])
    .map((entry) => ({
      jobId: entry.job.id,
      fileName: entry.fileName,
      downloadUrl: entry.downloadUrl,
    })),
  [
    {
      jobId: 'duplicate-1',
      fileName: 'Hero.webp',
      downloadUrl: 'blob:duplicate-0',
    },
    {
      jobId: 'duplicate-2',
      fileName: 'hero-2.webp',
      downloadUrl: 'blob:duplicate-1',
    },
    {
      jobId: 'duplicate-4',
      fileName: 'image.webp',
      downloadUrl: 'blob:duplicate-3',
    },
    {
      jobId: 'duplicate-6',
      fileName: 'hero-2-2.webp',
      downloadUrl: 'blob:duplicate-5',
    },
  ],
);
assert.deepEqual(
  {
    ...bulkExport.createBulkExportPlan(duplicateReadySession, [
      'duplicate-1',
      'duplicate-2',
      'missing-job',
    ]),
    entries: bulkExport
      .createBulkExportPlan(duplicateReadySession, [
        'duplicate-1',
        'duplicate-2',
        'missing-job',
      ])
      .entries.map((entry) => entry.fileName),
  },
  {
    archiveName: 'duplicate-batch-optimized',
    entries: ['Hero.webp', 'hero-2.webp'],
    summary: {
      ready: 2,
      exported: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
      totalOriginalSize: 200,
      totalOutputSize: 100,
      percentChange: -50,
    },
  },
);
const selectedDuplicateExportPlan = bulkExport.createBulkExportPlan(
  duplicateReadySession,
  ['duplicate-1', 'duplicate-2', 'missing-job'],
);
const plannedExportSession = bulkExport.markBulkExportPlanExported(
  duplicateReadySession,
  selectedDuplicateExportPlan,
);
assert.equal(plannedExportSession.jobs[0].status, 'exported');
assert.equal(plannedExportSession.jobs[1].status, 'exported');
assert.equal(plannedExportSession.jobs[2].status, 'encoded');
assert.equal(plannedExportSession.exportedCount, 2);
const mixedExportSession = queue.requeueJob(
  queue.failJob(
    session.markJobsExported(duplicateReadySession, ['duplicate-1']),
    'duplicate-3',
    'decode failed',
  ),
  'duplicate-4',
);
assert.deepEqual(
  bulkExport.getBulkExportSummary(mixedExportSession, [
    'duplicate-1',
    'duplicate-2',
    'duplicate-3',
    'duplicate-4',
    'missing-job',
  ]),
  {
    ready: 1,
    exported: 1,
    failed: 1,
    pending: 1,
    skipped: 0,
    totalOriginalSize: 100,
    totalOutputSize: 50,
    percentChange: -50,
  },
);
assert.deepEqual(
  {
    ...bulkExport.createBulkExportPlan(mixedExportSession, [
      'duplicate-1',
      'duplicate-2',
      'duplicate-3',
      'duplicate-4',
      'missing-job',
    ]),
    entries: bulkExport
      .createBulkExportPlan(mixedExportSession, [
        'duplicate-1',
        'duplicate-2',
        'duplicate-3',
        'duplicate-4',
        'missing-job',
      ])
      .entries.map((entry) => entry.fileName),
  },
  {
    archiveName: 'duplicate-batch-optimized',
    entries: ['hero.webp'],
    summary: {
      ready: 1,
      exported: 1,
      failed: 1,
      pending: 1,
      skipped: 0,
      totalOriginalSize: 100,
      totalOutputSize: 50,
      percentChange: -50,
    },
  },
);

const exportedSession = session.markJobsExported(duplicateReadySession, [
  'duplicate-1',
  'missing-job',
]);

assert.equal(exportedSession.jobs[0].status, 'exported');
assert.equal(exportedSession.jobs[1].status, 'encoded');
assert.equal(exportedSession.exportedCount, 1);
assert.equal(
  session.isJobReadyForExport(exportedSession, exportedSession.jobs[0]),
  false,
);
assert.equal(
  session.isJobCurrentExport(exportedSession, exportedSession.jobs[0]),
  true,
);
assert.equal(bulkExport.getExportableJobs(exportedSession).length, 7);
assert.deepEqual(bulkExport.getBulkExportSummary(exportedSession), {
  ready: 7,
  exported: 1,
  failed: 0,
  pending: 0,
  skipped: 0,
  totalOriginalSize: 700,
  totalOutputSize: 350,
  percentChange: -50,
});
assert.deepEqual(bulkExport.getBulkOutputSummary(exportedSession), {
  optimized: 8,
  stale: 0,
  totalOriginalSize: 800,
  totalOutputSize: 400,
  percentChange: -50,
});
assert.deepEqual(session.getDetailedBatchProgress(exportedSession), {
  total: 8,
  queued: 0,
  active: 0,
  completed: 8,
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
const driftedRemoveSession = session.removeJobs(
  {
    ...exportedSession,
    activeJobs: 8,
    exportedCount: 8,
  },
  ['duplicate-1'],
);
assert.equal(driftedRemoveSession.activeJobs, 0);
assert.equal(driftedRemoveSession.exportedCount, 0);
const staleExportSummarySession = session.updateGlobalSettings(
  exportedSession,
  {
    ...exportedSession.globalSettings,
    processorState: {
      resize: {
        enabled: true,
        width: 1,
        height: 1,
      },
    },
  },
);
assert.equal(
  bulkExport.markBulkExportPlanExported(
    staleExportSummarySession,
    selectedDuplicateExportPlan,
  ).exportedCount,
  1,
);
assert.deepEqual(bulkExport.getBulkExportSummary(staleExportSummarySession), {
  ready: 0,
  exported: 0,
  failed: 0,
  pending: 8,
  skipped: 0,
  totalOriginalSize: 0,
  totalOutputSize: 0,
  percentChange: 0,
});
const staleExportedSession = queue.requeueStaleJobs(staleExportSummarySession);
assert.equal(staleExportedSession.exportedCount, 0);
assert.equal(staleExportedSession.activeJobs, 0);
const driftedMarkExportedSession = session.markJobsExported(
  {
    ...duplicateReadySession,
    exportedCount: 9,
  },
  ['duplicate-1'],
);
assert.equal(driftedMarkExportedSession.exportedCount, 1);
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

const sideResetRevoked = [];
const sideResetState = {
  source: { id: 'source' },
  sides: [
    {
      latestSettings: { id: 'left-settings' },
      loading: false,
      file: makeFile('left.webp', 'image/webp', 10),
      downloadUrl: 'blob:left',
      data: { id: 'left-data' },
      processed: { id: 'left-processed' },
      encodedSettings: { id: 'left-encoded-settings' },
    },
    {
      latestSettings: { id: 'right-settings' },
      loading: true,
      file: makeFile('right.webp', 'image/webp', 20),
      downloadUrl: 'blob:right',
      data: { id: 'right-data' },
      processed: { id: 'right-processed' },
      encodedSettings: { id: 'right-encoded-settings' },
    },
  ],
};
const resetSideState = sideState.resetSidesForNewSourceData(
  sideResetState,
  (url) => sideResetRevoked.push(url),
);
assert.deepEqual(sideResetRevoked, ['blob:left', 'blob:right']);
assert.notEqual(resetSideState, sideResetState);
assert.notEqual(resetSideState.sides, sideResetState.sides);
assert.equal(resetSideState.source, sideResetState.source);
assert.deepEqual(
  resetSideState.sides.map((side) => ({
    latestSettings: side.latestSettings,
    loading: side.loading,
    file: side.file,
    downloadUrl: side.downloadUrl,
    data: side.data,
    processed: side.processed,
    encodedSettings: side.encodedSettings,
  })),
  [
    {
      latestSettings: { id: 'left-settings' },
      loading: false,
      file: undefined,
      downloadUrl: undefined,
      data: undefined,
      processed: undefined,
      encodedSettings: undefined,
    },
    {
      latestSettings: { id: 'right-settings' },
      loading: true,
      file: undefined,
      downloadUrl: undefined,
      data: undefined,
      processed: undefined,
      encodedSettings: undefined,
    },
  ],
);
assert.equal(sideResetState.sides[0].downloadUrl, 'blob:left');
assert.equal(sideResetState.sides[1].downloadUrl, 'blob:right');
const unmountRevokedUrls = [];
sideState.revokeSideDownloadUrls(sideResetState.sides, (url) =>
  unmountRevokedUrls.push(url),
);
assert.deepEqual(unmountRevokedUrls, ['blob:left', 'blob:right']);
sideState.revokeSideDownloadUrls(
  [{ downloadUrl: undefined }, { loading: false }],
  (url) => unmountRevokedUrls.push(url),
);
assert.deepEqual(unmountRevokedUrls, ['blob:left', 'blob:right']);
{
  const mainAbortController = new AbortController();
  const sideAbortControllers = [new AbortController(), new AbortController()];
  const cleanupEvents = [];
  editorCleanup.cleanupEditorRuntime({
    updateImageTimeout: 73,
    mainAbortController,
    sideAbortControllers,
    workerBridges: [
      {
        dispose() {
          cleanupEvents.push(['dispose', 'left']);
        },
      },
      {
        dispose() {
          cleanupEvents.push(['dispose', 'right']);
        },
      },
    ],
    sides: sideResetState.sides,
    clearTimeout(timeout) {
      cleanupEvents.push(['clear-timeout', timeout]);
    },
    revokeObjectUrl(url) {
      cleanupEvents.push(['revoke-url', url]);
    },
  });
  assert.equal(mainAbortController.signal.aborted, true);
  assert.equal(sideAbortControllers[0].signal.aborted, true);
  assert.equal(sideAbortControllers[1].signal.aborted, true);
  assert.deepEqual(cleanupEvents, [
    ['clear-timeout', 73],
    ['dispose', 'left'],
    ['dispose', 'right'],
    ['revoke-url', 'blob:left'],
    ['revoke-url', 'blob:right'],
  ]);

  const noTimeoutEvents = [];
  editorCleanup.cleanupEditorRuntime({
    updateImageTimeout: undefined,
    mainAbortController: new AbortController(),
    sideAbortControllers: [],
    workerBridges: [],
    sides: [],
    clearTimeout(timeout) {
      noTimeoutEvents.push(['clear-timeout', timeout]);
    },
  });
  assert.deepEqual(noTimeoutEvents, []);
}
const preprocessedRevokedUrls = [];
const preprocessedState = sideState.setPreprocessedSourceState(
  sideResetState,
  { id: 'new-source' },
  { rotate: { rotate: 90 } },
  { id: 'new-preprocessed' },
  (url) => preprocessedRevokedUrls.push(url),
);
assert.deepEqual(preprocessedRevokedUrls, ['blob:left', 'blob:right']);
assert.equal(preprocessedState.loading, false);
assert.deepEqual(preprocessedState.source, { id: 'new-source' });
assert.deepEqual(preprocessedState.encodedPreprocessorState, {
  rotate: { rotate: 90 },
});
assert.deepEqual(
  preprocessedState.sides.map((side) => ({
    latestSettings: side.latestSettings,
    loading: side.loading,
    file: side.file,
    downloadUrl: side.downloadUrl,
    data: side.data,
    processed: side.processed,
    encodedSettings: side.encodedSettings,
  })),
  [
    {
      latestSettings: { id: 'left-settings' },
      loading: false,
      file: undefined,
      downloadUrl: undefined,
      data: undefined,
      processed: undefined,
      encodedSettings: undefined,
    },
    {
      latestSettings: { id: 'right-settings' },
      loading: true,
      file: undefined,
      downloadUrl: undefined,
      data: undefined,
      processed: undefined,
      encodedSettings: undefined,
    },
  ],
);
const savedSideUpdate = sideState.applySavedSideSettings(
  sideResetState.sides,
  1,
  {
    latestSettings: { id: 'saved-latest' },
    encodedSettings: { id: 'saved-encoded' },
  },
);
const savedSideStateUpdate = sideState.getApplySavedSideSettingsState(
  {
    sides: sideResetState.sides,
    untouched: true,
  },
  0,
  {
    latestSettings: { id: 'saved-left-latest' },
  },
);
assert.equal(savedSideStateUpdate.oldSide, sideResetState.sides[0]);
assert.deepEqual(savedSideStateUpdate.sides[0], {
  latestSettings: { id: 'saved-left-latest' },
  loading: false,
  file: sideResetState.sides[0].file,
  downloadUrl: 'blob:left',
  data: { id: 'left-data' },
  processed: { id: 'left-processed' },
  encodedSettings: { id: 'left-encoded-settings' },
});
assert.equal(savedSideUpdate.oldSide, sideResetState.sides[1]);
assert.notEqual(savedSideUpdate.sides, sideResetState.sides);
assert.equal(savedSideUpdate.sides[0], sideResetState.sides[0]);
assert.deepEqual(savedSideUpdate.sides[1], {
  latestSettings: { id: 'saved-latest' },
  loading: true,
  file: sideResetState.sides[1].file,
  downloadUrl: 'blob:right',
  data: { id: 'right-data' },
  processed: { id: 'right-processed' },
  encodedSettings: { id: 'saved-encoded' },
});
const restoredSides = sideState.restoreSide(
  savedSideUpdate.sides,
  1,
  savedSideUpdate.oldSide,
);
assert.deepEqual(restoredSides, sideResetState.sides);
assert.deepEqual(
  sideState.getRestoreSideState(
    { sides: savedSideUpdate.sides, untouched: true },
    1,
    savedSideUpdate.oldSide,
  ),
  {
    sides: sideResetState.sides,
  },
);
const sideMutationSides = [
  {
    latestSettings: {
      processorState: sharedProcessor,
      encoderState: undefined,
    },
  },
  {
    latestSettings: {
      processorState: sharedProcessor,
      encoderState: {
        type: 'mozJPEG',
        options: { quality: 75 },
      },
    },
  },
];
const webpSideMutation = sideState.setSideEncoderType(
  sideMutationSides,
  0,
  'webP',
);
assert.notEqual(webpSideMutation, sideMutationSides);
assert.equal(webpSideMutation[1], sideMutationSides[1]);
assert.deepEqual(webpSideMutation[0].latestSettings.encoderState, {
  type: 'webP',
  options: { quality: 80 },
});
const identitySideMutation = sideState.setSideEncoderType(
  webpSideMutation,
  0,
  'identity',
);
assert.equal(identitySideMutation[0].latestSettings.encoderState, undefined);
assert.deepEqual(
  sideState.setSideEncoderOptions(sideMutationSides, 1, {
    quality: 60,
  })[1].latestSettings.encoderState.options,
  { quality: 60 },
);
assert.deepEqual(
  sideState.getSideEncoderOptionsChangeState(
    { sides: sideMutationSides, untouched: true },
    1,
    { quality: 55 },
  ).sides[1].latestSettings.encoderState.options,
  { quality: 55 },
);
assert.deepEqual(
  sideState.getSideEncoderTypeChangeState(
    { sides: sideMutationSides, untouched: true },
    0,
    'webP',
  ).sides[0].latestSettings.encoderState,
  {
    type: 'webP',
    options: { quality: 80 },
  },
);
const changedProcessorState = {
  resize: containResize,
  quantize: sharedQuantize,
};
assert.equal(
  sideState.setSideProcessorState(
    sideMutationSides,
    1,
    changedProcessorState,
  )[1].latestSettings.processorState,
  changedProcessorState,
);
assert.equal(
  sideState.getSideProcessorOptionsChangeState(
    { sides: sideMutationSides, untouched: true },
    1,
    changedProcessorState,
  ).sides[1].latestSettings.processorState,
  changedProcessorState,
);
const loadingSideMutation = sideState.setSideLoading(
  [
    { loading: false, id: 'left' },
    { loading: true, id: 'right' },
  ],
  0,
  true,
);
assert.deepEqual(loadingSideMutation, [
  { loading: true, id: 'left' },
  { loading: true, id: 'right' },
]);
assert.deepEqual(
  sideState.getSideLoadingState(
    {
      sides: [
        { loading: false, id: 'left' },
        { loading: true, id: 'right' },
      ],
      untouched: true,
    },
    0,
    true,
  ),
  {
    sides: [
      { loading: true, id: 'left' },
      { loading: true, id: 'right' },
    ],
  },
);
const sideProcessingResult = sideState.setSideProcessedResult(
  [
    {
      latestSettings: { id: 'left-latest' },
      encodedSettings: { encoderState: sharedEncoder },
    },
    {
      latestSettings: { id: 'right-latest' },
      encodedSettings: undefined,
    },
  ],
  0,
  { id: 'processed' },
  sharedProcessor,
);
assert.deepEqual(sideProcessingResult[0], {
  latestSettings: { id: 'left-latest' },
  processed: { id: 'processed' },
  data: { id: 'processed' },
  encodedSettings: {
    encoderState: sharedEncoder,
    processorState: sharedProcessor,
  },
});
assert.deepEqual(
  sideState.getSideProcessedResultState(
    {
      sides: [
        {
          latestSettings: { id: 'left-latest' },
          encodedSettings: { encoderState: sharedEncoder },
        },
        {
          latestSettings: { id: 'right-latest' },
          encodedSettings: undefined,
        },
      ],
    },
    0,
    { id: 'processed' },
    sharedProcessor,
  ).sides[0],
  sideProcessingResult[0],
);
const encodedRevokedUrls = [];
const encodedSideResult = sideState.setSideEncodedResult(
  [
    {
      latestSettings: { id: 'left-latest' },
      loading: true,
      downloadUrl: 'blob:old',
      file: makeFile('old.webp', 'image/webp', 1),
      data: { id: 'old-data' },
      processed: { id: 'old-processed' },
    },
    {
      latestSettings: { id: 'right-latest' },
      loading: false,
    },
  ],
  0,
  {
    data: { id: 'encoded-data' },
    file: makeFile('new.webp', 'image/webp', 2),
    processed: { id: 'encoded-processed' },
    processorState: sharedProcessor,
    encoderState: sharedEncoder,
  },
  (file) => `blob:${file.name}`,
  (url) => encodedRevokedUrls.push(url),
);
assert.deepEqual(encodedRevokedUrls, ['blob:old']);
assert.equal(encodedSideResult[0].downloadUrl, 'blob:new.webp');
assert.equal(encodedSideResult[0].loading, false);
assert.deepEqual(encodedSideResult[0].encodedSettings, {
  processorState: sharedProcessor,
  encoderState: sharedEncoder,
});
const encodedPatchRevokedUrls = [];
assert.equal(
  sideState.getSideEncodedResultState(
    {
      sides: [
        {
          latestSettings: { id: 'left-latest' },
          loading: true,
          downloadUrl: 'blob:old',
        },
        {
          latestSettings: { id: 'right-latest' },
          loading: false,
        },
      ],
    },
    0,
    {
      data: { id: 'encoded-data' },
      file: makeFile('encoded.webp', 'image/webp', 20),
      processed: { id: 'encoded-processed' },
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    (file) => `blob:${file.name}`,
    (url) => encodedPatchRevokedUrls.push(url),
  ).sides[0].downloadUrl,
  'blob:encoded.webp',
);
assert.deepEqual(encodedPatchRevokedUrls, ['blob:old']);
assert.deepEqual(
  sideState.getDefaultSideState(0).latestSettings.encoderState,
  undefined,
);
assert.equal(
  sideState.getDefaultSideState(1).latestSettings.encoderState.type,
  'mozJPEG',
);
assert.equal(sideState.getDefaultSideState(1).loading, false);
assert.deepEqual(
  sideState.getInitialSideState(1, {
    latestSettings: { id: 'saved-latest' },
    encodedSettings: { id: 'saved-encoded' },
  }),
  {
    latestSettings: { id: 'saved-latest' },
    encodedSettings: { id: 'saved-encoded' },
    loading: false,
  },
);
assert.deepEqual(
  sideState.getInitialSideStates([
    undefined,
    {
      latestSettings: { id: 'saved-right-latest' },
      encodedSettings: { id: 'saved-right-encoded' },
    },
  ]),
  [
    sideState.getDefaultSideState(0),
    {
      latestSettings: { id: 'saved-right-latest' },
      encodedSettings: { id: 'saved-right-encoded' },
      loading: false,
    },
  ],
);

assert.deepEqual(prettyBytes(0), { value: '0', unit: 'B' });
assert.deepEqual(prettyBytes(999), { value: '999', unit: 'B' });
assert.deepEqual(prettyBytes(1000), { value: '1.00', unit: 'kB' });
assert.deepEqual(prettyBytes(1234567), { value: '1.23', unit: 'MB' });
assert.deepEqual(prettyBytes(-1234), { value: '-1.23', unit: 'kB' });
assert.deepEqual(resultSizeState.getResultSizeState(undefined, undefined), {
  prettySize: undefined,
  isOriginal: true,
  diff: undefined,
  direction: undefined,
  percent: 0,
});
const originalResultFile = makeFile('original.png', 'image/png', 1000);
assert.deepEqual(
  resultSizeState.getResultSizeState(
    { file: originalResultFile },
    originalResultFile,
  ),
  {
    prettySize: { value: '1.00', unit: 'kB' },
    isOriginal: true,
    diff: 1,
    direction: undefined,
    percent: 0,
  },
);
assert.deepEqual(
  resultSizeState.getResultSizeState(
    { file: originalResultFile },
    makeFile('smaller.webp', 'image/webp', 400),
  ),
  {
    prettySize: { value: '400', unit: 'B' },
    isOriginal: false,
    diff: 0.4,
    direction: 'down',
    percent: 60,
  },
);
assert.deepEqual(
  resultSizeState.getResultSizeState(
    { file: originalResultFile },
    makeFile('larger.png', 'image/png', 1250),
  ),
  {
    prettySize: { value: '1.25', unit: 'kB' },
    isOriginal: false,
    diff: 1.25,
    direction: 'up',
    percent: 25,
  },
);
assert.equal(resultLoadingState.getInitialResultLoadingState(false), false);
assert.equal(resultLoadingState.getInitialResultLoadingState(true), true);
assert.deepEqual(
  resultLoadingState.getInitialResultLoadingVisibilityState(false),
  {
    showLoadingState: false,
  },
);
assert.deepEqual(
  resultLoadingState.getInitialResultLoadingVisibilityState(true),
  {
    showLoadingState: true,
  },
);
assert.deepEqual(resultLoadingState.getResultLoadingVisibilityState(false), {
  showLoadingState: false,
});
assert.deepEqual(resultLoadingState.getResultLoadingVisibilityState(true), {
  showLoadingState: true,
});
assert.equal(resultLoadingState.getResultLoadingEffect(false, false), 'none');
assert.equal(resultLoadingState.getResultLoadingEffect(true, true), 'none');
assert.equal(
  resultLoadingState.getResultLoadingEffect(false, true),
  'delay-show',
);
assert.equal(resultLoadingState.getResultLoadingEffect(true, false), 'hide');
{
  const calls = [];
  const nextTimeoutId = resultLoadingWorkflow.runResultLoadingWorkflow({
    previousLoading: false,
    currentLoading: true,
    currentTimeoutId: 0,
    delay: 500,
    setLoadingState: (showLoadingState) =>
      calls.push(['state', showLoadingState]),
    setTimeout: (callback, delay) => {
      calls.push(['setTimeout', delay]);
      callback();
      return 42;
    },
    clearTimeout: (timeoutId) => calls.push(['clearTimeout', timeoutId]),
  });
  assert.equal(nextTimeoutId, 42);
  assert.deepEqual(calls, [
    ['setTimeout', 500],
    ['state', true],
  ]);
}
{
  const calls = [];
  const nextTimeoutId = resultLoadingWorkflow.runResultLoadingWorkflow({
    previousLoading: true,
    currentLoading: false,
    currentTimeoutId: 42,
    delay: 500,
    setLoadingState: (showLoadingState) =>
      calls.push(['state', showLoadingState]),
    setTimeout: (callback, delay) => {
      calls.push(['setTimeout', delay]);
      return 99;
    },
    clearTimeout: (timeoutId) => calls.push(['clearTimeout', timeoutId]),
  });
  assert.equal(nextTimeoutId, 0);
  assert.deepEqual(calls, [
    ['clearTimeout', 42],
    ['state', false],
  ]);
}
{
  const calls = [];
  const nextTimeoutId = resultLoadingWorkflow.runResultLoadingWorkflow({
    previousLoading: true,
    currentLoading: true,
    currentTimeoutId: 42,
    delay: 500,
    setLoadingState: (showLoadingState) =>
      calls.push(['state', showLoadingState]),
    setTimeout: (callback, delay) => {
      calls.push(['setTimeout', delay]);
      return 99;
    },
    clearTimeout: (timeoutId) => calls.push(['clearTimeout', timeoutId]),
  });
  assert.equal(nextTimeoutId, 42);
  assert.deepEqual(calls, []);
}
assert.deepEqual(
  resultDownloadState.getResultDownloadState(
    false,
    true,
    false,
    undefined,
    undefined,
  ),
  {
    side: 'left',
    isOriginal: true,
    href: undefined,
    downloadName: '',
    disabled: false,
  },
);
assert.deepEqual(
  resultDownloadState.getResultDownloadState(
    true,
    false,
    true,
    'blob:output',
    makeFile('output.webp', 'image/webp', 120),
  ),
  {
    side: 'right',
    isOriginal: false,
    href: 'blob:output',
    downloadName: 'output.webp',
    disabled: true,
  },
);
assert.deepEqual(
  resultRenderState.getResultRenderState({
    source: { file: originalResultFile },
    imageFile: makeFile('smaller.webp', 'image/webp', 400),
    downloadUrl: 'blob:smaller',
    flipSide: true,
    showLoadingState: false,
  }),
  {
    sizeState: {
      prettySize: { value: '400', unit: 'B' },
      isOriginal: false,
      diff: 0.4,
      direction: 'down',
      percent: 60,
    },
    downloadState: {
      side: 'right',
      isOriginal: false,
      href: 'blob:smaller',
      downloadName: 'smaller.webp',
      disabled: false,
    },
  },
);

assert.equal(outputFilename.getOutputFileName('hero.png', 'webp'), 'hero.webp');
assert.equal(outputFilename.getOutputFileName('hero', 'webp'), 'hero.webp');
assert.equal(outputFilename.getOutputFileName('hero.', 'webp'), 'hero.webp');
assert.equal(
  outputFilename.getOutputFileName('.hidden', 'webp'),
  '.hidden.webp',
);
assert.equal(outputFilename.getOutputFileName('', 'webp'), 'image.webp');
assert.equal(outputFilename.getOutputFileName('   ', 'webp'), 'image.webp');
assert.equal(
  outputFilename.getOutputFileName('folder/photo.large.png', '.avif'),
  'photo.large.avif',
);
assert.equal(
  outputFilename.getOutputFileName('folder\\photo.large.png', 'jxl'),
  'photo.large.jxl',
);
assert.equal(outputFilename.getOutputFileName('???.png', 'webp'), 'image.webp');
assert.equal(
  outputFilename.getOutputFileName('CON.png', 'webp'),
  'CON-file.webp',
);

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

const resultCache = new ResultCache();
const cachePreprocessed = { id: 'preprocessed' };
const cacheEntryA = {
  processed: { id: 'processed-a' },
  data: { id: 'data-a' },
  file: makeFile('cached-a.webp', 'image/webp', 10),
  preprocessed: cachePreprocessed,
  processorState: {
    resize: { enabled: true, width: 100 },
    quantize: { enabled: false, numColors: 256 },
  },
  encoderState: {
    type: 'webP',
    options: { quality: 80 },
  },
};
const cacheEntryB = {
  ...cacheEntryA,
  processed: { id: 'processed-b' },
  data: { id: 'data-b' },
  file: makeFile('cached-b.webp', 'image/webp', 10),
  encoderState: {
    type: 'webP',
    options: { quality: 75 },
  },
};

resultCache.add(cacheEntryA);
assert.deepEqual(
  resultCache.match(cachePreprocessed, cacheEntryA.processorState, {
    type: 'webP',
    options: { quality: 80 },
  }),
  {
    processed: cacheEntryA.processed,
    data: cacheEntryA.data,
    file: cacheEntryA.file,
    preprocessed: cacheEntryA.preprocessed,
    processorState: cacheEntryA.processorState,
    encoderState: cacheEntryA.encoderState,
  },
);
assert.equal(
  resultCache.match(
    { id: 'different-preprocessed' },
    cacheEntryA.processorState,
    {
      type: 'webP',
      options: { quality: 80 },
    },
  ),
  undefined,
);
assert.equal(
  resultCache.match(cachePreprocessed, cacheEntryA.processorState, {
    type: 'webP',
    options: { quality: 81 },
  }),
  undefined,
);
assert.equal(
  resultCache.match(
    cachePreprocessed,
    {
      resize: { enabled: true, width: 101 },
      quantize: { enabled: false, numColors: 256 },
    },
    {
      type: 'webP',
      options: { quality: 80 },
    },
  ),
  undefined,
);

resultCache.add(cacheEntryB);
assert.equal(
  resultCache.match(cachePreprocessed, cacheEntryB.processorState, {
    type: 'webP',
    options: { quality: 75 },
  }).file.name,
  'cached-b.webp',
);

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
const latestOnlySavedSettings = {
  latestSettings: savedSideSettings.latestSettings,
};
assert.deepEqual(
  savedSettings.getSavedSideSettings({
    latestSettings: savedSideSettings.latestSettings,
    encodedSettings: savedSideSettings.encodedSettings,
    downloadUrl: 'blob:not-saved',
    loading: true,
  }),
  savedSideSettings,
);
assert.deepEqual(
  savedSettings.getSavedSideSettings({
    latestSettings: savedSideSettings.latestSettings,
    file: makeFile('live.webp', 'image/webp', 10),
    data: { id: 'live-image-data' },
  }),
  latestOnlySavedSettings,
);
assert.deepEqual(
  savedSettings.writeSavedSideSettingsForSide(
    1,
    {
      latestSettings: savedSideSettings.latestSettings,
      encodedSettings: savedSideSettings.encodedSettings,
    },
    (key, settings) => {
      assert.equal(key, 'rightSideSettings');
      assert.deepEqual(settings, savedSideSettings);
      return true;
    },
  ),
  {
    key: 'rightSideSettings',
    sideLabel: 'Right',
    saved: true,
  },
);
assert.deepEqual(
  savedSettings.getSavedSideSettingsSaveAction({
    key: 'rightSideSettings',
    sideLabel: 'Right',
    saved: true,
  }),
  {
    kind: 'saved',
    message: 'Right side settings saved',
    timeout: 1500,
    actions: ['dismiss'],
    eventKey: 'rightSideSettings',
  },
);
assert.deepEqual(
  savedSettings.writeSavedSideSettingsForSide(
    0,
    {
      latestSettings: savedSideSettings.latestSettings,
    },
    (key, settings) => {
      assert.equal(key, 'leftSideSettings');
      assert.deepEqual(settings, latestOnlySavedSettings);
      return false;
    },
  ),
  {
    key: 'leftSideSettings',
    sideLabel: 'Left',
    saved: false,
  },
);
assert.deepEqual(
  savedSettings.getSavedSideSettingsSaveAction({
    key: 'leftSideSettings',
    sideLabel: 'Left',
    saved: false,
  }),
  {
    kind: 'failed',
    message: 'Left side settings could not be saved',
    timeout: 3000,
    actions: ['dismiss'],
  },
);
assert.deepEqual(
  savedSettings.readSavedSideSettingsForSide(1, (key) => {
    assert.equal(key, 'rightSideSettings');
    return savedSideSettings;
  }),
  {
    key: 'rightSideSettings',
    sideLabel: 'Right',
    settings: savedSideSettings,
  },
);
assert.deepEqual(
  savedSettings.getSavedSideSettingsImportAction({
    key: 'rightSideSettings',
    sideLabel: 'Right',
    settings: savedSideSettings,
  }),
  {
    kind: 'imported',
    message: 'Right side settings imported',
    timeout: 3000,
    actions: ['undo', 'dismiss'],
    settings: savedSideSettings,
  },
);
assert.deepEqual(
  savedSettings.getSavedSideSettingsImportAction({
    key: 'leftSideSettings',
    sideLabel: 'Left',
  }),
  {
    kind: 'invalid',
    message: 'Saved left side settings are invalid',
    timeout: 3000,
    actions: ['dismiss'],
  },
);
assert.deepEqual(
  savedSettings.readInitialSavedSideSettings((key) =>
    key === 'leftSideSettings' ? latestOnlySavedSettings : savedSideSettings,
  ),
  [latestOnlySavedSettings, savedSideSettings],
);
assert.deepEqual(
  savedSettings.parseSavedSideSettings(
    savedSettings.serializeSavedSideSettings(latestOnlySavedSettings),
  ),
  latestOnlySavedSettings,
);
assert.equal(lazyStorage.readLocalStorage('leftSideSettings'), undefined);
savedSettings.writeSavedSideSettings('leftSideSettings', savedSideSettings);
assert.equal(typeof lazyStorage.readLocalStorage('leftSideSettings'), 'string');
assert.deepEqual(
  savedSettings.readSavedSideSettings('leftSideSettings'),
  savedSideSettings,
);
assert.equal(savedSettings.hasSavedSideSettings('leftSideSettings'), true);
assert.equal(savedSettings.hasSavedSideSettings('rightSideSettings'), false);
lazyStorage.writeLocalStorage('rightSideSettings', '{this is not json');
assert.equal(savedSettings.hasSavedSideSettings('rightSideSettings'), false);
global.localStorage = {
  getItem() {
    throw new Error('storage unavailable');
  },
  setItem() {
    throw new Error('storage unavailable');
  },
};
assert.equal(lazyStorage.readLocalStorage('leftSideSettings'), undefined);
assert.equal(
  savedSettings.readSavedSideSettings('leftSideSettings'),
  undefined,
);
assert.equal(savedSettings.hasSavedSideSettings('leftSideSettings'), false);
assert.equal(
  savedSettings.writeSavedSideSettings('leftSideSettings', savedSideSettings),
  false,
);
assert.equal(savedSettings.getSavedSideSettingsKey(0), 'leftSideSettings');
assert.equal(savedSettings.getSavedSideSettingsKey(1), 'rightSideSettings');
assert.equal(savedSettings.getSideLabel(0), 'Left');
assert.equal(savedSettings.getSideLabel(1), 'Right');
global.localStorage = {
  getItem(key) {
    return localStorageItems.has(key) ? localStorageItems.get(key) : null;
  },
  setItem(key, value) {
    localStorageItems.set(key, String(value));
  },
};
assert.equal(serviceWorkerSupport.hasServiceWorkerController(undefined), false);
assert.equal(
  serviceWorkerSupport.hasServiceWorkerController({ controller: null }),
  false,
);
assert.equal(
  serviceWorkerSupport.hasServiceWorkerController({
    controller: { postMessage() {} },
  }),
  true,
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
      version: 999,
      settings: savedSideSettings,
    }),
  ),
  undefined,
);
assert.equal(
  savedSettings.parseSavedSideSettings(
    JSON.stringify({
      version: 1,
      settings: {
        ...savedSideSettings,
        latestSettings: {
          ...savedSideSettings.latestSettings,
          encoderState: { type: 'unknown', options: {} },
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

async function testSavedSettingsWorkflow() {
  const saveEvents = [];
  const savedAction = await savedSettingsWorkflow.runSaveSideSettings({
    index: 1,
    side: {
      latestSettings: savedSideSettings.latestSettings,
      encodedSettings: savedSideSettings.encodedSettings,
    },
    writeSideSettings(index, side) {
      saveEvents.push([
        'write',
        index,
        side.latestSettings === savedSideSettings.latestSettings,
      ]);
      return {
        key: 'rightSideSettings',
        sideLabel: 'Right',
        saved: true,
      };
    },
    dispatchSavedSettingsEvent(eventKey) {
      saveEvents.push(['dispatch', eventKey]);
    },
    async showSnack(message, options) {
      saveEvents.push(['snack', message, options.timeout, options.actions]);
      return 'dismiss';
    },
  });
  assert.equal(savedAction.kind, 'saved');
  assert.deepEqual(saveEvents, [
    ['write', 1, true],
    ['dispatch', 'rightSideSettings'],
    ['snack', 'Right side settings saved', 1500, ['dismiss']],
  ]);

  const failedSaveEvents = [];
  const failedSaveAction = await savedSettingsWorkflow.runSaveSideSettings({
    index: 0,
    side: {
      latestSettings: savedSideSettings.latestSettings,
    },
    writeSideSettings() {
      return {
        key: 'leftSideSettings',
        sideLabel: 'Left',
        saved: false,
      };
    },
    dispatchSavedSettingsEvent(eventKey) {
      failedSaveEvents.push(['dispatch', eventKey]);
    },
    async showSnack(message, options) {
      failedSaveEvents.push([
        'snack',
        message,
        options.timeout,
        options.actions,
      ]);
      return 'dismiss';
    },
  });
  assert.equal(failedSaveAction.kind, 'failed');
  assert.deepEqual(failedSaveEvents, [
    ['snack', 'Left side settings could not be saved', 3000, ['dismiss']],
  ]);

  const originalLeftSide = {
    latestSettings: {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
    encodedSettings: {
      processorState: sharedProcessor,
      encoderState: sharedEncoder,
    },
  };
  const originalRightSide = {
    latestSettings: {
      processorState: sharedProcessor,
      encoderState: undefined,
    },
  };
  const importedLeftSide = {
    ...originalLeftSide,
    latestSettings: savedSideSettings.latestSettings,
    encodedSettings: savedSideSettings.encodedSettings,
  };
  const importEvents = [];
  const importAction = await savedSettingsWorkflow.runImportSideSettings({
    index: 0,
    state: { sides: [originalLeftSide, originalRightSide] },
    readSideSettings(index) {
      importEvents.push(['read', index]);
      return {
        key: 'leftSideSettings',
        sideLabel: 'Left',
        settings: savedSideSettings,
      };
    },
    getApplyState(state, index, settings) {
      importEvents.push(['apply-state', index, settings === savedSideSettings]);
      return {
        sides: [importedLeftSide, state.sides[1]],
        oldSide: state.sides[0],
      };
    },
    onApply(sides) {
      importEvents.push([
        'apply',
        sides[0] === importedLeftSide,
        sides[1] === originalRightSide,
      ]);
    },
    async showSnack(message, options) {
      importEvents.push(['snack', message, options.timeout, options.actions]);
      return 'undo';
    },
    onRestore(side) {
      importEvents.push(['restore', side === originalLeftSide]);
    },
  });
  assert.equal(importAction.kind, 'imported');
  assert.deepEqual(importEvents, [
    ['read', 0],
    ['apply-state', 0, true],
    ['apply', true, true],
    ['snack', 'Left side settings imported', 3000, ['undo', 'dismiss']],
    ['restore', true],
  ]);

  const unmountedImportEvents = [];
  await savedSettingsWorkflow.runImportSideSettings({
    index: 0,
    state: { sides: [originalLeftSide, originalRightSide] },
    isUnmounted: () => true,
    readSideSettings() {
      return {
        key: 'leftSideSettings',
        sideLabel: 'Left',
        settings: savedSideSettings,
      };
    },
    onApply() {
      unmountedImportEvents.push('apply');
    },
    async showSnack() {
      return 'undo';
    },
    onRestore() {
      unmountedImportEvents.push('restore');
    },
  });
  assert.deepEqual(unmountedImportEvents, ['apply']);

  const invalidImportEvents = [];
  const invalidImportAction = await savedSettingsWorkflow.runImportSideSettings(
    {
      index: 1,
      state: { sides: [originalLeftSide, originalRightSide] },
      readSideSettings() {
        return {
          key: 'rightSideSettings',
          sideLabel: 'Right',
        };
      },
      onApply() {
        invalidImportEvents.push('apply');
      },
      async showSnack(message, options) {
        invalidImportEvents.push([
          'snack',
          message,
          options.timeout,
          options.actions,
        ]);
        return 'dismiss';
      },
      onRestore() {
        invalidImportEvents.push('restore');
      },
    },
  );
  assert.equal(invalidImportAction.kind, 'invalid');
  assert.deepEqual(invalidImportEvents, [
    ['snack', 'Saved right side settings are invalid', 3000, ['dismiss']],
  ]);
}

async function testBulkProcessor() {
  const calls = [];
  const fakeWorkerBridge = {};
  const fakeDecoded = { width: 100, height: 50 };
  const fakeVectorImage = { width: 100, height: 50, tagName: 'IMG' };
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
  const processorPlan = bulkProcessor.createBulkProcessPlan(
    {
      ...job,
      overrides: {
        processorState: {
          resize: {
            enabled: true,
            width: 320,
          },
        },
      },
    },
    processorSettings,
  );

  assert.equal(processorPlan.sourceFileName, 'hero.png');
  assert.deepEqual(processorPlan.encoderState, processorSettings.encoderState);
  assert.equal(
    processorPlan.effectiveSettings.processorState.resize.width,
    320,
  );
  assert.equal(
    processorPlan.settingsHash,
    settings.settingsHash(processorPlan.effectiveSettings),
  );

  const processorOutput = await bulkProcessor.processBulkImageJob({
    job,
    globalSettings: processorSettings,
    workerBridge: fakeWorkerBridge,
    signal,
    createDownloadUrl: (file) => `download:${file.name}`,
    pipeline: {
      async decodeSourceImage(receivedSignal, file, workerBridge) {
        calls.push(['decode', receivedSignal, file, workerBridge]);
        return { file, decoded: fakeDecoded, vectorImage: fakeVectorImage };
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
  assert.equal(calls[2][2].vectorImage, fakeVectorImage);
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
      async decodeSourceImage() {
        return { file: job.sourceFile, decoded: fakeDecoded };
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

  assert.throws(
    () =>
      bulkProcessor.createBulkProcessPlan(job, {
        processorState: processorSettings.processorState,
      }),
    /requires an encoder/,
  );

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
          async decodeSourceImage() {
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

  const queueProcessed = [];
  const queueSession = await bulkRunner.processBulkQueue(runnerSession, {
    signal,
    workerBridges: [workerA, workerB],
    concurrency: 2,
    async processJob(job, workerBridge) {
      queueProcessed.push([job.id, workerBridge.name]);
      if (job.id === 'runner-1') throw Error('encode failed');
      return {
        file: makeFile(`${job.id}.webp`, 'image/webp', 500),
        size: 500,
        downloadUrl: `download:${job.id}`,
        percentChange: -50,
        settingsHash: 'hash',
      };
    },
  });

  assert.deepEqual(queueProcessed, [
    ['runner-0', 'a'],
    ['runner-1', 'b'],
    ['runner-2', 'a'],
  ]);
  assert.equal(queueSession.activeJobs, 0);
  assert.deepEqual(
    queueSession.jobs.map((job) => job.status),
    ['encoded', 'failed', 'encoded'],
  );
  assert.equal(queueSession.jobs[2].output.downloadUrl, 'download:runner-2');

  const noRunnableSession = session.createBulkSession(
    'no-runnable-batch',
    globalSettings,
    [
      {
        ...session.createImageJob('finished-runner', runnerFiles[0]),
        status: 'encoded',
      },
    ],
  );
  assert.equal(
    await bulkRunner.processRunnableBulkJobs(noRunnableSession, {
      signal,
      workerBridges: [],
    }),
    noRunnableSession,
  );
  assert.equal(
    await bulkRunner.processRunnableBulkJobs(runnerSession, {
      signal,
      workerBridges: [],
      concurrency: 0,
    }),
    runnerSession,
  );

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
      bulkRunner.processBulkQueue(runnerSession, {
        signal: abortedController.signal,
        workerBridges: [workerA],
        async processJob() {
          throw Error('should not process');
        },
      }),
    (err) => err instanceof Error && err.name === 'AbortError',
  );

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
  const abortError = new Error('stop');
  abortError.name = 'AbortError';
  assert.equal(lazyUtil.isAbortError(abortError), true);
  assert.equal(lazyUtil.isAbortError(new Error('stop')), false);
  assert.equal(lazyUtil.isAbortError({ name: 'AbortError' }), false);

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

async function testSniffMimeType() {
  assert.equal(
    await lazyUtil.sniffMimeType(
      new Blob([
        Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ]),
    ),
    'image/png',
  );
  assert.equal(
    await lazyUtil.sniffMimeType(
      new Blob([Uint8Array.from([0xff, 0xd8, 0xff])]),
    ),
    'image/jpeg',
  );
  assert.equal(
    await lazyUtil.sniffMimeType(new Blob(['RIFFxxxxWEBPVP8X'])),
    'image/webp',
  );
  assert.equal(
    await lazyUtil.sniffMimeType(
      new Blob([Uint8Array.from([0x49, 0x49, 0x2a, 0x00])]),
    ),
    'image/tiff',
  );
  assert.equal(
    await lazyUtil.sniffMimeType(
      new Blob([Uint8Array.from([0x4d, 0x4d, 0x00, 0x2a])]),
    ),
    'image/tiff',
  );
  assert.equal(
    await lazyUtil.sniffMimeType(
      new Blob([Uint8Array.from([0x00, 0x00, 0x00, 0x18]), 'ftypavif']),
    ),
    'image/avif',
  );
  assert.equal(
    await lazyUtil.sniffMimeType(
      new Blob([Uint8Array.from([0x00, 0x00, 0x00, 0x18]), 'ftypisom']),
    ),
    '',
  );
  assert.equal(
    await lazyUtil.sniffMimeType(new Blob([Uint8Array.from([0xff, 0x0a])])),
    'image/jxl',
  );
  assert.equal(await lazyUtil.sniffMimeType(new Blob(['I am not a TIFF'])), '');
  assert.equal(await lazyUtil.sniffMimeType(new Blob(['not an image'])), '');
}

async function testSupportedEncoderMap() {
  const supported = await encoderSupport.getSupportedEncoderMap({
    alwaysSupported: {
      meta: {
        label: 'Always supported',
      },
    },
    asyncSupported: {
      meta: {
        label: 'Async supported',
      },
      async featureTest() {
        return true;
      },
    },
    notSupported: {
      meta: {
        label: 'Not supported',
      },
      async featureTest() {
        return false;
      },
    },
  });

  assert.deepEqual(Object.keys(supported), [
    'alwaysSupported',
    'asyncSupported',
  ]);
  assert.equal(supported.alwaysSupported.meta.label, 'Always supported');
  assert.equal(supported.asyncSupported.meta.label, 'Async supported');
  assert.equal(supported.notSupported, undefined);
}

testBulkProcessor()
  .then(testBulkImportWithMimeSniffing)
  .then(testBulkRunner)
  .then(testBulkUrls)
  .then(testSideCopyWorkflow)
  .then(testSavedSettingsWorkflow)
  .then(testSourceJobRunner)
  .then(testSourceWorkflow)
  .then(testSideJobRunner)
  .then(testSideWorkflow)
  .then(testOptionsWorkflow)
  .then(testInitialAppWorkflow)
  .then(testCompressionUpdateWorkflow)
  .then(testAbortable)
  .then(testSniffMimeType)
  .then(testSupportedEncoderMap)
  .then(() => {
    console.log('Helper tests passed');
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
