<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { runCodecAssetProbe } from '$lib/codec-asset-probe';
  import { createDiagnosticsModel } from '$lib/diagnostics-data';
  import type { CodecAssetProbeResult } from '$lib/codec-asset-probe';
  import {
    runWebpEncodeProbe,
    type WebpEncodeProbeResult,
  } from '$lib/webp-encode-probe';
  import {
    runWebpPipelineProbe,
    type WebpPipelineProbeResult,
  } from '$lib/webp-pipeline-probe';
  import { registerSqushServiceWorker } from '$lib/service-worker-registration';

  const model = createDiagnosticsModel();

  let selectedJobId = $state(model.session.selectedJobId ?? '');
  let codecProbe = $state<
    | { status: 'checking' }
    | { status: 'ready'; result: CodecAssetProbeResult }
    | { status: 'failed'; message: string }
  >({ status: 'checking' });
  let encodeProbe = $state<
    | { status: 'checking' }
    | { status: 'ready'; result: WebpEncodeProbeResult }
    | { status: 'failed'; message: string }
  >({ status: 'checking' });
  let pipelineProbe = $state<
    | { status: 'checking' }
    | { status: 'ready'; result: WebpPipelineProbeResult }
    | { status: 'failed'; message: string }
  >({ status: 'checking' });
  const selectedJob = $derived(
    model.session.jobs.find((job) => job.id === selectedJobId) ??
      model.session.jobs[0],
  );
  // `model` is a plain (non-reactive) const, so these are static reads — no
  // $derived needed (it would track nothing).
  const progress = model.summary.progress;
  const exportSummary = model.summary.export;

  onMount(() => {
    const controller = new AbortController();
    let cancelled = false;

    registerSqushServiceWorker().catch((error: unknown) => {
      console.error('SvelteKit service-worker registration failed', error);
    });

    runCodecAssetProbe()
      .then((result) => {
        if (!cancelled) codecProbe = { status: 'ready', result };
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          codecProbe = {
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
          };
        }
      });

    runWebpEncodeProbe()
      .then((result) => {
        if (!cancelled) encodeProbe = { status: 'ready', result };
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          encodeProbe = {
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
          };
        }
      });

    runWebpPipelineProbe(controller.signal)
      .then((result) => {
        if (!cancelled) pipelineProbe = { status: 'ready', result };
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          pipelineProbe = {
            status: 'failed',
            message: error instanceof Error ? error.message : String(error),
          };
        }
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  });
</script>

<svelte:head>
  <title>Sqush Diagnostics</title>
</svelte:head>

