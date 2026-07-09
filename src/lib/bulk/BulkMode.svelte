<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import {
    encodeSignature,
    resizeSignature,
  } from '$lib/editor/encode-signature';
  import type { CompressOutcome, SideFormat } from '$lib/compress';
  import SvelteKitWorkerBridge from '$lib/sveltekit-worker-bridge';
  import {
    bulkStore,
    deepEqual,
    normalizeProcessorStateForBulkDiff,
  } from '$lib/bulk/store.svelte';
  import { fromFileList } from '$lib/bulk/import-sources';
  import Home from '$lib/bulk/Home.svelte';
  import {
    getEffectiveSettings,
    type BulkImageOverrides,
    type BulkImageSettings,
    type ImageJob,
  } from 'client/lazy-app/bulk';
  import {
    decodeImage,
    decodeSourceImage,
    preprocessImage,
    processImage,
    type ImagePipelineWorkerBridge,
  } from 'client/lazy-app/image-pipeline';
  import type {
    EncoderState,
    EncoderType,
    ProcessorState,
  } from 'client/lazy-app/feature-meta';
  import {
    defaultPreprocessorState,
    defaultProcessorState,
  } from 'client/lazy-app/feature-meta';

  interface Props {
    onExit: () => void;
  }

  let { onExit }: Props = $props();

  const focusSession = new EditorSession();

  let fileInput = $state<HTMLInputElement>();
  let seeding = true;
  let pendingSeed = $state<{ jobId: string; loadId: number } | null>(null);
  let seedSerial = 0;
  let focusPreviewBridge: SvelteKitWorkerBridge | null = null;
  let focusPreviewController: AbortController | null = null;

  onMount(() => {
    return () => {
      focusPreviewController?.abort();
      focusPreviewBridge?.dispose();
      focusSession.dispose();
    };
  });

  $effect(() => focusSession.seedResizeDimensions());

  $effect(() => {
    const selectedId = bulkStore.selectedId;
    if (!selectedId) {
      seeding = true;
      pendingSeed = null;
      focusSession.clearFile();
      return;
    }

    untrack(() => seedFocusFromSelected());
  });

  $effect(() => {
    const seed = pendingSeed;
    const selectedId = bulkStore.selectedId;
    const loadId = focusSession.loadId;
    const naturalWidth = focusSession.naturalWidth;

    if (
      !seed ||
      seed.jobId !== selectedId ||
      seed.loadId !== loadId ||
      naturalWidth <= 0
    ) {
      return;
    }

    untrack(() => finishFocusSeed(seed));
  });

  $effect(() => {
    bulkStore.session.globalSettings;
    untrack(() => bulkStore.refreshGlobalSideFromSession());
  });

  $effect(() => {
    $state.snapshot(bulkStore.globalSide);
    bulkStore.queueGlobalSideApply(() => seedFocusFromSelected());
  });

  $effect(() => {
    const side = focusSession.sides[1];
    const snapshot = {
      format: side.format,
      options: $state.snapshot(side.optionsByFormat[side.format] ?? {}),
      processorState: $state.snapshot(side.processorState) as ProcessorState,
    };

    if (seeding || !bulkStore.selectedId || !bulkStore.selectedJob) return;

    const override = buildOverrideFromFocus(snapshot);
    const current = bulkStore.selectedJob.overrides ?? {};

    if (isEmptyOverride(override)) {
      if (!isEmptyOverride(current)) bulkStore.queueSelectedOverridesApply({});
      return;
    }

    if (!deepEqual(override, current)) {
      bulkStore.queueSelectedOverridesApply(override);
    }
  });

  function seedFocusFromSelected(): void {
    const job = bulkStore.selectedJob;
    if (!job) return;

    seeding = true;
    pendingSeed = null;
    focusPreviewController?.abort();
    const seedId = ++seedSerial;

    const effective = effectiveSettingsForJob(job);
    if (
      effective.encoderState &&
      job.output?.settingsHash === bulkStore.settingsHashForJob(job)
    ) {
      void hydrateFocusFromBulkOutput(job, effective, seedId);
      return;
    }

    seedFocusThroughEditor(job);
  }

  function seedFocusThroughEditor(job: ImageJob): void {
    const transfer = new DataTransfer();
    transfer.items.add(job.sourceFile);
    // The production method currently requires a callback for the "first open"
    // route hook; bulk owns route state here, so this is intentionally inert.
    focusSession.pickFiles(transfer.files, () => {});
    pendingSeed = { jobId: job.id, loadId: focusSession.loadId };
  }

  function finishFocusSeed(seed: { jobId: string; loadId: number }): void {
    const job = bulkStore.selectedJob;
    if (
      !job ||
      job.id !== seed.jobId ||
      bulkStore.selectedId !== seed.jobId ||
      focusSession.loadId !== seed.loadId ||
      focusSession.naturalWidth <= 0
    ) {
      return;
    }

    focusSession.seedResizeDimensions();

    const effective = effectiveSettingsForJob(job);
    const encoderState = effective.encoderState;
    if (encoderState) {
      focusSession.setFormat(1, encoderState.type as SideFormat);
      focusSession.sides[1].optionsByFormat[encoderState.type] =
        structuredClone(encoderState.options as Record<string, unknown>);
    }
    focusSession.sides[1].processorState = structuredClone(
      effective.processorState,
    );
    focusSession.history.clear();
    reconcileSeededOverrides(job);

    pendingSeed = null;
    seeding = false;
  }

  function reconcileSeededOverrides(job: ImageJob): void {
    const seededOverride = buildOverrideFromFocus(snapshotFocusSide());
    const normalizedCurrent = normalizeExistingOverrides(job, job.overrides);
    const current = job.overrides ?? {};

    if (
      isEmptyOverride(seededOverride) &&
      isEmptyOverride(normalizedCurrent) &&
      !isEmptyOverride(current)
    ) {
      bulkStore.clearAnchorOverrides();
    } else if (
      !deepEqual(seededOverride, current) &&
      deepEqual(seededOverride, normalizedCurrent)
    ) {
      bulkStore.applyAnchorOverrides(seededOverride);
    }
  }

  function focusPreviewWorkerBridge(): ImagePipelineWorkerBridge {
    focusPreviewBridge ??= new SvelteKitWorkerBridge();
    return focusPreviewBridge as unknown as ImagePipelineWorkerBridge;
  }

  async function hydrateFocusFromBulkOutput(
    job: ImageJob,
    effective: BulkImageSettings,
    seedId: number,
  ): Promise<void> {
    const output = job.output;
    const encoderState = effective.encoderState;
    if (!output || !encoderState) {
      seedFocusThroughEditor(job);
      return;
    }

    const controller = new AbortController();
    focusPreviewController = controller;
    const signal = controller.signal;

    try {
      const bridge = focusPreviewWorkerBridge();
      const decodedSource = await decodeSourceImage(
        signal,
        job.sourceFile,
        bridge,
      );
      const preprocessed = await preprocessImage(
        signal,
        decodedSource.decoded,
        defaultPreprocessorState,
        bridge,
      );
      const processed = await processImage(
        signal,
        { ...decodedSource, preprocessed },
        effective.processorState,
        bridge,
      );
      const outputImageData = await decodeImage(signal, output.file, bridge);

      if (
        signal.aborted ||
        seedId !== seedSerial ||
        bulkStore.selectedId !== job.id
      ) {
        return;
      }

      applyHydratedFocus(job, effective, {
        sourceImageData: preprocessed,
        processedImageData: processed,
        outputImageData,
      });
    } catch {
      // Hydration is an optimization; any failure falls back to a real encode.
      if (signal.aborted) return;
      if (seedId === seedSerial && bulkStore.selectedId === job.id) {
        seedFocusThroughEditor(job);
      }
    } finally {
      if (focusPreviewController === controller) {
        focusPreviewController = null;
      }
    }
  }

  function applyHydratedFocus(
    job: ImageJob,
    effective: BulkImageSettings,
    images: {
      sourceImageData: ImageData;
      processedImageData: ImageData;
      outputImageData: ImageData;
    },
  ): void {
    const output = job.output;
    const encoderState = effective.encoderState;
    if (!output || !encoderState) {
      seedFocusThroughEditor(job);
      return;
    }

    focusSession.clearFile();
    focusSession.preprocessorState = structuredClone(defaultPreprocessorState);
    focusSession.sides[0].format = 'identity';
    focusSession.sides[0].processorState = structuredClone(
      defaultProcessorState,
    );
    focusSession.sides[1].format = encoderState.type as SideFormat;
    focusSession.sides[1].optionsByFormat[encoderState.type] = structuredClone(
      encoderState.options as Record<string, unknown>,
    );
    focusSession.sides[1].processorState = structuredClone(
      effective.processorState,
    );

    const loadId = focusSession.loadId + 1;
    const preprocessedWidth = images.sourceImageData.width;
    const preprocessedHeight = images.sourceImageData.height;
    // Seed each runtime under the exact signature the editor's own encode
    // effect will recompute for this document, so hydration registers as
    // "already on screen" instead of triggering a redundant re-encode.
    const leftSig = encodeSignature(
      focusSession.preprocessorState,
      'identity',
      {},
      focusSession.sides[0].processorState,
      preprocessedWidth,
      preprocessedHeight,
    );
    const rightSig = encodeSignature(
      focusSession.preprocessorState,
      focusSession.sides[1].format,
      focusSession.sides[1].optionsByFormat[focusSession.sides[1].format] ?? {},
      focusSession.sides[1].processorState,
      preprocessedWidth,
      preprocessedHeight,
    );
    const leftResizeSig = resizeSignature(
      focusSession.sides[0].processorState,
      preprocessedWidth,
      preprocessedHeight,
    );
    const rightResizeSig = resizeSignature(
      focusSession.sides[1].processorState,
      preprocessedWidth,
      preprocessedHeight,
    );

    const leftOutcome: CompressOutcome = {
      outputFile: job.sourceFile,
      outputUrl: '#',
      outputSize: job.sourceFile.size,
      originalSize: job.sourceFile.size,
      percentChange: 0,
      sourceImageData: images.sourceImageData,
      outputImageData: images.sourceImageData,
      isOriginal: true,
      preprocessedWidth,
      preprocessedHeight,
    };
    const rightOutcome: CompressOutcome = {
      outputFile: output.file,
      outputUrl: output.downloadUrl,
      outputSize: output.size,
      originalSize: job.originalSize,
      percentChange: Math.round(output.percentChange * 10) / 10,
      sourceImageData: images.processedImageData,
      outputImageData: images.outputImageData,
      isOriginal: false,
      preprocessedWidth,
      preprocessedHeight,
    };

    focusSession.file = job.sourceFile;
    focusSession.loadId = loadId;
    seedHydratedRuntime(0, leftOutcome, leftSig, leftResizeSig, loadId);
    seedHydratedRuntime(1, rightOutcome, rightSig, rightResizeSig, loadId);
    focusSession.history.clear();
    reconcileSeededOverrides(job);
    pendingSeed = null;
    seeding = false;
  }

  function seedHydratedRuntime(
    index: 0 | 1,
    outcome: CompressOutcome,
    signature: string,
    resizeSig: string,
    loadId: number,
  ): void {
    const runtime = focusSession.runtime[index];
    runtime.result = outcome;
    runtime.displayedSig = signature;
    runtime.encodedLoadId = loadId;
    runtime.lastResizeSig = resizeSig;
    runtime.spinnerDelayPassed = false;
    runtime.error = '';
    runtime.status = 'done';
  }

  function snapshotFocusSide(): {
    format: SideFormat;
    options: Record<string, unknown>;
    processorState: ProcessorState;
  } {
    const side = focusSession.sides[1];
    return {
      format: side.format,
      options: $state.snapshot(side.optionsByFormat[side.format] ?? {}),
      processorState: $state.snapshot(side.processorState) as ProcessorState,
    };
  }

  function buildOverrideFromFocus(snapshot: {
    format: SideFormat;
    options: Record<string, unknown>;
    processorState: ProcessorState;
  }): BulkImageOverrides {
    const job = bulkStore.selectedJob;
    return buildOverrideFromSettings(
      snapshot.format,
      snapshot.options,
      snapshot.processorState,
      job ? bulkStore.processingGlobalSettingsForJob(job) : undefined,
    );
  }

  function buildOverrideFromSettings(
    format: SideFormat,
    options: Record<string, unknown>,
    processorStateSnapshot: ProcessorState,
    globalSettings: BulkImageSettings = bulkStore.session.globalSettings,
  ): BulkImageOverrides {
    const override: BulkImageOverrides = {};
    const normalizedProcessorState = normalizeProcessorStateForBulkDiff(
      processorStateSnapshot,
    );
    const normalizedGlobalProcessorState = normalizeProcessorStateForBulkDiff(
      globalSettings.processorState,
    );

    if (
      format !== 'identity' &&
      (format !== globalSettings.encoderState?.type ||
        !deepEqual(options, globalSettings.encoderState?.options ?? {}))
    ) {
      override.encoderState = {
        type: format as EncoderType,
        options: structuredClone(options),
      } as EncoderState;
    }

    const processorState: BulkImageOverrides['processorState'] = {};
    for (const key of ['resize', 'quantize'] as const) {
      if (
        !deepEqual(
          normalizedProcessorState[key],
          normalizedGlobalProcessorState[key],
        )
      ) {
        processorState[key] = structuredClone(processorStateSnapshot[key]);
      }
    }

    if (Object.keys(processorState).length > 0) {
      override.processorState = processorState;
    }

    return override;
  }

  function normalizeExistingOverrides(
    job: ImageJob,
    overrides: BulkImageOverrides | undefined,
  ): BulkImageOverrides {
    const effective = getEffectiveSettings(
      bulkStore.processingGlobalSettingsForJob(job),
      overrides,
    );
    const encoderState = effective.encoderState;
    return buildOverrideFromSettings(
      (encoderState?.type ?? 'identity') as SideFormat,
      structuredClone((encoderState?.options ?? {}) as Record<string, unknown>),
      effective.processorState,
      bulkStore.processingGlobalSettingsForJob(job),
    );
  }

  function effectiveSettingsForJob(job: ImageJob): BulkImageSettings {
    return getEffectiveSettings(
      bulkStore.processingGlobalSettingsForJob(job),
      job.overrides,
    );
  }

  function isEmptyOverride(overrides: BulkImageOverrides): boolean {
    return (
      !overrides.encoderState &&
      Object.keys(overrides.processorState ?? {}).length === 0
    );
  }

  function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? fromFileList(input.files) : [];
    if (files.length) void bulkStore.importFiles(files);
    input.value = '';
  }
