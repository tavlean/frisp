<script lang="ts">
  import {
    compressFile,
    getDefaultOptions,
    OUTPUT_FORMATS,
    type CompressOutcome,
    type OutputFormat,
  } from '$lib/compress';
  import { registerPrototypeServiceWorker } from '$lib/service-worker-registration';
  import WebpOptions from '$lib/editor/options/WebpOptions.svelte';
  import Range from '$lib/editor/options/Range.svelte';
  import type { EncodeOptions as WebpEncodeOptions } from 'features/encoders/webP/shared/meta';
  import '$lib/editor/theme.css';

  let file = $state<File | null>(null);
  let dragging = $state(false);
  let format = $state<OutputFormat>('webP');
  // One option object per format, seeded from each encoder's defaults. Panels
  // mutate these proxies in place; the encode effect reads them via a snapshot.
  let optionsByFormat = $state<Record<string, Record<string, unknown>>>(
    Object.fromEntries(OUTPUT_FORMATS.map((f) => [f.id, getDefaultOptions(f.id)])),
  );
  let resizeOn = $state(false);
  let resizeWidth = $state(1600);
  let resizeHeight = $state(1600);

  let originalUrl = $state('');
  let result = $state<CompressOutcome | null>(null);
  let status = $state<'idle' | 'working' | 'done' | 'error'>('idle');
  let errorMessage = $state('');

  // Non-reactive holder so revoking the previous output URL does not re-trigger
  // the compression effect.
  let lastOutputUrl: string | null = null;

  $effect(() => {
    registerPrototypeServiceWorker().catch((error: unknown) => {
      console.error('Service worker registration failed', error);
    });
  });

  // Original-image preview lifecycle.
  $effect(() => {
    const current = file;
    if (!current) {
      originalUrl = '';
      return;
    }
    const url = URL.createObjectURL(current);
    originalUrl = url;
    return () => URL.revokeObjectURL(url);
  });

  // Re-encode whenever the file or any setting changes. Debounced so dragging
  // the quality slider does not spawn an encode per pixel.
  $effect(() => {
    const current = file;
    // $state.snapshot deeply reads the option object, so editing any nested
    // option (quality, lossless, advanced…) re-triggers this effect.
    const request = {
      format,
      options: $state.snapshot(optionsByFormat[format]),
      resize: resizeOn
        ? { width: resizeWidth, height: resizeHeight }
        : undefined,
    };
    if (!current) {
      status = 'idle';
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      status = 'working';
      errorMessage = '';
      compressFile(current, request, controller.signal)
        .then((outcome) => {
          if (controller.signal.aborted) {
            URL.revokeObjectURL(outcome.outputUrl);
            return;
          }
          if (lastOutputUrl) URL.revokeObjectURL(lastOutputUrl);
          lastOutputUrl = outcome.outputUrl;
          result = outcome;
          status = 'done';
        })
        .catch((error: unknown) => {
          if (controller.signal.aborted) return;
          errorMessage = error instanceof Error ? error.message : String(error);
          status = 'error';
        });
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  });

  function pickFiles(list: FileList | null | undefined) {
    const next = list?.[0];
    if (next && next.type.startsWith('image/')) {
      file = next;
      result = null;
    }
  }

  function onInput(event: Event) {
    pickFiles((event.currentTarget as HTMLInputElement).files);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragging = false;
    pickFiles(event.dataTransfer?.files);
  }

  const activeExt = $derived(
    OUTPUT_FORMATS.find((f) => f.id === format)?.ext ?? 'bin',
  );
  const downloadName = $derived(
    file ? file.name.replace(/\.[^.]+$/, '') + '.' + activeExt : 'image',
  );

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }
</script>

<svelte:head>
  <title>Sqush — Compress an image</title>
</svelte:head>