<main>
  <header>
    <p class="eyebrow">Runtime diagnostics</p>
    <h1>Sqush SvelteKit app</h1>
    <p>
      This page checks whether existing local-first Sqush helpers can be
      consumed from the root SvelteKit app. The user-facing compressor lives at
      <a href={resolve('/')}>the home page</a>.
    </p>
  </header>

  <section class="summary" aria-label="Diagnostics summary">
    <div>
      <span>Total jobs</span>
      <strong>{progress.total}</strong>
    </div>
    <div>
      <span>Ready exports</span>
      <strong>{exportSummary.ready}</strong>
    </div>
    <div>
      <span>Pending</span>
      <strong>{exportSummary.pending}</strong>
    </div>
    <div>
      <span>Saved</span>
      <strong>{exportSummary.percentChange}%</strong>
    </div>
  </section>

  <section class="workspace" aria-label="Diagnostics workspace">
    <div class="jobs">
      <h2>Imported jobs</h2>
      {#each model.session.jobs as job (job.id)}
        <button
          class:active={job.id === selectedJobId}
          type="button"
          onclick={() => (selectedJobId = job.id)}
        >
          <span>{job.sourceFile.name}</span>
          <small>{job.status}</small>
        </button>
      {/each}
    </div>

    <div class="detail">
      <h2>{selectedJob.sourceFile.name}</h2>
      <dl>
        <div>
          <dt>Status</dt>
          <dd>{selectedJob.status}</dd>
        </div>
        <div>
          <dt>Original size</dt>
          <dd>{selectedJob.originalSize} bytes</dd>
        </div>
        <div>
          <dt>Output size</dt>
          <dd>{selectedJob.output?.size ?? 'not encoded'} bytes</dd>
        </div>
      </dl>
    </div>
  </section>

  <section class="notes" aria-label="Runtime proof notes">
    <h2>What this proves</h2>
    <ul>
      {#each model.notes as note (note)}
        <li>{note}</li>
      {/each}
    </ul>
  </section>

  <section class="codec-probe" aria-label="Worker and WASM probe">
    <h2>Worker/WASM probe</h2>
    {#if codecProbe.status === 'checking'}
      <p>Checking WebP codec asset from a module worker.</p>
    {:else if codecProbe.status === 'ready'}
      <dl>
        <div>
          <dt>WASM bytes</dt>
          <dd>{codecProbe.result.wasmBytes}</dd>
        </div>
        <div>
          <dt>Magic bytes</dt>
          <dd>{codecProbe.result.wasmMagic}</dd>
        </div>
        <div>
          <dt>Asset URL</dt>
          <dd>{codecProbe.result.wasmUrl}</dd>
        </div>
      </dl>
    {:else}
      <p class="error">{codecProbe.message}</p>
    {/if}
  </section>

  <section class="codec-probe" aria-label="WebP encode probe">
    <h2>WebP encode probe</h2>
    {#if encodeProbe.status === 'checking'}
      <p>
        Encoding a synthetic 2x2 image through the existing WebP worker path.
      </p>
    {:else if encodeProbe.status === 'ready'}
      <dl>
        <div>
          <dt>Output bytes</dt>
          <dd>{encodeProbe.result.outputBytes}</dd>
        </div>
        <div>
          <dt>RIFF header</dt>
          <dd>{encodeProbe.result.riffHeader}</dd>
        </div>
        <div>
          <dt>Magic bytes</dt>
          <dd>{encodeProbe.result.magicBytes}</dd>
        </div>
      </dl>
    {:else}
      <p class="error">{encodeProbe.message}</p>
    {/if}
  </section>

  <section class="codec-probe" aria-label="WebP single-image pipeline probe">
    <h2>WebP pipeline probe</h2>
    {#if pipelineProbe.status === 'checking'}
      <p>Running local decode, resize, WebP encode, and export metadata.</p>
    {:else if pipelineProbe.status === 'ready'}
      <dl>
        <div>
          <dt>Source</dt>
          <dd>
            {pipelineProbe.result.sourceFileName}
            ({pipelineProbe.result.detectedSourceMimeType},
            {pipelineProbe.result.sourceBytes} bytes)
          </dd>
        </div>
        <div>
          <dt>Decoded</dt>
          <dd>
            {pipelineProbe.result.decodedWidth} x
            {pipelineProbe.result.decodedHeight}
          </dd>
        </div>
        <div>
          <dt>Processed</dt>
          <dd>
            {pipelineProbe.result.processedWidth} x
            {pipelineProbe.result.processedHeight}
          </dd>
        </div>
        <div>
          <dt>Output</dt>
          <dd>
            {pipelineProbe.result.outputFileName}
            ({pipelineProbe.result.outputMimeType},
            {pipelineProbe.result.outputBytes} bytes)
          </dd>
        </div>
        <div>
          <dt>Change</dt>
          <dd>{pipelineProbe.result.percentChange}%</dd>
        </div>
        <div>
          <dt>Header</dt>
          <dd>
            {pipelineProbe.result.riffHeader}/{pipelineProbe.result
              .webpSignature}
          </dd>
        </div>
      </dl>
      <ul class="probe-stages">
        {#each pipelineProbe.result.stages as stage (stage)}
          <li>{stage}</li>
        {/each}
      </ul>
    {:else}
      <p class="error">{pipelineProbe.message}</p>
    {/if}
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #f6f4ef;
    color: #171717;
    font-family:
      Inter,
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
  }

  main {
    max-width: 1120px;
    margin: 0 auto;
    padding: 48px 24px;
  }

  header {
    max-width: 760px;
    margin-bottom: 32px;
  }

  .eyebrow {
    margin: 0 0 8px;
    color: #0f766e;
    font-size: 0.8rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  h1,
  h2,
  p {
    margin-top: 0;
  }

  h1 {
    margin-bottom: 12px;
    font-size: clamp(2rem, 5vw, 4.5rem);
    line-height: 1;
  }

  h2 {
    font-size: 1rem;
  }

  .summary {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 12px;
    margin-bottom: 24px;
  }

  .summary div,
  .jobs,
  .detail,
  .notes,
  .codec-probe {
    border: 1px solid #d8d1c4;
    border-radius: 8px;
    background: #fffdfa;
  }

  .summary div {
    padding: 16px;
  }

  .summary span {
    display: block;
    margin-bottom: 8px;
    color: #666055;
    font-size: 0.85rem;
  }

  .summary strong {
    font-size: 1.7rem;
  }

  .workspace {
    display: grid;
    grid-template-columns: 320px 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }

  .jobs,
  .detail,
  .notes,
  .codec-probe {
    padding: 18px;
  }

  button {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
    padding: 12px;
    border: 1px solid #ded7cb;
    border-radius: 6px;
    background: #fff;
    color: inherit;
    font: inherit;
    text-align: left;
  }

  button.active {
    border-color: #0f766e;
    background: #ecfdf5;
  }

  small,
  dt {
    color: #666055;
  }

  dl {
    display: grid;
    gap: 12px;
    margin: 0;
  }

  dl div {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    border-bottom: 1px solid #eee8dc;
    padding-bottom: 10px;
  }

  dd {
    margin: 0;
    font-weight: 700;
  }

  .notes ul {
    margin-bottom: 0;
    padding-left: 20px;
  }

  .probe-stages {
    margin: 16px 0 0;
    padding-left: 20px;
    color: #3f3a33;
  }

  .codec-probe {
    margin-top: 16px;
  }

  .codec-probe dd {
    overflow-wrap: anywhere;
    text-align: right;
  }

  .error {
    color: #b91c1c;
    font-weight: 700;
  }

  @media (max-width: 760px) {
    .summary,
    .workspace {
      grid-template-columns: 1fr;
    }
  }
</style>
