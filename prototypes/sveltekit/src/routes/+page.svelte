<script lang="ts">
  import { createPrototypeModel } from '$lib/prototype-data';

  const model = createPrototypeModel();

  let selectedJobId = $state(model.session.selectedJobId ?? '');
  const selectedJob = $derived(
    model.session.jobs.find((job) => job.id === selectedJobId) ??
      model.session.jobs[0],
  );
  const progress = $derived(model.summary.progress);
  const exportSummary = $derived(model.summary.export);
</script>

<svelte:head>
  <title>Sqush SvelteKit Prototype</title>
</svelte:head>

<main>
  <header>
    <p class="eyebrow">Technical spike</p>
    <h1>Sqush SvelteKit prototype</h1>
    <p>
      This branch checks whether existing local-first Sqush helpers can be
      consumed from SvelteKit before any production migration starts.
    </p>
  </header>

  <section class="summary" aria-label="Prototype summary">
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

  <section class="workspace" aria-label="Prototype workspace">
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

  <section class="notes" aria-label="Prototype proof notes">
    <h2>What this proves</h2>
    <ul>
      {#each model.notes as note (note)}
        <li>{note}</li>
      {/each}
    </ul>
  </section>
</main>

<style>
  :global(body) {
    margin: 0;
    background: #f6f4ef;
    color: #171717;
    font-family:
      Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", sans-serif;
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
  .notes {
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
  .notes {
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

  @media (max-width: 760px) {
    .summary,
    .workspace {
      grid-template-columns: 1fr;
    }
  }
</style>
