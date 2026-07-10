<script lang="ts">
  // The frisp lockup for the intro-lab variants: origami-bird mark + lowercase
  // wordmark. Uses /logo.webp (coral bird, real alpha) in BOTH modes — the
  // light-mode asset has an opaque near-white square baked in and would show
  // as a tile on the lab's warm porcelain background.
  import { asset } from '$app/paths';
  import { APP_NAME } from 'shared/brand';

  interface Props {
    /** Wordmark font size in px; the bird scales with it. */
    size?: number;
  }

  let { size = 17 }: Props = $props();
</script>

<span class="brand" style="--brand-size: {size}px">
  <img class="bird" src={asset('/logo.webp')} alt="" width="176" height="176" />
  <span class="name">{APP_NAME}</span>
</span>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: calc(var(--brand-size) * 0.5);
    line-height: 1;
  }
  .bird {
    /* Slightly taller than the text so the mark reads as the anchor. */
    width: calc(var(--brand-size) * 1.35);
    height: calc(var(--brand-size) * 1.35);
    display: block;
  }
  .name {
    font-size: var(--brand-size);
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--il-text-1);
  }
</style>
