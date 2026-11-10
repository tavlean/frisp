<script lang="ts">
  // Ported from src/features/encoders/avif/client/index.tsx at parity.
  // The UI form-state is derived from the encoder options once, then written back
  // via apply() on every change. Lossless is inferred from quality/subsample, and
  // "effort" is the inverse of the codec's speed.
  import { untrack } from 'svelte';
  import { reveal } from '../motion';
  import {
    AVIFTune,
    defaultOptions,
    type EncodeOptions,
  } from '#features/encoders/avif/shared/meta.ts';
  import Range from './Range.svelte';
  import Checkbox from './Checkbox.svelte';
  import AdvancedSection from './AdvancedSection.svelte';
  import Select from './Select.svelte';
  import AutoQualityRow from './AutoQualityRow.svelte';
  import type { AutoQualityControl } from '../auto-quality';

  interface Props {
    options: EncodeOptions;
    /** Offers the Auto row when the host runs auto-quality searches. */
    autoQuality?: AutoQualityControl;
  }

  let { options, autoQuality }: Props = $props();

  const MAX_QUALITY = 100;
  const MAX_EFFORT = 10;

  // Seed the editable UI state from the incoming options once; the panel writes
  // changes back through apply() and never reassigns `options`.
  const o = untrack(() => $state.snapshot(options));

  let lossless = $state(
    o.quality === MAX_QUALITY &&
      (o.qualityAlpha === -1 || o.qualityAlpha === MAX_QUALITY) &&
      o.subsample === 3,
  );
  let quality = $state(
    o.quality === MAX_QUALITY ? defaultOptions.quality : o.quality,
  );
  let separateAlpha = $state(o.qualityAlpha !== -1);
  let alphaQuality = $state(o.qualityAlpha !== -1 ? o.qualityAlpha : o.quality);
  let subsample = $state(o.subsample);
  let tileRows = $state(o.tileRowsLog2);
  let tileCols = $state(o.tileColsLog2);
  let effort = $state(MAX_EFFORT - o.speed);
  let chromaDeltaQ = $state(o.chromaDeltaQ);
  let sharpness = $state(o.sharpness);
  let denoiseLevel = $state(o.denoiseLevel);
  let tune = $state(o.tune);
  let enableSharpYUV = $state(o.enableSharpYUV);

  function apply() {
    options.quality = lossless ? MAX_QUALITY : quality;
    options.qualityAlpha = lossless || !separateAlpha ? -1 : alphaQuality;
    options.subsample = lossless ? 3 : subsample;
    options.tileColsLog2 = tileCols;
    options.tileRowsLog2 = tileRows;
    options.speed = MAX_EFFORT - effort;
    options.chromaDeltaQ = chromaDeltaQ;
    options.sharpness = sharpness;
    options.denoiseLevel = denoiseLevel;
    options.tune = tune;
    options.enableSharpYUV = enableSharpYUV;
  }
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  <label class="option-toggle">
    Lossless
    <Checkbox bind:checked={lossless} onchange={apply} />
  </label>

  {#if !lossless}
    <div class="option-one-cell" transition:reveal>
      <Range min={0} max={MAX_QUALITY - 1} bind:value={quality} oninput={apply}
        >Quality:</Range
      >
    </div>
    {#if autoQuality}
      <AutoQualityRow control={autoQuality} />
    {/if}
  {/if}

  <div class="option-one-cell">
    <Range min={0} max={MAX_EFFORT} bind:value={effort} oninput={apply}
      >Effort:</Range
    >
  </div>

  <AdvancedSection>
    {#if !lossless}
      <div>
        <label class="option-text-first">
          Subsample chroma:
          <Select
            bind:value={() => String(subsample), (v) => (subsample = Number(v))}
            onchange={apply}
          >
            <option value="0">4:0:0</option>
            <option value="1">4:2:0</option>
            <option value="2">4:2:2</option>
            <option value="3">4:4:4</option>
          </Select>
        </label>
        {#if subsample === 1}
          <label class="option-toggle" transition:reveal>
            Sharp YUV Downsampling
            <Checkbox bind:checked={enableSharpYUV} onchange={apply} />
          </label>
        {/if}
        <label class="option-toggle">
          Separate alpha quality
          <Checkbox bind:checked={separateAlpha} onchange={apply} />
        </label>
        {#if separateAlpha}
          <div class="option-one-cell" transition:reveal>
            <Range
              min={0}
              max={MAX_QUALITY - 1}
              bind:value={alphaQuality}
              oninput={apply}>Alpha quality:</Range
            >
          </div>
        {/if}
        <label class="option-toggle">
          Extra chroma compression
          <Checkbox bind:checked={chromaDeltaQ} onchange={apply} />
        </label>
        <div class="option-one-cell">
          <Range min={0} max={7} bind:value={sharpness} oninput={apply}
            >Sharpness:</Range
          >
        </div>
        <div class="option-one-cell">
          <Range min={0} max={50} bind:value={denoiseLevel} oninput={apply}
            >Noise synthesis:</Range
          >
        </div>
        <label class="option-text-first">
          Tuning:
          <Select
            bind:value={() => String(tune), (v) => (tune = Number(v))}
            onchange={apply}
          >
            <option value={String(AVIFTune.auto)}>Auto</option>
            <option value={String(AVIFTune.psnr)}>PSNR</option>
            <option value={String(AVIFTune.ssim)}>SSIM</option>
          </Select>
        </label>
      </div>
    {/if}
    <div class="option-one-cell">
      <Range min={0} max={6} bind:value={tileRows} oninput={apply}
        >Log2 of tile rows:</Range
      >
    </div>
    <div class="option-one-cell">
      <Range min={0} max={6} bind:value={tileCols} oninput={apply}
        >Log2 of tile cols:</Range
      >
    </div>
  </AdvancedSection>
</form>
