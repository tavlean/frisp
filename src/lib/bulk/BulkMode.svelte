<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import {
    encodeSignature,
    resizeSignature,
  } from '$lib/editor/encode-signature';
  import { applyRecipeToSide, recipeFromSide } from '$lib/editor/side-recipe';
  import type { CompressOutcome } from '$lib/compress';
  import SvelteKitWorkerBridge from '$lib/sveltekit-worker-bridge';
  import { bulkStore, deepEqual } from '$lib/bulk/store.svelte';
  import { fromFileList } from '$lib/bulk/import-sources';
  import Home from '$lib/bulk/Home.svelte';
  import { applyRecipeChanges, type ImageJob } from 'client/lazy-app/bulk';
  import type { ImageRecipe } from 'client/lazy-app/recipe';
  import {
    decodeImage,
    decodeSourceImage,
    preprocessImage,
    processImage,
    type ImagePipelineWorkerBridge,
  } from 'client/lazy-app/image-pipeline';
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
  // The focus recipe as last seeded or emitted. Each focus edit is sent as the
  // change from this, so it lands on every selected image without flattening
  // their other differences.
  let lastFocusRecipe: ImageRecipe | null = null;
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
    bulkStore.session.sharedRecipe;
    untrack(() => bulkStore.refreshGlobalSideFromSession());
  });

  $effect(() => {
    $state.snapshot(bulkStore.globalSide);
    bulkStore.queueGlobalSideApply(() => seedFocusFromSelected());
  });

  $effect(() => {
    const recipe = currentFocusRecipe();

    if (seeding || !bulkStore.selectedId || !bulkStore.selectedJob) return;

    const before = lastFocusRecipe;
    if (!before || deepEqual(before, recipe)) return;
    lastFocusRecipe = recipe;
    bulkStore.editSelected((target) =>
      applyRecipeChanges(target, before, recipe),
    );
  });

  function currentFocusRecipe(): ImageRecipe {
    return $state.snapshot(
      recipeFromSide(focusSession.sides[1], focusSession.preprocessorState),
    ) as ImageRecipe;
  }

  function seedFocusFromSelected(): void {
    const job = bulkStore.selectedJob;
    if (!job) return;

    seeding = true;
    pendingSeed = null;
    focusPreviewController?.abort();
    const seedId = ++seedSerial;

    const effective = bulkStore.effectiveRecipeFor(job.id);
    if (
      effective?.output.kind === 'raster' &&
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

    const effective = bulkStore.effectiveRecipeFor(job.id);
    // Bulk recipes carry no rotation yet (no Rotate control), so the returned
    // preprocessor state is always the unrotated one the load set.
    if (effective) applyRecipeToSide(effective, focusSession.sides[1]);
    focusSession.history.clear();
    lastFocusRecipe = currentFocusRecipe();

    pendingSeed = null;
    seeding = false;
  }

  function focusPreviewWorkerBridge(): ImagePipelineWorkerBridge {
    focusPreviewBridge ??= new SvelteKitWorkerBridge();
    return focusPreviewBridge as unknown as ImagePipelineWorkerBridge;
  }

  async function hydrateFocusFromBulkOutput(
    job: ImageJob,
    effective: ImageRecipe,
    seedId: number,
  ): Promise<void> {
    const output = job.output;
    if (!output || effective.output.kind !== 'raster') {
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
        effective.processors,
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
    effective: ImageRecipe,
    images: {
      sourceImageData: ImageData;
      processedImageData: ImageData;
      outputImageData: ImageData;
    },
  ): void {
    const output = job.output;
    if (!output || effective.output.kind !== 'raster') {
      seedFocusThroughEditor(job);
      return;
    }

    focusSession.clearFile();
    focusSession.preprocessorState = structuredClone(defaultPreprocessorState);
    focusSession.sides[0].format = 'identity';
    focusSession.sides[0].processorState = structuredClone(
      defaultProcessorState,
    );
    applyRecipeToSide(effective, focusSession.sides[1]);

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
    lastFocusRecipe = currentFocusRecipe();
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
