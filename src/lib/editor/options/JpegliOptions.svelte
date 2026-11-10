<script lang="ts">
  // jpegli exposes three knobs on purpose: its tuned quantization tables are
  // the reason to pick it, so there is no advanced section full of overrides
  // like MozJPEG's. Options bind directly, the same as MozjpegOptions.
  import {
    JpegliChromaSubsample,
    type EncodeOptions,
  } from '#features/encoders/jpegli/shared/meta.ts';
  import Range from './Range.svelte';
  import Checkbox from './Checkbox.svelte';
  import AdvancedSection from './AdvancedSection.svelte';
  import Select from './Select.svelte';
  import OptionRow from './OptionRow.svelte';
  import ToggleRow from './ToggleRow.svelte';
  import AutoQualityRow from './AutoQualityRow.svelte';
  import type { AutoQualityControl } from '../auto-quality';

  interface Props {
    options: EncodeOptions;
    /** Offers the Auto row when the host runs auto-quality searches. */
    autoQuality?: AutoQualityControl;
  }

  let { options, autoQuality }: Props = $props();
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  <OptionRow>
    <Range min={0} max={100} bind:value={options.quality}>Quality:</Range>
  </OptionRow>
  {#if autoQuality}
    <AutoQualityRow control={autoQuality} />
  {/if}

  <AdvancedSection>
    <label class="option-text-first">
      Chroma subsampling:
      <Select bind:value={options.chromaSubsample}>
        <option value={JpegliChromaSubsample.AUTO}>Auto</option>
        <option value={JpegliChromaSubsample.FULL}>4:4:4</option>
        <option value={JpegliChromaSubsample.HALF}>4:2:0</option>
      </Select>
    </label>

    <ToggleRow label="Progressive rendering">
      <Checkbox bind:checked={options.progressive} />
    </ToggleRow>
  </AdvancedSection>
</form>
