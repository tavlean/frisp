<script lang="ts">
  import { labBulk } from './store.svelte';

  interface Props {
    compact?: boolean;
    showGlobal?: boolean;
    onGlobal?: () => void;
  }

  let { compact = false, showGlobal = false, onGlobal }: Props = $props();

  const summary = $derived(labBulk.summary);
  const output = $derived(summary.output);
  const progress = $derived(summary.progress);
  const busy = $derived(progress.active + progress.queued > 0);

  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];

  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }

  const delta = $derived.by(() => {
    if (output.optimized === 0) return null;
    const rounded = Math.round(output.percentChange);
    if (rounded < 0) return { text: `▼${Math.abs(rounded)}%`, up: false };
    if (rounded > 0) return { text: `▲${rounded}%`, up: true };
    return { text: '0%', up: false };
  });
</script>

<section class="batch-card" class:compact aria-label="Batch">
  <div class="totals">
    <strong>
      {summary.totalJobs}
      {summary.totalJobs === 1 ? 'image' : 'images'}
    </strong>
    <span class="sizes">
      {prettySize(output.totalOriginalSize)}
      <span class="arrow" aria-hidden="true">→</span>
      {#if output.optimized > 0}
        {prettySize(output.totalOutputSize)}
      {:else}
        …
      {/if}
    </span>
    {#if delta}
      <span class="pill" class:up={delta.up} class:down={!delta.up}>
        {delta.text}
      </span>
    {/if}
  </div>

  {#if busy}
    <div class="progress" aria-label="Batch progress">
      <span>
        Encoding {progress.completed} of {progress.total}
      </span>
      <span class="bar">
        <span
          style:width={`${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`}
        ></span>
      </span>
    </div>
  {:else if progress.failed > 0}
    <p class="failed">{progress.failed} failed</p>
  {/if}

  <div class="actions">
    <button
      type="button"
      class="save-all"
      onclick={() => labBulk.saveAllStub()}
    >
      Save all · ZIP
    </button>
    {#if showGlobal}
      <button type="button" class="global-link" onclick={onGlobal}>
        Global settings
      </button>
    {/if}
  </div>
</section>

<style>
  .batch-card {
    display: grid;
    gap: 12px;
    padding: 14px 16px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--control-radius, 12px);
    background: color-mix(
      in srgb,
      var(--surface-solid, #16161c) 72%,
      transparent
    );
  }

  .batch-card.compact {
    padding: 12px 14px;
  }

  .totals {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 7px;
    color: var(--text-1, #f5f5f7);
    font-variant-numeric: tabular-nums;
  }

  strong {
    font-weight: 800;
  }

  .sizes {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-weight: 650;
  }

  .arrow {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    margin: 0 2px;
  }

  .pill {
    padding: 1px 8px;
    border-radius: 999px;
    font-weight: 800;
    font-size: 0.85rem;
    white-space: nowrap;
  }

  .pill.down {
    background: rgba(61, 220, 151, 0.14);
    color: var(--good, #3ddc97);
  }

  .pill.up {
    background: rgba(255, 176, 32, 0.14);
    color: var(--warn, #ffb020);
  }

  .progress {
    display: grid;
    gap: 6px;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.9rem;
    font-variant-numeric: tabular-nums;
  }

  .bar {
    height: 3px;
    overflow: hidden;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
  }

  .bar span {
    display: block;
    height: 100%;
    border-radius: inherit;
    background: var(--accent-1, #ff8a5e);
    transition: width 180ms ease;
  }

  .failed {
    margin: 0;
    color: var(--bad, #ff7d92);
    font-size: 0.9rem;
    font-weight: 700;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .save-all,
  .global-link {
    border: none;
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .save-all {
    padding: 9px 13px;
    border-radius: 999px;
    background: var(--accent-1, #ff8a5e);
    color: #16161c;
  }

  .global-link {
    padding: 7px 3px;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
  }

  .global-link:hover {
    color: var(--text-1, #f5f5f7);
  }
</style>
