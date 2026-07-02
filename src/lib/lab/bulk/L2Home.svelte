<script lang="ts">
  // MINIMAL PLACEHOLDER — the L2 (grid home) variant agent replaces this.
  //
  // The scaffold just lists the jobs as a plain "grid goes here" stand-in and
  // lets a click select + (in the real variant) open the shared FocusView with
  // onBack wired. Kept intentionally bare so the variant agent owns the real
  // card grid, totals bar, and grid↔focus transition.
  import { labBulk } from './store.svelte';

  const items = $derived(labBulk.stripItems);
</script>

<div class="grid-placeholder">
  <p class="note">L2 grid goes here — variant agent builds the card grid.</p>
  <ul class="rows">
    {#each items as item (item.id)}
      <li>
        <button type="button" onclick={() => labBulk.select(item.id)}>
          <span class="name">{item.fileName}</span>
          <span class="status">{item.status}</span>
        </button>
      </li>
    {/each}
  </ul>
</div>

<style>
  .grid-placeholder {
    padding: 16px;
  }

  .note {
    margin: 0 0 12px;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.9rem;
    font-style: italic;
  }

  .rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 8px;
  }

  button {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 14px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--control-radius, 10px);
    background: var(--surface, rgba(19, 19, 25, 0.82));
    color: var(--text-1, #f5f5f7);
    font: inherit;
    text-align: left;
    cursor: pointer;
    transition: border-color 150ms ease;
  }

  button:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
  }

  .status {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
</style>
