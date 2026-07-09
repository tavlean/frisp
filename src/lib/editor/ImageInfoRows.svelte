<script lang="ts">
  import { inferAspect } from './aspect';
  import { formatLabel } from './format-label';
  import { prettySize } from './pretty-size';

  interface Props {
    /** Source file — name is NOT rendered here (headers stay per-consumer). */
    file: File;
    /** Natural pixel dimensions; 0 = not decoded yet (render an em dash). */
    width: number;
    height: number;
  }

  let { file, width, height }: Props = $props();

  const hasDims = $derived(width > 0 && height > 0);
  const aspect = $derived(hasDims ? inferAspect(width, height) : null);
</script>

<dl class="rows">
  <div class="row">
    <dt>Format</dt>
    <dd>{formatLabel(file)}</dd>
  </div>
  <div class="row">
    <dt>Original size</dt>
    <dd>{prettySize(file.size)}</dd>
  </div>
  <div class="row">
    <dt>Dimensions</dt>
    <dd>{hasDims ? `${width} × ${height}` : '—'}</dd>
  </div>
  <div class="row">
    <dt>Aspect</dt>
    <dd>
      {#if aspect}
        <span class="chip" class:approx={aspect.approx}>{aspect.label}</span>
      {:else}
        —
      {/if}
    </dd>
  </div>
</dl>

<style>
  .rows {
    display: grid;
    gap: 9px;
    margin: 0;
  }

  .row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 12px;
  }

  dt {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.85rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  dd {
    margin: 0;
    color: var(--text-1, #f5f5f7);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  .chip {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
  }
  .chip.approx {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
  }
</style>
