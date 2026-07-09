<script lang="ts">
  // Renders the current snackbar message (see snackbar-store.svelte.ts). Mirrors
  // Squoosh's bottom-centre snack-bar with optional action buttons (e.g. Undo).
  import { fly } from 'svelte/transition';
  // Import via the same $lib specifier as the rest of the app so Vite resolves
  // a single shared module instance (a relative path here would create a second
  // copy of the store, with its own state that the editor's writes can't reach).
  import { snackbar } from '$lib/editor/snackbar-store.svelte';

  const snack = $derived(snackbar.current);
</script>

{#if snack}
  {#key snack.id}
    <div
      class="snackbar"
      role="status"
      transition:fly={{ y: 60, duration: 200 }}
    >
      <span class="message">{snack.message}</span>
      {#each snack.actions as action (action)}
        <button
          type="button"
          class="action"
          onclick={() => snackbar.act(action)}
        >
          {action}
        </button>
      {/each}
    </div>
  {/key}
{/if}

<style>
  .snackbar {
    position: absolute;
    left: 50%;
    bottom: 70px;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 90vw;
    padding: 10px 8px 10px 16px;
    border-radius: 999px;
    background: rgba(24, 24, 30, 0.88);
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #f5f5f7;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
    z-index: 30;
    font-size: 0.95rem;
  }
  .message {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .action {
    flex: none;
    background: none;
    border: none;
    color: var(--accent-1, #ff8a5e);
    font: inherit;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 6px 10px;
    border-radius: 999px;
    cursor: pointer;
    transition: background-color 150ms ease;
  }
  .action:hover {
    background: rgba(255, 255, 255, 0.08);
  }
</style>
