<script lang="ts">
  // Shared size-delta indicator for the whole bulk lab, so the left-panel
  // footer, filmstrip captions, grid cards and the global footer all speak
  // one visual language. Mirrors the production Results.svelte delta: a small
  // stroked arrow (down = smaller = good, up = larger) + magnitude, in a
  // rounded tinted pill. The lab keeps its own warn-amber for the "up" case
  // (the production footer uses --bad; the lab's convention is amber).

  interface Props {
    /** Signed percent change vs the original (negative = smaller = good). */
    percent: number;
    /**
     * `pill` = tinted rounded background (footers, grid cards).
     * `bare` = coloured text + arrow only, no background (filmstrip captions).
     */
    variant?: 'pill' | 'bare';
  }

  let { percent, variant = 'pill' }: Props = $props();

  const rounded = $derived(Math.round(percent));
  const direction = $derived(
    rounded < 0 ? 'down' : rounded > 0 ? 'up' : 'zero',
  );
  const magnitude = $derived(Math.abs(rounded));
</script>

<span
  class="delta {variant}"
  class:down={direction === 'down'}
  class:up={direction === 'up'}
  class:zero={direction === 'zero'}
>
  {#if direction !== 'zero'}
    <svg class="arrow" viewBox="0 0 10 10" aria-hidden="true">
      {#if direction === 'down'}
        <path
          d="M5 1v6.6M2 5.2L5 8.3l3-3.1"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {:else}
        <path
          d="M5 9V2.4M2 4.8L5 1.7l3 3.1"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      {/if}
    </svg>{magnitude}%
  {:else}
    0%
  {/if}
</span>

<style>
  .delta {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .arrow {
    flex: none;
    width: 0.72em;
    height: 0.72em;
  }

  /* Pill variant: tinted rounded background, like Results.svelte. */
  .delta.pill {
    padding: 2px 8px 2px 6px;
    border-radius: 999px;
  }
  .delta.pill.down {
    color: var(--good, #3ddc97);
    background: color-mix(in srgb, var(--good, #3ddc97) 14%, transparent);
  }
  .delta.pill.up {
    color: var(--warn, #ffb020);
    background: color-mix(in srgb, var(--warn, #ffb020) 14%, transparent);
  }
  .delta.pill.zero {
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    background: var(--surface-raise, rgba(255, 255, 255, 0.06));
  }

  /* Bare variant: coloured text only (filmstrip captions). */
  .delta.bare.down {
    color: var(--good, #3ddc97);
  }
  .delta.bare.up {
    color: var(--warn, #ffb020);
  }
  .delta.bare.zero {
    color: var(--text-3, rgba(235, 235, 245, 0.38));
  }
</style>
