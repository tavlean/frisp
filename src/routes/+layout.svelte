<script lang="ts">
  import '@fontsource-variable/outfit';
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

{@render children()}

<style>
  /* Root font-size = 12px, matching Squoosh's `font: 12px/1.3` base
     (src/static-build/pages/index/base.css). Every editor dimension was ported
     from Squoosh as `rem`, so the whole UI is sized against this root; without
     it the browser default (16px) scaled every value up ~1.33×, throwing the
     typography out of balance and pushing the download blob off-panel. */
  :global(html) {
    font-size: 12px;
  }

  /* Shared body reset + font stack for every route. Each page keeps its own
     background/color, and the editor page adds its full-height sizing. */
  :global(body) {
    margin: 0;
    line-height: 1.3;
    font-family:
      'Outfit Variable',
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
</style>
