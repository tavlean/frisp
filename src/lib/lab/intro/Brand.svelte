<script lang="ts">
  // The Frisp lockup for the intro-lab variants: logomark badge + wordmark. The
  // mark rides currentColor (via --il-text-1), so it themes with the page —
  // graphite on light, near-white on dark — no per-mode brightness filter needed.
  import { APP_NAME } from '#shared/brand.ts';
  import Logomark from '#lib/lab/Logomark.svelte';

  interface Props {
    /** Wordmark font size in px; the mark scales with it. */
    size?: number;
  }

  let { size = 17 }: Props = $props();
</script>

<span class="brand" style="--brand-size: {size}px">
  <Logomark size={size * 1.35} />
  <span class="name">{APP_NAME}</span>
</span>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--brand-size) * 0.4);
    line-height: 1;
    /* currentColor for the mark; the wordmark reuses it too. */
    color: var(--il-text-1);
  }
  .name {
    font-size: var(--brand-size);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--il-text-1);
  }
</style>
