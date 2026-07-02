<script lang="ts">
  import { dev } from '$app/environment';
  import { onMount, untrack } from 'svelte';
  import { fileDrop } from '$lib/editor/file-drop';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import type { SideFormat } from '$lib/compress';
  import {
    labBulk,
    deepEqual,
    normalizeProcessorStateForBulkDiff,
    type LabVariant,
  } from '$lib/lab/bulk/store.svelte';
  import { makeSampleFiles } from '$lib/lab/bulk/samples';
  import { toast } from '$lib/lab/bulk/Toast.svelte';
  import Toast from '$lib/lab/bulk/Toast.svelte';
  import L1Home from '$lib/lab/bulk/L1Home.svelte';
  import L2Home from '$lib/lab/bulk/L2Home.svelte';
  import L3Home from '$lib/lab/bulk/L3Home.svelte';
  import {
    getEffectiveSettings,
    type BulkImageOverrides,
  } from 'client/lazy-app/bulk';
  import type {
    EncoderState,
    EncoderType,
    ProcessorState,
  } from 'client/lazy-app/feature-meta';
  import '$lib/editor/theme.css';

  const focusSession = new EditorSession();

  let fileInput = $state<HTMLInputElement>();
  let loadingSamples = $state(false);
  let seeding = true;
  let pendingSeed = $state<{ jobId: string; loadId: number } | null>(null);

  onMount(() => {
    return () => {
      focusSession.dispose();
      labBulk.dispose();
    };
  });

  $effect(() => focusSession.seedResizeDimensions());

  $effect(() => {
    const selectedId = labBulk.selectedId;
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
    const selectedId = labBulk.selectedId;
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
    labBulk.session.globalSettings;
    untrack(() => labBulk.refreshGlobalSideFromSession());
  });

  $effect(() => {
    $state.snapshot(labBulk.globalSide);
    labBulk.queueGlobalSideApply(() => seedFocusFromSelected());
  });

  $effect(() => {
    const side = focusSession.sides[1];
    const snapshot = {
      format: side.format,
      options: $state.snapshot(side.optionsByFormat[side.format] ?? {}),
      processorState: $state.snapshot(side.processorState) as ProcessorState,
    };

    if (seeding || !labBulk.selectedId || !labBulk.selectedJob) return;

    const override = buildOverrideFromFocus(snapshot);
    const current = labBulk.selectedJob.overrides ?? {};

    if (isEmptyOverride(override)) {
      if (!isEmptyOverride(current)) labBulk.clearSelectedOverrides();
      return;
    }

    if (!deepEqual(override, current)) {
      labBulk.applySelectedOverrides(override);
    }
  });

  function seedFocusFromSelected(): void {
    const job = labBulk.selectedJob;
    if (!job) return;

    seeding = true;
    pendingSeed = null;

    const transfer = new DataTransfer();
    transfer.items.add(job.sourceFile);
    // The production method currently requires a callback for the "first open"
    // route hook; the lab needs no route state, so this is intentionally inert.
    focusSession.pickFiles(transfer.files, () => {});
    pendingSeed = { jobId: job.id, loadId: focusSession.loadId };
  }

  function finishFocusSeed(seed: { jobId: string; loadId: number }): void {
    const job = labBulk.selectedJob;
    if (
      !job ||
      job.id !== seed.jobId ||
      labBulk.selectedId !== seed.jobId ||
      focusSession.loadId !== seed.loadId ||
      focusSession.naturalWidth <= 0
    ) {
      return;
    }

    focusSession.seedResizeDimensions();

    const effective = getEffectiveSettings(
      labBulk.session.globalSettings,
      job.overrides,
    );
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

    const seededOverride = buildOverrideFromFocus(snapshotFocusSide());
    const normalizedCurrent = normalizeExistingOverrides(job.overrides);
    const current = job.overrides ?? {};

    if (
      isEmptyOverride(seededOverride) &&
      isEmptyOverride(normalizedCurrent) &&
      !isEmptyOverride(current)
    ) {
      labBulk.clearSelectedOverrides();
    } else if (
      !deepEqual(seededOverride, current) &&
      deepEqual(seededOverride, normalizedCurrent)
    ) {
      labBulk.applySelectedOverrides(seededOverride);
    }

    pendingSeed = null;
    seeding = false;
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
    return buildOverrideFromSettings(
      snapshot.format,
      snapshot.options,
      snapshot.processorState,
    );
  }

  function buildOverrideFromSettings(
    format: SideFormat,
    options: Record<string, unknown>,
    processorStateSnapshot: ProcessorState,
  ): BulkImageOverrides {
    const global = labBulk.session.globalSettings;
    const override: BulkImageOverrides = {};
    const normalizedProcessorState = normalizeProcessorStateForBulkDiff(
      processorStateSnapshot,
    );
    const normalizedGlobalProcessorState = normalizeProcessorStateForBulkDiff(
      global.processorState,
    );

    if (
      format !== 'identity' &&
      (format !== global.encoderState?.type ||
        !deepEqual(options, global.encoderState?.options ?? {}))
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
    overrides: BulkImageOverrides | undefined,
  ): BulkImageOverrides {
    const effective = getEffectiveSettings(
      labBulk.session.globalSettings,
      overrides,
    );
    const encoderState = effective.encoderState;
    return buildOverrideFromSettings(
      (encoderState?.type ?? 'identity') as SideFormat,
      structuredClone((encoderState?.options ?? {}) as Record<string, unknown>),
      effective.processorState,
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
    const files = input.files ? Array.from(input.files) : [];
    if (files.length) void labBulk.importFiles(files);
    input.value = '';
  }

  function onDrop(list: FileList) {
    void labBulk.importFiles(Array.from(list));
  }

  async function loadSamples() {
    loadingSamples = true;
    try {
      const files = await makeSampleFiles(12);
      await labBulk.importFiles(files);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Could not build samples');
    } finally {
      loadingSamples = false;
    }
  }

  function setVariant(variant: LabVariant): void {
    labBulk.variant = variant;
  }

  function resetLab(): void {
    seeding = true;
    focusSession.clearFile();
    labBulk.resetLab();
  }
</script>

<svelte:head>
  <title>Bulk UI Lab</title>
</svelte:head>

{#if dev}
  <div class="lab" {@attach fileDrop(onDrop)}>
    <div class="lab-controls" aria-label="Lab controls">
      <div class="variant-toggle" role="radiogroup" aria-label="Layout variant">
        <button
          type="button"
          class:active={labBulk.variant === 'l1'}
          role="radio"
          aria-checked={labBulk.variant === 'l1'}
          onclick={() => setVariant('l1')}
        >
          L1
        </button>
        <button
          type="button"
          class:active={labBulk.variant === 'l2'}
          role="radio"
          aria-checked={labBulk.variant === 'l2'}
          onclick={() => setVariant('l2')}
        >
          L2
        </button>
        <button
          type="button"
          class:active={labBulk.variant === 'l3'}
          role="radio"
          aria-checked={labBulk.variant === 'l3'}
          onclick={() => setVariant('l3')}
        >
          L3
        </button>
      </div>

      <button type="button" class="btn" onclick={() => fileInput?.click()}>
        Add images
      </button>
      <button
        type="button"
        class="btn"
        disabled={loadingSamples}
        onclick={loadSamples}
      >
        {loadingSamples ? 'Building…' : 'Load 12 samples'}
      </button>
      <button type="button" class="btn ghost" onclick={resetLab}>Reset</button>

      <input
        bind:this={fileInput}
        class="hidden-input"
        type="file"
        accept="image/*"
        multiple
        onchange={onPick}
      />
    </div>

    {#if labBulk.hasJobs}
      {#if labBulk.variant === 'l1'}
        <L1Home {focusSession} onReseed={seedFocusFromSelected} />
      {:else if labBulk.variant === 'l2'}
        <L2Home {focusSession} onReseed={seedFocusFromSelected} />
      {:else}
        <L3Home {focusSession} onReseed={seedFocusFromSelected} />
      {/if}
    {:else}
      <main class="dropzone">
        <div class="dropzone-inner">
          <p class="drop-title">Drop images to start</p>
          <p class="drop-hint">
            or use <strong>Add images</strong> /
            <strong>Load 12 samples</strong> above.
          </p>
        </div>
      </main>
    {/if}

    <Toast />
  </div>
{:else}
  <main class="not-dev">
    <p>The Bulk UI Lab is only available in development.</p>
  </main>
{/if}

<style>
  :global(html),
  :global(body) {
    height: 100%;
  }
  :global(body) {
    background: #0c0c0f;
    color: #f5f5f7;
  }

  .lab {
    position: relative;
    width: 100vw;
    min-height: 100dvh;
    overflow: hidden;
    background: var(--bg-0, #0c0c0f);
    color: var(--text-1, #f5f5f7);
  }

  .lab::after {
    content: '';
    position: fixed;
    inset: 10px;
    border: 2px dashed var(--accent-1, #ff8a5e);
    background-color: rgba(255, 122, 80, 0.06);
    border-radius: 16px;
    opacity: 0;
    transform: scale(0.95);
    transition:
      opacity 200ms ease-in,
      transform 200ms ease-in;
    pointer-events: none;
    z-index: 40;
  }
  .lab:global(.drop-valid)::after {
    opacity: 1;
    transform: scale(1);
    transition-timing-function: ease-out;
  }

  .lab-controls {
    position: fixed;
    top: 14px;
    right: 14px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    border-radius: 999px;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }

  .variant-toggle {
    display: inline-flex;
    padding: 2px;
    border-radius: 999px;
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
  }

  .variant-toggle button,
  .btn {
    border: none;
    border-radius: 999px;
    font: inherit;
    font-weight: 750;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease,
      opacity 150ms ease;
  }

  .variant-toggle button {
    padding: 6px 10px;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
  }

  .variant-toggle button.active {
    background: var(--accent-1, #ff8a5e);
    color: #16161c;
  }

  .btn {
    padding: 7px 11px;
    background: transparent;
    color: var(--text-1, #f5f5f7);
  }

  .btn:hover:not(:disabled) {
    background: var(--surface-raise-2, rgba(255, 255, 255, 0.09));
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn.ghost {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
  }

  .hidden-input {
    display: none;
  }

  .dropzone {
    min-height: 100dvh;
    display: grid;
    place-items: center;
    padding: 24px;
    box-sizing: border-box;
  }

  .dropzone-inner {
    display: grid;
    gap: 8px;
    justify-items: center;
    width: min(560px, 100%);
    padding: 64px 32px;
    border: 2px dashed var(--border-strong, rgba(255, 255, 255, 0.16));
    border-radius: var(--options-radius, 16px);
    background: var(--surface, rgba(19, 19, 25, 0.82));
    text-align: center;
    transition:
      border-color 200ms ease,
      background-color 200ms ease;
  }

  .lab:global(.drop-valid) .dropzone-inner {
    border-color: var(--accent-1, #ff8a5e);
    background: color-mix(in srgb, var(--accent-1, #ff8a5e) 10%, transparent);
  }

  .drop-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 800;
  }

  .drop-hint {
    margin: 0;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.95rem;
  }

  .not-dev {
    display: grid;
    place-items: center;
    min-height: 100vh;
    color: #888;
    font-family: system-ui, sans-serif;
  }

  @media (max-width: 760px) {
    .lab-controls {
      left: 8px;
      right: 8px;
      top: 8px;
      overflow-x: auto;
      justify-content: flex-end;
      border-radius: 18px;
    }

    .btn {
      white-space: nowrap;
    }
  }
</style>