</script>

<div class="bulk-mode editor-root">
  <div class="bulk-controls" aria-label="Bulk controls">
    <button class="back" onclick={onExit} title="Back" aria-label="Back">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M6.5 6.5l11 11m0-11l-11 11"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
        />
      </svg>
    </button>

    <button type="button" class="add-images" onclick={() => fileInput?.click()}>
      Add images
    </button>

    <input
      bind:this={fileInput}
      class="hidden-input"
      type="file"
      accept="image/*"
      multiple
      onchange={onPick}
    />
  </div>

  <Home {focusSession} onReseed={seedFocusFromSelected} />
</div>

<style>
  .bulk-mode {
    position: relative;
    width: 100vw;
    min-height: 100dvh;
    overflow: hidden;
    background: var(--bg-0, #0c0c0f);
    color: var(--text-1, #f5f5f7);
  }

  .bulk-controls {
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Back button: a circular glass control in the top-left corner. */
  .back {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    color: var(--text-2, #aaa);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    transition:
      color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }
  .back:hover {
    color: var(--text-1, #fff);
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    transform: scale(1.06);
  }
  .back:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: 2px;
  }
  .back svg {
    width: 18px;
    height: 18px;
    display: block;
  }

  .add-images {
    height: 40px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    padding: 0 14px;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: var(--text-1, #f5f5f7);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    font: inherit;
    font-weight: 750;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }
  .add-images:hover {
    background: var(--surface-raise-2, rgba(255, 255, 255, 0.09));
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    transform: translateY(-1px);
  }
  .add-images:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: 2px;
  }

  .hidden-input {
    display: none;
  }

  /* Compact under the SAME conditions that summon FocusView's phone summary
     bar (max-height 500px included) — its --bulk-topbar-h: 44px offset assumes
     this 8px + 36px cluster footprint. */
  @media (max-width: 760px), (max-height: 500px) {
    .bulk-controls {
      top: 8px;
      left: 8px;
      gap: 6px;
    }

    .back {
      width: 36px;
      height: 36px;
    }
    .back svg {
      width: 16px;
      height: 16px;
    }

    .add-images {
      height: 36px;
      padding: 0 12px;
      font-size: 0.95rem;
    }
  }
</style>
