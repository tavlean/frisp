<script lang="ts">
  import { dev } from '$app/env';
  import { onMount } from 'svelte';
  import { processSvg } from 'client/lazy-app/svg-source';
  import { autoSearch } from '$lib/svg/auto-search';
  import { DEFAULT_SVG_OPTIONS } from '$lib/svg/optimize-options';
  import { optimizeSvg } from '$lib/svg/optimizer-client';
  import { buildSvgoConfig } from '$lib/svg/svgo-config';

  type BenchError = { error: string };

  function message(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }

  async function runSafe(sourceText: string) {
    try {
      const options = DEFAULT_SVG_OPTIONS;
      const config = buildSvgoConfig({
        precision: options.precision,
        multipass: options.multipass,
        keepTitleDesc: options.keepTitleDesc,
        addons: [],
        removeDimensions: false,
      });
      return await optimizeSvg(sourceText, config, AbortSignal.timeout(10_000));
    } catch (error) {
      return { error: message(error) } satisfies BenchError;
    }
  }

  async function runAuto(sourceText: string) {
    try {
      const signal = AbortSignal.timeout(60_000);
      const image = await processSvg(
        signal,
        new Blob([sourceText], { type: 'image/svg+xml' }),
      );
      const result = await autoSearch(
        sourceText,
        { multipass: true, keepTitleDesc: true },
        image.naturalWidth,
        image.naturalHeight,
        signal,
      );
      return { svg: result.text, ...result };
    } catch (error) {
      return { error: message(error) } satisfies BenchError;
    }
  }

  onMount(() => {
    if (!dev) return;
    window.__svgBench = { runSafe, runAuto };
  });
</script>

{#if dev}
  <p>SVG benchmark pipeline ready.</p>
{:else}
  <p>Not found</p>
{/if}
