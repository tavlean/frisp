<script lang="ts">
  import { onMount } from 'svelte';
  import { resolve } from '$app/paths';
  import { runCodecAssetProbe } from '#lib/codec-asset-probe.ts';
  import { createDiagnosticsModel } from '#lib/diagnostics-data.ts';
  import { runWebpEncodeProbe } from '#lib/webp-encode-probe.ts';
  import { registerServiceWorker } from '#lib/service-worker-registration.ts';
  import { APP_NAME } from '#shared/brand.ts';

  const model = createDiagnosticsModel();

  let selectedJobId = $state(model.session.selectedJobId ?? '');
  const selectedJob = $derived(
    model.session.jobs.find((job) => job.id === selectedJobId) ??
      model.session.jobs[0],
  );
  // `model` is a plain (non-reactive) const, so these are static reads — no
  // $derived needed (it would track nothing).
  const progress = model.summary.progress;
  const exportSummary = model.summary.export;

  onMount(() => {
    registerServiceWorker().catch((error: unknown) => {
      console.error('SvelteKit service-worker registration failed', error);
    });
  });

  // Each probe runs once per page visit; {#await} drops a resolution that
  // lands after the page is gone.
  const codecProbe = runCodecAssetProbe();
  const encodeProbe = runWebpEncodeProbe();
  const errorMessage = (error: unknown) =>
    error instanceof Error ? error.message : String(error);
</script>

<svelte:head>
  <title>{APP_NAME} Diagnostics</title>
</svelte:head>

<main>
  <header>
    <p class="eyebrow">Runtime diagnostics</p>
    <h1>{APP_NAME} SvelteKit app</h1>
    <p>
      This page checks whether existing local-first app helpers can be consumed
      from the root SvelteKit app. The user-facing compressor lives at
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
          class={{ active: job.id === selectedJobId }}
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
    {#await codecProbe}
      <p>Checking WebP codec asset from a module worker.</p>
    {:then result}
      <dl>
        <div>
          <dt>WASM bytes</dt>
          <dd>{result.wasmBytes}</dd>
        </div>
        <div>
          <dt>Magic bytes</dt>
          <dd>{result.wasmMagic}</dd>
        </div>
        <div>
          <dt>Asset URL</dt>
          <dd>{result.wasmUrl}</dd>
        </div>
      </dl>
    {:catch error}
      <p class="error">{errorMessage(error)}</p>
    {/await}
  </section>

  <section class="codec-probe" aria-label="WebP encode probe">
    <h2>WebP encode probe</h2>
    {#await encodeProbe}
      <p>
        Encoding a synthetic 2x2 image through the existing WebP worker path.
      </p>
    {:then result}
      <dl>
        <div>
          <dt>Output bytes</dt>
          <dd>{result.outputBytes}</dd>
        </div>
        <div>
          <dt>RIFF header</dt>
          <dd>{result.riffHeader}</dd>
        </div>
        <div>
          <dt>Magic bytes</dt>
          <dd>{result.magicBytes}</dd>
        </div>
      </dl>
    {:catch error}
      <p class="error">{errorMessage(error)}</p>
    {/await}
  </section>
</main>

<style>
  /* Body reset + font stack live in the root +layout.svelte; this page only
     owns its light background. */
  :global(body) {
    background: #f6f4ef;
    color: #171717;
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
