<script lang="ts">
  // Ported from src/features/encoders/mozJPEG/client/index.tsx at parity.
  // mozJPEG stores its toggles as booleans, so the checkboxes bind directly.
  import { reveal } from '../motion';
  import {
    MozJpegColorSpace,
    type EncodeOptions,
  } from '#features/encoders/mozJPEG/shared/meta.ts';
  import Range from './Range.svelte';
  import Checkbox from './Checkbox.svelte';
  import AdvancedSection from './AdvancedSection.svelte';
  import Select from './Select.svelte';
  import OptionRow from './OptionRow.svelte';
  import ToggleRow from './ToggleRow.svelte';

  let { options }: { options: EncodeOptions } = $props();
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  <OptionRow>
    <Range min={0} max={100} bind:value={options.quality}>Quality:</Range>
  </OptionRow>

  <AdvancedSection>
    <label class="option-text-first">
      Channels:
      <Select bind:value={options.color_space}>
        <option value={MozJpegColorSpace.GRAYSCALE}>Grayscale</option>
        <option value={MozJpegColorSpace.RGB}>RGB</option>
        <option value={MozJpegColorSpace.YCbCr}>YCbCr</option>
      </Select>
    </label>

    {#if options.color_space === MozJpegColorSpace.YCbCr}
      <div transition:reveal>
        <ToggleRow label="Auto subsample chroma">
          <Checkbox bind:checked={options.auto_subsample} />
        </ToggleRow>
        {#if !options.auto_subsample}
          <OptionRow slide>
            <Range min={1} max={4} bind:value={options.chroma_subsample}
              >Subsample chroma by:</Range
            >
          </OptionRow>
        {/if}
        <ToggleRow label="Separate chroma quality">
          <Checkbox bind:checked={options.separate_chroma_quality} />
        </ToggleRow>
        {#if options.separate_chroma_quality}
          <OptionRow slide>
            <Range min={0} max={100} bind:value={options.chroma_quality}
              >Chroma quality:</Range
            >
          </OptionRow>
        {/if}
      </div>
    {/if}

    <ToggleRow label="Pointless spec compliance">
      <Checkbox bind:checked={options.baseline} />
    </ToggleRow>
    {#if !options.baseline}
      <ToggleRow label="Progressive rendering" slide>
        <Checkbox bind:checked={options.progressive} />
      </ToggleRow>
    {:else}
      <ToggleRow label="Optimize Huffman table" slide>
        <Checkbox bind:checked={options.optimize_coding} />
      </ToggleRow>
    {/if}

    <OptionRow>
      <Range min={0} max={100} bind:value={options.smoothing}>Smoothing:</Range>
    </OptionRow>

    <label class="option-text-first">
      Quantization:
      <Select bind:value={options.quant_table}>
        <option value={0}>JPEG Annex K</option>
        <option value={1}>Flat</option>
        <option value={2}>MSSIM-tuned Kodak</option>
        <option value={3}>ImageMagick</option>
        <option value={4}>PSNR-HVS-M-tuned Kodak</option>
        <option value={5}>Klein et al</option>
        <option value={6}>Watson et al</option>
        <option value={7}>Ahumada et al</option>
        <option value={8}>Peterson et al</option>
      </Select>
    </label>

    <ToggleRow label="Trellis multipass">
      <Checkbox bind:checked={options.trellis_multipass} />
    </ToggleRow>
    {#if options.trellis_multipass}
      <ToggleRow label="Optimize zero block runs" slide>
        <Checkbox bind:checked={options.trellis_opt_zero} />
      </ToggleRow>
    {/if}
    <ToggleRow label="Optimize after trellis quantization">
      <Checkbox bind:checked={options.trellis_opt_table} />
    </ToggleRow>
    <OptionRow>
      <Range min={1} max={50} bind:value={options.trellis_loops}
        >Trellis quantization passes:</Range
      >
    </OptionRow>
  </AdvancedSection>
</form>
