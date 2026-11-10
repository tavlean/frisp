<script lang="ts">
  // Ported from src/features/encoders/webP/client/index.tsx at parity.
  // Mutates the encoder's option object in place (a shared $state proxy from the
  // page), so changes flow back and re-trigger encoding.
  import type { EncodeOptions } from '#features/encoders/webP/shared/meta.ts';
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

  // WEBP_HINT_DEFAULT = 0, WEBP_HINT_GRAPH = 3 (the only hint webp acts on).
  const HINT_DEFAULT = 0;
  const HINT_GRAPH = 3;

  // From kLosslessPresets in config_enc.c — [method, quality] pairs.
  const losslessPresets: [number, number][] = [
    [0, 0],
    [1, 20],
    [2, 25],
    [3, 30],
    [3, 50],
    [4, 50],
    [4, 75],
    [4, 90],
    [5, 90],
    [6, 100],
  ];
  const losslessPresetDefault = 6;

  function determineLosslessQuality(quality: number, method: number): number {
    const index = losslessPresets.findIndex(
      ([m, q]) => m === method && q === quality,
    );
    return index !== -1 ? index : losslessPresetDefault;
  }

  function setLosslessPreset(preset: number) {
    options.method = losslessPresets[preset][0];
    options.quality = losslessPresets[preset][1];
  }

  const losslessQuality = $derived(
    determineLosslessQuality(options.quality, options.method),
  );
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  <ToggleRow label="Lossless">
    <Checkbox
      bind:checked={
        () => !!options.lossless, (v) => (options.lossless = v ? 1 : 0)
      }
    />
  </ToggleRow>

  {#if options.lossless}
    <OptionRow>
      <Range min={0} max={9} value={losslessQuality} oninput={setLosslessPreset}
        >Effort:</Range
      >
    </OptionRow>
    <OptionRow>
      <Range
        min={0}
        max={100}
        value={100 - options.near_lossless}
        oninput={(v) => (options.near_lossless = 100 - v)}>Slight loss:</Range
      >
    </OptionRow>
    <ToggleRow label="Discrete tone image">
      <Checkbox
        bind:checked={
          () => options.image_hint === HINT_GRAPH,
          (v) => (options.image_hint = v ? HINT_GRAPH : HINT_DEFAULT)
        }
      />
    </ToggleRow>
  {:else}
    <OptionRow>
      <Range min={0} max={100} bind:value={options.quality}>Quality:</Range>
    </OptionRow>
    {#if autoQuality}
      <AutoQualityRow control={autoQuality} />
    {/if}
    <OptionRow>
      <Range min={0} max={6} bind:value={options.method}>Effort:</Range>
    </OptionRow>
    <AdvancedSection>
      <ToggleRow label="Preserve transparent data">
        <Checkbox
          bind:checked={
            () => !!options.exact, (v) => (options.exact = v ? 1 : 0)
          }
        />
      </ToggleRow>
      <ToggleRow label="Compress alpha">
        <Checkbox
          bind:checked={
            () => !!options.alpha_compression,
            (v) => (options.alpha_compression = v ? 1 : 0)
          }
        />
      </ToggleRow>
      <OptionRow>
        <Range min={0} max={100} bind:value={options.alpha_quality}
          >Alpha quality:</Range
        >
      </OptionRow>
      <OptionRow>
        <Range min={0} max={2} bind:value={options.alpha_filtering}
          >Alpha filter quality:</Range
        >
      </OptionRow>
      <ToggleRow label="Auto adjust filter strength">
        <Checkbox
          bind:checked={
            () => !!options.autofilter, (v) => (options.autofilter = v ? 1 : 0)
          }
        />
      </ToggleRow>
      {#if !options.autofilter}
        <OptionRow slide>
          <Range min={0} max={100} bind:value={options.filter_strength}
            >Filter strength:</Range
          >
        </OptionRow>
      {/if}
      <ToggleRow label="Strong filter">
        <Checkbox
          bind:checked={
            () => !!options.filter_type,
            (v) => (options.filter_type = v ? 1 : 0)
          }
        />
      </ToggleRow>
      <OptionRow>
        <Range
          min={0}
          max={7}
          value={7 - options.filter_sharpness}
          oninput={(v) => (options.filter_sharpness = 7 - v)}
          >Filter sharpness:</Range
        >
      </OptionRow>
      <ToggleRow label="Sharp RGB→YUV conversion">
        <Checkbox
          bind:checked={
            () => !!options.use_sharp_yuv,
            (v) => (options.use_sharp_yuv = v ? 1 : 0)
          }
        />
      </ToggleRow>
      <OptionRow>
        <Range min={1} max={10} bind:value={options.pass}>Passes:</Range>
      </OptionRow>
      <OptionRow>
        <Range min={0} max={100} bind:value={options.sns_strength}
          >Spatial noise shaping:</Range
        >
      </OptionRow>
      <label class="option-text-first">
        Preprocess:
        <Select bind:value={options.preprocessing}>
          <option value={0}>None</option>
          <option value={1}>Segment smooth</option>
          <option value={2}>Pseudo-random dithering</option>
        </Select>
      </label>
      <OptionRow>
        <Range min={1} max={4} bind:value={options.segments}>Segments:</Range>
      </OptionRow>
      <OptionRow>
        <Range min={0} max={3} bind:value={options.partitions}
          >Partitions:</Range
        >
      </OptionRow>
    </AdvancedSection>
  {/if}

  {#if options.lossless}
    <!-- Lossless mode has no Advanced fold, so the (alpha-related) exact flag
         stays visible here; in lossy mode it lives under Advanced. -->
    <ToggleRow label="Preserve transparent data">
      <Checkbox
        bind:checked={() => !!options.exact, (v) => (options.exact = v ? 1 : 0)}
      />
    </ToggleRow>
  {/if}
</form>
