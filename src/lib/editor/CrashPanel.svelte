<script lang="ts">
  // Shown by the page's <svelte:boundary> blocks when the editor or bulk view
  // throws while rendering. The session lives outside the boundary, so "Try
  // again" remounts the view on the same image; if the crash comes from session
  // state it throws again at once, which is why Close is the primary action.
  interface Props {
    error: unknown;
    /** Leave the view through its history entry (never a bare clearFile). */
    onclose: () => void;
    /** The boundary's reset: recreate the crashed contents. */
    onretry: () => void;
  }
  let { error, onclose, onretry }: Props = $props();

  // SvelteKit's root mount passes every boundary error through handleError
  // first, so `error` arrives as an App.Error ({ status, message }), not the
  // thrown Error. src/hooks.client.ts keeps the real message and logs it.
  const message = $derived(
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : String(error),
  );
</script>

<div class="crash">
  <div class="panel" role="alert">
    <h2>This view hit a problem</h2>
    <p class="message">{message}</p>
    <div class="actions">
      <button type="button" class="retry" onclick={onretry}>Try again</button>
      <button type="button" class="close" onclick={onclose}>Close</button>
    </div>
  </div>
</div>

<style>
  /* Matches the always-dark editor: the --bg-0 canvas with one floating glass
     card. The fallbacks are the theme.css values, since its tokens are scoped
     to .editor-root and this panel replaces that element. */
  .crash {
    position: relative;
    width: 100vw;
    height: 100dvh;
    display: grid;
    place-items: center;
    padding: 1.6rem;
    box-sizing: border-box;
    background: var(--bg-0, #0c0c0f);
    color: var(--text-1, #f5f5f7);
  }
  .panel {
    width: min(100%, 36rem);
    padding: 2rem;
    box-sizing: border-box;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--options-radius, 16px);
    box-shadow: var(--panel-shadow, 0 24px 48px -16px rgba(0, 0, 0, 0.55));
  }
  h2 {
    margin: 0 0 0.8rem;
    font-size: 1.5rem;
    font-weight: 600;
  }
  .message {
    margin: 0 0 1.6rem;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 1.15rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.8rem;
  }
  button {
    padding: 0.7rem 1.4rem;
    border-radius: var(--control-radius, 9px);
    font: inherit;
    font-size: 1.15rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      border-color 150ms ease;
  }
  button:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: 2px;
  }
  .retry {
    background: var(--surface-raise, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.16));
    color: var(--text-1, #f5f5f7);
  }
  .retry:hover {
    background: var(--surface-raise-2, rgba(255, 255, 255, 0.09));
  }
  .close {
    background: var(--accent-1, #ff8a5e);
    border: 1px solid transparent;
    color: #1a0f0a;
  }
  .close:hover {
    background: var(--accent-1-hot, #ff6a3c);
  }
</style>
