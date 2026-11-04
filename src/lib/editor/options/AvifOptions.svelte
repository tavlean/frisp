<script lang="ts">
  // Ported from src/features/encoders/avif/client/index.tsx at parity.
  // The UI form-state is derived from the encoder options once, then written back
  // via apply() on every change. Lossless is inferred from quality/subsample, and
  // "effort" is the inverse of the codec's speed.
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import {
    AVIFTune,
    defaultOptions,
    type EncodeOptions,
  } from 'features/encoders/avif/shared/meta';
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
    <Checkbox
      checked={lossless}
      onchange={(value) => {
        lossless = value;
        apply();
      }}
    />
  </label>

  {#if !lossless}
    <div class="option-one-cell" transition:slide={{ duration: 300 }}>
      <Range
        min={0}
        max={MAX_QUALITY - 1}
        value={quality}
        oninput={(v) => {
          quality = v;
          apply();
        }}>Quality:</Range
      >
    </div>
    {#if autoQuality}
      <AutoQualityRow control={autoQuality} />
    {/if}
  {/if}

  <div class="option-one-cell">
    <Range
      min={0}
      max={MAX_EFFORT}
      value={effort}
      oninput={(v) => {
        effort = v;
        apply();
      }}>Effort:</Range
    >
  </div>

  <AdvancedSection>
    {#if !lossless}
      <div>
        <label class="option-text-first">
          Subsample chroma:
          <Select
            value={String(subsample)}
            onchange={(v) => {
              subsample = Number(v);
              apply();
            }}
          >
            <option value="0">4:0:0</option>
            <option value="1">4:2:0</option>
            <option value="2">4:2:2</option>
            <option value="3">4:4:4</option>
          </Select>
        </label>
        {#if subsample === 1}
          <label class="option-toggle" transition:slide={{ duration: 300 }}>
            Sharp YUV Downsampling
            <Checkbox
              checked={enableSharpYUV}
              onchange={(value) => {
                enableSharpYUV = value;
                apply();
              }}
            />
          </label>
        {/if}
        <label class="option-toggle">
          Separate alpha quality
          <Checkbox
            checked={separateAlpha}
            onchange={(value) => {
              separateAlpha = value;
              apply();
            }}
          />
        </label>
        {#if separateAlpha}
          <div class="option-one-cell" transition:slide={{ duration: 300 }}>
            <Range
              min={0}
              max={MAX_QUALITY - 1}
              value={alphaQuality}
              oninput={(v) => {
                alphaQuality = v;
                apply();
              }}>Alpha quality:</Range
            >
          </div>
        {/if}
        <label class="option-toggle">
          Extra chroma compression
          <Checkbox
            checked={chromaDeltaQ}
            onchange={(value) => {
              chromaDeltaQ = value;
              apply();
            }}
          />
        </label>
        <div class="option-one-cell">
          <Range
            min={0}
            max={7}
            value={sharpness}
            oninput={(v) => {
              sharpness = v;
              apply();
            }}>Sharpness:</Range
          >
        </div>
        <div class="option-one-cell">
          <Range
            min={0}
            max={50}
            value={denoiseLevel}
            oninput={(v) => {
              denoiseLevel = v;
              apply();
            }}>Noise synthesis:</Range
          >
        </div>
        <label class="option-text-first">
          Tuning:
          <Select
            value={String(tune)}
            onchange={(v) => {
              tune = Number(v);
              apply();
            }}
          >
            <option value={String(AVIFTune.auto)}>Auto</option>
            <option value={String(AVIFTune.psnr)}>PSNR</option>
            <option value={String(AVIFTune.ssim)}>SSIM</option>
          </Select>
        </label>
      </div>
    {/if}
    <div class="option-one-cell">
      <Range
        min={0}
        max={6}
        value={tileRows}
        oninput={(v) => {
          tileRows = v;
          apply();
        }}>Log2 of tile rows:</Range
      >
    </div>
    <div class="option-one-cell">
      <Range
        min={0}
        max={6}
        value={tileCols}
        oninput={(v) => {
          tileCols = v;
          apply();
        }}>Log2 of tile cols:</Range
      >
    </div>
  </AdvancedSection>
</form>
