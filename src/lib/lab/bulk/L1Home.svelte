<script lang="ts">
  // MINIMAL PLACEHOLDER — the L1 (focus-first) variant agent replaces this.
  //
  // Landing straight in the focus view. The scaffold just wires FocusView with
  // a placeholder `left` snippet (the variant will inject the real batch card +
  // global settings section here) and no `onBack` (L1 has no grid to return to).
  import FocusView from './FocusView.svelte';
  import PanelControls from './PanelControls.svelte';
  import { labBulk } from './store.svelte';

  const summary = $derived(labBulk.summary);
</script>

<FocusView onBack={null}>
  {#snippet left()}
    <section class="batch-card">
      <h2>All images</h2>
      <p class="count">{summary.totalJobs} images</p>
      <div class="global">
        <p class="global-label">Global settings</p>
        <PanelControls scope="global" />
      </div>
      <button
        type="button"
        class="save-all"
        onclick={() => labBulk.saveAllStub()}
      >
        Save all · ZIP
      </button>
      <p class="placeholder-note">
        L1 batch card — variant agent fills this in.
      </p>
    </section>
  {/snippet}
</FocusView>

<style>
  .batch-card {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--options-radius, 16px);
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(12px) saturate(1.2);
    -webkit-backdrop-filter: blur(12px) saturate(1.2);
  }

  h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
  }

  .count {
    margin: -8px 0 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.95rem;
  }

  .global-label {
    margin: 0 0 10px;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.9rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .save-all {
    padding: 11px 16px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(
      135deg,
      var(--accent-1, #ff8a5e),
      var(--accent-1-hot, #ff6a3c)
    );
    color: #16161c;
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }

  .placeholder-note {
    margin: 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.85rem;
    font-style: italic;
  }
</style>
