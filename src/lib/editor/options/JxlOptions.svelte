<script lang="ts">
  // Ported from src/features/encoders/jxl/client/index.tsx at parity.
  // The UI form-state is derived from the encoder options once, then written back
  // via apply() on every change (mirrors the Preact getDerivedStateFromProps).
  import { untrack } from 'svelte';
  import { reveal } from '../motion';
  import type { EncodeOptions } from 'features/encoders/jxl/shared/meta';
  import Range from './Range.svelte';
  import Checkbox from './Checkbox.svelte';
  import AdvancedSection from './AdvancedSection.svelte';
  import AutoQualityRow from './AutoQualityRow.svelte';
  import type { AutoQualityControl } from '../auto-quality';

  interface Props {
    options: EncodeOptions;
    /** The loaded file's MIME type. The transcode toggle exists only for
     *  `image/jpeg`, because there is nothing to repack otherwise. */
    sourceType?: string;
    /** True when a pixel-changing step (rotate, resize, grain, palette) is
     *  active, which makes coefficient reuse impossible. */
    transcodeBlocked?: boolean;
    /** Offers the Auto row when the host runs auto-quality searches. It
     *  shows only for a lossy pixel encode: a transcode has no quality. */
    autoQuality?: AutoQualityControl;
  }

  let {
    options,
    sourceType = '',
    transcodeBlocked = false,
    autoQuality,
  }: Props = $props();

  // Seed the editable UI state from the incoming options once; the panel writes
  // changes back through apply() and never reassigns `options`.
  const o = untrack(() => $state.snapshot(options));

  let jpegTranscode = $state(o.jpegTranscode);
  let effort = $state(o.effort);
  let quality = $state(o.quality);
  let progressive = $state(o.progressive);
  let edgePreservingFilter = $state(o.epf === -1 ? 2 : o.epf);
  let lossless = $state(o.quality === 100);
  let slightLoss = $state(o.lossyPalette);
  let autoEdgePreservingFilter = $state(o.epf === -1);
  let decodingSpeedTier = $state(o.decodingSpeedTier);
  let photonNoiseIso = $state(o.photonNoiseIso);
  let alternativeLossy = $state(o.lossyModular);

  const canTranscode = $derived(sourceType === 'image/jpeg');
  // While the transcode is blocked the pixel encode is what actually runs, so
  // its controls have to stay reachable even with the toggle still checked.
  const transcoding = $derived(
    canTranscode && jpegTranscode && !transcodeBlocked,
  );

  function apply() {
    options.jpegTranscode = jpegTranscode;
    options.effort = effort;
    options.quality = lossless ? 100 : quality;
    options.progressive = progressive;
    options.epf = autoEdgePreservingFilter ? -1 : edgePreservingFilter;
    options.lossyPalette = lossless ? slightLoss : false;
    options.decodingSpeedTier = decodingSpeedTier;
    options.photonNoiseIso = photonNoiseIso;
    options.lossyModular = quality < 7 ? true : alternativeLossy;
  }
</script>

<form class="options-section" onsubmit={(e) => e.preventDefault()}>
  {#if canTranscode}
    <label class="option-toggle">
      Lossless transcode
      <Checkbox
        bind:checked={jpegTranscode}
        disabled={transcodeBlocked}
        onchange={apply}
      />
    </label>
    <p class="option-hint">
      {#if transcodeBlocked}
        Turn off resize, rotation, film grain and palette reduction to transcode
        losslessly.
      {:else}
        Repacks this JPEG's own data into JXL. Around 20% smaller, and exactly
        reversible.
      {/if}
    </p>
  {/if}

  {#if !transcoding}
    <label class="option-toggle">
      Lossless
      <Checkbox bind:checked={lossless} onchange={apply} />
    </label>

    {#if lossless}
      <label class="option-toggle" transition:reveal>
        Slight loss
        <Checkbox bind:checked={slightLoss} onchange={apply} />
      </label>
    {:else}
      <div class="option-one-cell" transition:reveal>
        <Range min={0} max={99} bind:value={quality} oninput={apply}
          >Quality:</Range
        >
      </div>
      {#if autoQuality}
        <AutoQualityRow control={autoQuality} />
      {/if}
    {/if}

    <div class="option-one-cell">
      <Range min={1} max={9} bind:value={effort} oninput={apply}>Effort:</Range>
    </div>

    <AdvancedSection>
      {#if !lossless}
        <label class="option-toggle">
          Alternative lossy mode
          <Checkbox
            checked={quality < 7 ? true : alternativeLossy}
            disabled={quality < 7}
            onchange={(value) => {
              alternativeLossy = value;
              apply();
            }}
          />
        </label>
        <label class="option-toggle">
          Auto edge filter
          <Checkbox bind:checked={autoEdgePreservingFilter} onchange={apply} />
        </label>
        {#if !autoEdgePreservingFilter}
          <div class="option-one-cell" transition:reveal>
            <Range
              min={0}
              max={3}
              bind:value={edgePreservingFilter}
              oninput={apply}>Edge preserving filter:</Range
            >
          </div>
        {/if}
        <div class="option-one-cell">
          <Range min={0} max={4} bind:value={decodingSpeedTier} oninput={apply}
            >Optimize for decoding speed (worse compression):</Range
          >
        </div>
        <div class="option-one-cell">
          <Range
            min={0}
            max={50000}
            step={100}
            bind:value={photonNoiseIso}
            oninput={apply}>Noise equivalent to ISO:</Range
          >
        </div>
      {/if}
      <label class="option-toggle">
        Progressive rendering
        <Checkbox bind:checked={progressive} onchange={apply} />
      </label>
    </AdvancedSection>
  {/if}
</form>

<style>
  .option-hint {
    margin: 4px var(--horizontal-padding) 10px;
    color: var(--text-3);
    font-size: 0.95rem;
    line-height: 1.4;
  }
</style>
