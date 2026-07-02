<script lang="ts">
  // Bulk UI Lab — dev-only sandbox for the two layout variants (L1 focus-first,
  // L2 grid). Mirrors the diagnostics route's gating: the whole app is
  // ssr=false + prerender=true (root +layout.ts), and dev-only content is gated
  // client-side with `dev` from $app/environment (diagnostics does the same;
  // there is no per-route config to add).
  //
  // Top bar: title, L1⇄L2 variant toggle, Add images, Load 12 samples, Reset.
  // Body: empty → a big drop zone (fileDrop attachment); else → the variant
  // home. "Save all · ZIP" anywhere is a stub toast (Phase 2).
  import { dev } from '$app/environment';
  import { onMount } from 'svelte';
  import { fileDrop } from '$lib/editor/file-drop';
  import { labBulk } from '$lib/lab/bulk/store.svelte';
  import { makeSampleFiles } from '$lib/lab/bulk/samples';
  import { toast } from '$lib/lab/bulk/Toast.svelte';
  import Toast from '$lib/lab/bulk/Toast.svelte';
  import L1Home from '$lib/lab/bulk/L1Home.svelte';
  import L2Home from '$lib/lab/bulk/L2Home.svelte';
  import '$lib/editor/theme.css';

  let fileInput = $state<HTMLInputElement>();
  let loadingSamples = $state(false);

  onMount(() => {
    return () => labBulk.dispose();
  });

  function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (files.length) void labBulk.importFiles(files);
    // Reset so re-picking the same files fires change again.
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
</script>

<svelte:head>
  <title>Bulk UI Lab</title>
</svelte:head>

{#if dev}
  <div class="lab sqush-editor" {@attach fileDrop(onDrop)}>
    <header class="topbar">
      <h1>Bulk UI Lab</h1>

      <div class="variant-toggle" role="radiogroup" aria-label="Layout variant">
        <button
          type="button"
          class:active={labBulk.variant === 'l1'}
          role="radio"
          aria-checked={labBulk.variant === 'l1'}
          onclick={() => (labBulk.variant = 'l1')}
        >
          L1 · Focus
        </button>
        <button
          type="button"
          class:active={labBulk.variant === 'l2'}
          role="radio"
          aria-checked={labBulk.variant === 'l2'}
          onclick={() => (labBulk.variant = 'l2')}
        >
          L2 · Grid
        </button>
      </div>

      <div class="actions">
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
        <button
          type="button"
          class="btn ghost"
          onclick={() => labBulk.resetLab()}
        >
          Reset
        </button>
      </div>

      <input
        bind:this={fileInput}
        class="hidden-input"
        type="file"
        accept="image/*"
        multiple
        onchange={onPick}
      />
    </header>

    <div class="body">
      {#if labBulk.hasJobs}
        {#if labBulk.variant === 'l1'}
          <L1Home />
        {:else}
          <L2Home />
        {/if}
      {:else}
        <div class="dropzone">
          <div class="dropzone-inner">
            <p class="drop-title">Drop images to start</p>
            <p class="drop-hint">
              or use <strong>Add images</strong> /
              <strong>Load 12 samples</strong> above. Format is locked to WebP for
              the lab.
            </p>
          </div>
        </div>
      {/if}
    </div>

    <Toast />
  </div>
{:else}
  <main class="not-dev">
    <p>The Bulk UI Lab is only available in development.</p>
  </main>
{/if}

<style>
  .lab {
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-sizing: border-box;
    min-height: 100vh;
    padding: 16px;
    background: var(--bg-0, #0c0c0f);
    color: var(--text-1, #f5f5f7);
  }

  .topbar {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }

  h1 {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
  }

  .variant-toggle {
    display: inline-flex;
    padding: 3px;
    border-radius: 999px;
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  }

  .variant-toggle button {
    padding: 6px 14px;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .variant-toggle button.active {
    background: var(--accent-1, #ff8a5e);
    color: #16161c;
  }

  .actions {
    display: inline-flex;
    gap: 8px;
    margin-left: auto;
  }

  .btn {
    padding: 8px 15px;
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.16));
    border-radius: 999px;
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
    color: var(--text-1, #f5f5f7);
    font: inherit;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      opacity 150ms ease;
  }

  .btn:hover:not(:disabled) {
    background: var(--surface-raise-2, rgba(255, 255, 255, 0.09));
    border-color: var(--text-3, rgba(235, 235, 245, 0.38));
  }

  .btn:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .btn.ghost {
    background: transparent;
  }

  .hidden-input {
    display: none;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  /* fileDrop toggles .drop-valid on the attached element while dragging. */
  .lab :global(.drop-valid) .dropzone-inner {
    border-color: var(--accent-1, #ff8a5e);
    background: color-mix(in srgb, var(--accent-1, #ff8a5e) 10%, transparent);
  }

  .dropzone {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 24px;
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

  .drop-title {
    margin: 0;
    font-size: 1.4rem;
    font-weight: 700;
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
</style>
