<script lang="ts">
  import { untrack } from 'svelte';
  import { slide } from 'svelte/transition';
  import {
    Csp,
    UVMode,
    type EncodeOptions,
  } from 'features/encoders/wp2/shared/meta';
  import Checkbox from './Checkbox.svelte';
  import Range from './Range.svelte';
  import Revealer from './Revealer.svelte';
  import Select from './Select.svelte';

  let { options }: { options: EncodeOptions } = $props();

  const initialOptions = untrack(() => $state.snapshot(options));

  let showAdvanced = $state(false);
  let lossless = $state(initialOptions.quality > 95);
  let separateAlpha = $state(
    initialOptions.quality !== initialOptions.alpha_quality,
  );

  function checked(event: Event): boolean {
    return (event.currentTarget as HTMLInputElement).checked;
  }

  function setLossless(next: boolean): void {
    lossless = next;
    options.quality = next ? 100 : Math.min(options.quality, 95);
    if (!separateAlpha) options.alpha_quality = options.quality;
  }

  function setQuality(value: number): void {
    options.quality = value;
    if (!separateAlpha) options.alpha_quality = value;
  }

  function setSeparateAlpha(next: boolean): void {
    separateAlpha = next;
    if (!next) options.alpha_quality = options.quality;
  }
</script>

<form class="options-section" onsubmit={(event) => event.preventDefault()}>
  <label class="option-toggle">
    Lossless
    <Checkbox checked={lossless} onchange={(event) => setLossless(checked(event))} />
  </label>

  {#if lossless}
    <div class="option-one-cell" transition:slide={{ duration: 300 }}>
      <Range
        min={0}
        max={5}
        step={0.1}
        value={100 - options.quality}
        oninput={(value) => {
          options.quality = 100 - value;
          if (!separateAlpha) options.alpha_quality = options.quality;
        }}>Slight loss:</Range
      >
    </div>
  {:else}
    <div transition:slide={{ duration: 300 }}>
      <div class="option-one-cell">
        <Range
          min={0}
          max={95}
          step={0.1}
          value={options.quality}
          oninput={setQuality}>Quality:</Range
        >
      </div>
      <label class="option-toggle">
        Separate alpha quality
        <Checkbox
          checked={separateAlpha}
          onchange={(event) => setSeparateAlpha(checked(event))}
        />
      </label>
      {#if separateAlpha}
        <div class="option-one-cell" transition:slide={{ duration: 300 }}>
          <Range min={0} max={100} step={1} bind:value={options.alpha_quality}
            >Alpha quality:</Range
          >
        </div>
      {/if}

      <label class="option-reveal">
        <Revealer bind:checked={showAdvanced} />
        Advanced settings
      </label>
      {#if showAdvanced}
        <div transition:slide={{ duration: 300 }}>
          <div class="option-one-cell">
            <Range min={1} max={10} bind:value={options.pass}>Passes:</Range>
          </div>
          <div class="option-one-cell">
            <Range min={0} max={100} bind:value={options.sns}
              >Spatial noise shaping:</Range
            >
          </div>
          <div class="option-one-cell">
            <Range min={0} max={100} bind:value={options.error_diffusion}
              >Error diffusion:</Range
            >
          </div>
          <label class="option-text-first">
            Subsample chroma:
            <Select bind:value={options.uv_mode}>
              <option value={UVMode.UVModeAuto}>Auto</option>
              <option value={UVMode.UVModeAdapt}>Vary</option>
              <option value={UVMode.UVMode420}>Half</option>
              <option value={UVMode.UVMode444}>Off</option>
            </Select>
          </label>
          <label class="option-text-first">
            Color space:
            <Select bind:value={options.csp_type}>
              <option value={Csp.kYCoCg}>YCoCg</option>
              <option value={Csp.kYCbCr}>YCbCr</option>
              <option value={Csp.kYIQ}>YIQ</option>
            </Select>
          </label>
          <label class="option-toggle">
            Random matrix
            <Checkbox bind:checked={options.use_random_matrix} />
          </label>
        </div>
      {/if}
    </div>
  {/if}

  <div class="option-one-cell">
    <Range min={0} max={9} bind:value={options.effort}>Effort:</Range>
  </div>
</form>
