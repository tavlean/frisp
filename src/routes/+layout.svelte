<script lang="ts">
  import type { Snippet } from 'svelte';

  let { children }: { children: Snippet } = $props();
</script>

{@render children()}

<style>
  /* Self-hosted Satoshi (variable, weight 300-900; chosen 2026-07-02 via the
     bulk font comparison, replacing Outfit) — woff2 files in
     static/fonts/, served from the app origin so SvelteKit's service worker
     auto-precaches them via `files` (offline-safe, no network font fetch,
     nothing leaves the device). The italic face is loaded because the intro
     headline genuinely uses <em>; absolute `/fonts/` URLs are correct because
     no base path is configured. */
  @font-face {
    font-family: 'Satoshi';
    font-style: normal;
    font-weight: 300 900;
    font-display: swap;
    src: url(/fonts/Satoshi-Variable.woff2) format('woff2');
  }
  @font-face {
    font-family: 'Satoshi';
    font-style: italic;
    font-weight: 300 900;
    font-display: swap;
    src: url(/fonts/Satoshi-VariableItalic.woff2) format('woff2');
  }

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
      'Satoshi',
      ui-sans-serif,
      system-ui,
      -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }

  /* The one spinner rotation, referenced as plain `spin` by every component. */
  @keyframes -global-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
