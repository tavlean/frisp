<script lang="ts">
  // Ported from src/features/encoders/webP/client/index.tsx at parity.
  // Mutates the encoder's option object in place (a shared $state proxy from the
  // page), so changes flow back and re-trigger encoding.
  import { slide } from 'svelte/transition';
  import type { EncodeOptions } from 'features/encoders/webP/shared/meta';
  import Range from './Range.svelte';
  import Checkbox from './Checkbox.svelte';
  import Revealer from './Revealer.svelte';
  import Select from './Select.svelte';

  interface Props {
    options: EncodeOptions;
  }

  let { options }: Props = $props();

  let showAdvanced = $state(false);

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

  const checked = (event: Event) =>
    (event.currentTarget as HTMLInputElement).checked;
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  <label class="option-toggle">
    Lossless
    <Checkbox
      checked={!!options.lossless}
      onchange={(e) => (options.lossless = checked(e) ? 1 : 0)}
    />
  </label>

  {#if options.lossless}
    <div class="option-one-cell">
      <Range
        min={0}
        max={9}
        value={determineLosslessQuality(options.quality, options.method)}
        oninput={setLosslessPreset}>Effort:</Range
      >
    </div>
    <div class="option-one-cell">
      <Range
        min={0}
        max={100}
        value={100 - options.near_lossless}
        oninput={(v) => (options.near_lossless = 100 - v)}>Slight loss:</Range
      >
    </div>
    <label class="option-toggle">
      Discrete tone image
      <Checkbox
        checked={options.image_hint === HINT_GRAPH}
        onchange={(e) =>
          (options.image_hint = checked(e) ? HINT_GRAPH : HINT_DEFAULT)}
      />
    </label>
  {:else}
    <div class="option-one-cell">
      <Range min={0} max={6} bind:value={options.method}>Effort:</Range>
    </div>
    <div class="option-one-cell">
      <Range min={0} max={100} step={0.1} bind:value={options.quality}
        >Quality:</Range
      >
    </div>
    <label class="option-reveal">
      <Revealer bind:checked={showAdvanced} />
      Advanced settings
    </label>
    {#if showAdvanced}
      <div transition:slide={{ duration: 300 }}>
        <label class="option-toggle">
          Compress alpha
          <Checkbox
            checked={!!options.alpha_compression}
            onchange={(e) => (options.alpha_compression = checked(e) ? 1 : 0)}
          />
        </label>
        <div class="option-one-cell">
          <Range min={0} max={100} bind:value={options.alpha_quality}
            >Alpha quality:</Range
          >
        </div>
        <div class="option-one-cell">
          <Range min={0} max={2} bind:value={options.alpha_filtering}
            >Alpha filter quality:</Range
          >
        </div>
        <label class="option-toggle">
          Auto adjust filter strength
          <Checkbox
            checked={!!options.autofilter}
            onchange={(e) => (options.autofilter = checked(e) ? 1 : 0)}
          />
        </label>
        {#if !options.autofilter}
          <div class="option-one-cell" transition:slide={{ duration: 300 }}>
            <Range min={0} max={100} bind:value={options.filter_strength}
              >Filter strength:</Range
            >
          </div>
        {/if}
        <label class="option-toggle">
          Strong filter
          <Checkbox
            checked={!!options.filter_type}
            onchange={(e) => (options.filter_type = checked(e) ? 1 : 0)}
          />
        </label>
        <div class="option-one-cell">
          <Range
            min={0}
            max={7}
            value={7 - options.filter_sharpness}
            oninput={(v) => (options.filter_sharpness = 7 - v)}
            >Filter sharpness:</Range
          >
        </div>
        <label class="option-toggle">
          Sharp RGB→YUV conversion
          <Checkbox
            checked={!!options.use_sharp_yuv}
            onchange={(e) => (options.use_sharp_yuv = checked(e) ? 1 : 0)}
          />
        </label>
        <div class="option-one-cell">
          <Range min={1} max={10} bind:value={options.pass}>Passes:</Range>
        </div>
        <div class="option-one-cell">
          <Range min={0} max={100} bind:value={options.sns_strength}
            >Spatial noise shaping:</Range
          >
        </div>
        <label class="option-text-first">
          Preprocess:
          <Select
            value={String(options.preprocessing)}
            onchange={(e) =>
              (options.preprocessing = Number(
                (e.currentTarget as HTMLSelectElement).value,
              ))}
          >
            <option value="0">None</option>
            <option value="1">Segment smooth</option>
            <option value="2">Pseudo-random dithering</option>
          </Select>
        </label>
        <div class="option-one-cell">
          <Range min={1} max={4} bind:value={options.segments}>Segments:</Range>
        </div>
        <div class="option-one-cell">
          <Range min={0} max={3} bind:value={options.partitions}
            >Partitions:</Range
          >
        </div>
      </div>
    {/if}
  {/if}

  <label class="option-toggle">
    Preserve transparent data
    <Checkbox
      checked={!!options.exact}
      onchange={(e) => (options.exact = checked(e) ? 1 : 0)}
    />
  </label>
</form>
