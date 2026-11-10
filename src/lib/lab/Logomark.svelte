<script lang="ts" module>
  // The Frisp logomark (badge + image glyph) as a single currentColor SVG, for
  // the dev-only lab experiments. Both paths ride currentColor, so each header
  // themes it via its own `color` (graphite on light, white on dark) — the same
  // contract as Icon.svelte. The source is 1650×1800; it's sized by height with
  // width following the aspect ratio, so a square host box centres it undistorted.
  import mark from '#lib/brand/logomark.svg?raw';
</script>

<script lang="ts">
  interface Props {
    /** Rendered height in CSS px; width follows the mark's aspect ratio. */
    size?: number;
  }

  let { size = 22 }: Props = $props();
</script>

<span class="lab-logomark" style="--logomark-size: {size}px" aria-hidden="true">
  <!-- eslint-disable-next-line svelte/no-at-html-tags — static build-time SVG string from our own repo -->
  {@html mark}
</span>

<style>
  .lab-logomark {
    display: inline-grid;
    height: var(--logomark-size);
  }
  .lab-logomark :global(svg) {
    height: 100%;
    width: auto;
    display: block;
  }
</style>