<main>
  <header>
    <h1>Sqush</h1>
    <p>Local-first image compression. Nothing leaves your device.</p>
  </header>

  {#if !file}
    <label
      class="dropzone"
      class:dragging
      ondragover={(e) => {
        e.preventDefault();
        dragging = true;
      }}
      ondragleave={() => (dragging = false)}
      ondrop={onDrop}
    >
      <input type="file" accept="image/*" onchange={onInput} />
      <strong>Drop an image here</strong>
      <span>or click to choose a file</span>
    </label>
  {:else}
    <section class="workspace">
      <div class="previews">
        <figure>
          <figcaption>Original</figcaption>
          <div class="frame">
            {#if originalUrl}<img src={originalUrl} alt="Original" />{/if}
          </div>
          <p class="size">{formatBytes(file.size)}</p>
        </figure>

        <figure>
          <figcaption>{format} output</figcaption>
          <div class="frame">
            {#if status === 'working'}
              <p class="hint">Compressing…</p>
            {:else if status === 'error'}
              <p class="hint error">{errorMessage}</p>
            {:else if result}
              <img src={result.outputUrl} alt="Compressed output" />
            {/if}
          </div>
          <p class="size">
            {#if result}
              {formatBytes(result.outputSize)}
              <span
                class="delta"
                class:good={result.percentChange < 0}
                class:bad={result.percentChange > 0}
              >
                {result.percentChange > 0 ? '+' : ''}{result.percentChange}%
              </span>
            {:else}
              &nbsp;
            {/if}
          </p>
        </figure>
      </div>

      <aside class="controls">
        <div class="field">
          <span class="label">Format</span>
          <div class="formats">
            {#each OUTPUT_FORMATS as option (option.id)}
              <button
                type="button"
                class:active={format === option.id}
                onclick={() => (format = option.id)}
              >
                {option.label}
              </button>
            {/each}
          </div>
        </div>

        <div class="field">
          <span class="label">Options</span>
          <div class="sqush-editor option-panel">
            {#if format === 'webP'}
              <WebpOptions
                options={optionsByFormat[format] as unknown as WebpEncodeOptions}
              />
            {:else}
              <div class="options-section">
                {#if typeof optionsByFormat[format].quality === 'number'}
                  <div class="option-one-cell">
                    <Range
                      min={0}
                      max={100}
                      step={0.1}
                      value={Number(optionsByFormat[format].quality)}
                      oninput={(v) => (optionsByFormat[format].quality = v)}
                      >Quality:</Range
                    >
                  </div>
                {:else}
                  <p class="no-opts">
                    No adjustable options for {format} yet.
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="field">
          <label class="label checkbox">
            <input type="checkbox" bind:checked={resizeOn} />
            Resize
          </label>
          {#if resizeOn}
            <div class="dims">
              <input type="number" min="1" bind:value={resizeWidth} />
              <span>×</span>
              <input type="number" min="1" bind:value={resizeHeight} />
            </div>
          {/if}
        </div>

        <div class="actions">
          <a
            class="download"
            class:disabled={!result || status !== 'done'}
            href={result?.outputUrl ?? '#'}
            download={downloadName}
          >
            Download {activeExt.toUpperCase()}
          </a>
          <button type="button" class="ghost" onclick={() => (file = null)}>
            Choose another
          </button>
        </div>

        <p class="diag"><a href="/diagnostics">Pipeline diagnostics →</a></p>
      </aside>
    </section>
  {/if}
</main>

<style>
  :global(body) {
    margin: 0;
    background: #f6f4ef;
    color: #171717;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      'Segoe UI', sans-serif;
  }
  main {
    max-width: 1080px;
    margin: 0 auto;
    padding: 48px 24px;
  }
  header {
    margin-bottom: 28px;
  }
  h1 {
    margin: 0 0 4px;
    font-size: 2.4rem;
    letter-spacing: -0.02em;
  }
  header p {
    margin: 0;
    color: #666055;
  }
  .dropzone {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
    justify-content: center;
    min-height: 320px;
    border: 2px dashed #cfc7b8;
    border-radius: 14px;
    background: #fffdfa;
    cursor: pointer;
    text-align: center;
  }
  .dropzone.dragging {
    border-color: #0f766e;
    background: #ecfdf5;
  }
  .dropzone strong {
    font-size: 1.2rem;
  }
  .dropzone span {
    color: #666055;
  }
  .dropzone input {
    display: none;
  }
  .workspace {
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 20px;
    align-items: start;
  }
  .previews {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
  }
  figure {
    margin: 0;
  }
  figcaption {
    margin-bottom: 8px;
    color: #666055;
    font-size: 0.85rem;
    text-transform: capitalize;
  }
  .frame {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 280px;
    padding: 12px;
    border: 1px solid #d8d1c4;
    border-radius: 10px;
    background: #fffdfa;
  }
  .frame img {
    max-width: 100%;
    max-height: 360px;
    object-fit: contain;
  }
  .hint {
    color: #666055;
  }
  .hint.error {
    color: #b91c1c;
    font-weight: 600;
  }
  .size {
    margin: 10px 0 0;
    font-weight: 700;
  }
  .delta {
    margin-left: 8px;
    font-weight: 700;
  }
  .delta.good {
    color: #047857;
  }
  .delta.bad {
    color: #b91c1c;
  }
  .controls {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px;
    border: 1px solid #d8d1c4;
    border-radius: 10px;
    background: #fffdfa;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .label {
    color: #666055;
    font-size: 0.85rem;
  }
  .formats {
    display: flex;
    gap: 6px;
  }
  .formats button {
    flex: 1;
    padding: 8px;
    border: 1px solid #ded7cb;
    border-radius: 6px;
    background: #fff;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .formats button.active {
    border-color: #0f766e;
    background: #ecfdf5;
    font-weight: 600;
  }
  .option-panel {
    border-radius: 8px;
    overflow: hidden;
    font-size: 1.1rem;
  }
  .no-opts {
    margin: 0;
    padding: 14px 15px;
    color: #bcbcbc;
  }
  .checkbox {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
  }
  .dims {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .dims input {
    width: 100%;
    padding: 6px 8px;
    border: 1px solid #ded7cb;
    border-radius: 6px;
    font: inherit;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .download {
    padding: 10px;
    border-radius: 6px;
    background: #0f766e;
    color: #fff;
    font-weight: 600;
    text-align: center;
    text-decoration: none;
  }
  .download.disabled {
    background: #cfc7b8;
    pointer-events: none;
  }
  .ghost {
    padding: 9px;
    border: 1px solid #ded7cb;
    border-radius: 6px;
    background: #fff;
    color: inherit;
    font: inherit;
    cursor: pointer;
  }
  .diag {
    margin: 0;
    font-size: 0.85rem;
  }
  .diag a {
    color: #0f766e;
  }
  @media (max-width: 760px) {
    .workspace,
    .previews {
      grid-template-columns: 1fr;
    }
  }
</style>
