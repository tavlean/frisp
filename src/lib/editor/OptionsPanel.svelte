<script lang="ts">
  // One configurable comparison side, ported from
  // src/client/lazy-app/Compress/Options/index.tsx. Order matches Squoosh:
  // an "Edit" section (resize / reduce-palette, hidden for the Original side)
  // above a "Compress" section (encoder picker + that encoder's options), with
  // the download/result bubble pinned at the bottom.
  import { reveal } from './motion';
  import Select from './options/Select.svelte';
  import Toggle from './options/Toggle.svelte';
  import Range from './options/Range.svelte';
  import OptionRow from './options/OptionRow.svelte';
  import ToggleRow from './options/ToggleRow.svelte';
  import WebpOptions from './options/WebpOptions.svelte';
  import AvifOptions from './options/AvifOptions.svelte';
  import JxlOptions from './options/JxlOptions.svelte';
  import MozjpegOptions from './options/MozjpegOptions.svelte';
  import JpegliOptions from './options/JpegliOptions.svelte';
  import OxipngOptions from './options/OxipngOptions.svelte';
  import SvgOptions from './options/SvgOptions.svelte';
  import ResizeOptions from './options/ResizeOptions.svelte';
  import GrainOptions from './options/GrainOptions.svelte';
  import QuantizeOptions from './options/QuantizeOptions.svelte';
  import Results from './Results.svelte';
  import {
    OUTPUT_FORMATS,
    type SideFormat,
    type CompressOutcome,
  } from '$lib/compress';
  import type {
    ResizeOptionsState,
    GrainOptionsState,
    QuantizeOptionsState,
  } from './options/processor-types';
  import type { ProcessorState } from 'client/lazy-app/feature-meta';
  import type { EncodeOptions as WebpEncodeOptions } from 'features/encoders/webP/shared/meta';
  import type { EncodeOptions as AvifEncodeOptions } from 'features/encoders/avif/shared/meta';
  import type { EncodeOptions as JxlEncodeOptions } from 'features/encoders/jxl/shared/meta';
  import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
  import type { EncodeOptions as JpegliEncodeOptions } from 'features/encoders/jpegli/shared/meta';
  import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';
  import type { SvgOptimizeOptions } from '$lib/svg/optimize-options';
  import type { AutoQualityControl } from './auto-quality';

  interface Props {
    side: 'left' | 'right';
    format: SideFormat;
    /** Encoder choices to list (already filtered to those the browser supports). */
    formats?: { id: string; label: string; tooltip?: string; ext: string }[];
    /** The current format's option object (live $state proxy from the parent). */
    options: Record<string, unknown>;
    processorState: ProcessorState;
    naturalWidth: number;
    naturalHeight: number;
    /** True when the source is a vector (SVG) — enables the Vector resize method. */
    isVector?: boolean;
    /** The loaded file's MIME type, for the JPEG-only JXL transcode toggle.
     *  Left empty by the bulk and lab hosts, which have no transcode lane. */
    sourceType?: string;
    /** True when a pixel-changing step on this side rules the transcode out. */
    transcodeBlocked?: boolean;
    result: CompressOutcome | null;
    /** Shows the Save spinner (delayed, so quick passes never flash it). */
    working: boolean;
    /** Whether `result` matches the current recipe; gates Save and Share. */
    exportable: boolean;
    downloadName: string;
    onFormatChange: (format: SideFormat) => void;
    onCloseCompare?: () => void;
    /** The side's Auto quality action; hosts without one (bulk, labs) omit it. */
    autoQuality?: AutoQualityControl;
  }

  let {
    side,
    format,
    formats = OUTPUT_FORMATS,
    options,
    processorState,
    naturalWidth,
    naturalHeight,
    isVector = false,
    sourceType = '',
    transcodeBlocked = false,
    result,
    working,
    exportable,
    downloadName,
    onFormatChange,
    onCloseCompare,
    autoQuality,
  }: Props = $props();

  const isOriginal = $derived(format === 'identity');
  const typeLabel = $derived(formats.find((f) => f.id === format)?.label ?? '');
  // Encoder/engine for the active format, shown as the picker's hover tooltip.
  const formatTooltip = $derived(formats.find((f) => f.id === format)?.tooltip);
</script>

<div class={['options-scroller', { 'original-image': isOriginal }]}>
  {#if !isOriginal && format !== 'svg'}
    <div transition:reveal>
      <h3 class="options-title">
        <div class="title-and-buttons">
          Edit
          {#if onCloseCompare}
            <button
              type="button"
              class="title-button close-compare-button"
              title="Close comparison — back to image info"
              aria-label="Close comparison — back to image info"
              onclick={onCloseCompare}
            >
              ✕
            </button>
          {/if}
        </div>
      </h3>

      <ToggleRow class="section-enabler" label="Resize">
        <Toggle bind:checked={processorState.resize.enabled} />
      </ToggleRow>
      {#if processorState.resize.enabled}
        <div transition:reveal>
          <ResizeOptions
            options={processorState.resize as unknown as ResizeOptionsState}
            inputWidth={naturalWidth}
            inputHeight={naturalHeight}
            {isVector}
          />
        </div>
      {/if}

      <!-- Panel order mirrors pipeline order: resize → grain → reduce palette. -->
      <ToggleRow class="section-enabler" label="Film grain">
        <Toggle bind:checked={processorState.grain.enabled} />
      </ToggleRow>
      {#if processorState.grain.enabled}
        <div transition:reveal>
          <GrainOptions
            options={processorState.grain as unknown as GrainOptionsState}
          />
        </div>
      {/if}

      <ToggleRow class="section-enabler" label="Reduce palette">
        <Toggle bind:checked={processorState.quantize.enabled} />
      </ToggleRow>
      {#if processorState.quantize.enabled}
        <div transition:reveal>
          <QuantizeOptions
            options={processorState.quantize as unknown as QuantizeOptionsState}
          />
        </div>
      {/if}
    </div>
  {/if}

  <h3 class="options-title">Compress</h3>
  <section class="option-one-cell options-section">
    <Select
      large
      value={format}
      title={formatTooltip}
      onchange={(v) => onFormatChange(v as SideFormat)}
    >
      <option value="identity">Original Image</option>
      {#each formats as option (option.id)}
        <option value={option.id} title={option.tooltip}>{option.label}</option>
      {/each}
    </Select>
  </section>

  {#if !isOriginal}
    <div class="options-section" transition:reveal>
      <!-- Re-key on the options object identity so a panel that seeds its UI
           state once (AVIF/JXL etc.) remounts and re-derives when copy/import
           replaces the options object. In-place edits keep the same identity,
           so this does not disrupt normal slider dragging. -->
      {#key options}
        {#if format === 'svg'}
          <SvgOptions
            options={options as unknown as SvgOptimizeOptions}
            winner={result?.svg?.winner}
          />
        {:else if format === 'webP'}
          <WebpOptions
            options={options as unknown as WebpEncodeOptions}
            {autoQuality}
          />
        {:else if format === 'avif'}
          <AvifOptions
            options={options as unknown as AvifEncodeOptions}
            {autoQuality}
          />
        {:else if format === 'jxl'}
          <JxlOptions
            options={options as unknown as JxlEncodeOptions}
            {sourceType}
            {transcodeBlocked}
            {autoQuality}
          />
        {:else if format === 'mozJPEG'}
          <MozjpegOptions
            options={options as unknown as MozjpegEncodeOptions}
          />
        {:else if format === 'jpegli'}
          <JpegliOptions
            options={options as unknown as JpegliEncodeOptions}
            {autoQuality}
          />
        {:else if format === 'oxiPNG'}
          <OxipngOptions options={options as unknown as OxipngEncodeOptions} />
        {:else if typeof options.quality === 'number'}
          <OptionRow>
            <Range
              min={0}
              max={100}
              value={Number(options.quality)}
              oninput={(v) => (options.quality = v)}>Quality:</Range
            >
          </OptionRow>
        {:else}
          <p class="no-opts">{typeLabel} has no adjustable options.</p>
        {/if}
      {/key}
    </div>
  {/if}
</div>

<div class="options-results">
  <Results
    {side}
    {isOriginal}
    {typeLabel}
    size={result ? result.outputSize : null}
    percent={result ? result.percentChange : null}
    svg={result?.svg}
    downloadHref={result?.outputUrl ?? '#'}
    {downloadName}
    shareFile={result?.outputFile ?? null}
    loading={working}
    disabled={!exportable}
  />
</div>

<style>
  .options-scroller {
    border-radius: var(--scroller-radius) var(--scroller-radius) 0 0;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: transparent;
    flex: 0 1 auto;
    min-height: 0;
    /* Don't flush the very first header against the card's top edge. */
    padding-top: 4px;
  }

  /* Section headers: quiet uppercase labels with a per-side accent tick,
     sticky over the scrolling rows (opaque-ish so rows fade beneath). */
  .options-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 10px var(--horizontal-padding) 8px;
    font-weight: 700;
    font-size: 1.05rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-2);
    background: linear-gradient(
      var(--surface-solid) 75%,
      color-mix(in srgb, var(--surface-solid) 65%, transparent)
    );
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .options-title::before {
    content: '';
    flex: none;
    width: 14px;
    height: 3px;
    border-radius: 2px;
    background: linear-gradient(
      90deg,
      var(--main-theme-color),
      var(--hot-theme-color)
    );
    box-shadow: 0 0 8px var(--main-theme-glow, transparent);
  }
  .original-image .options-title::before {
    background: var(--text-3);
    box-shadow: none;
  }

  .title-and-buttons {
    flex: 1;
    display: grid;
    grid-template-columns: 1fr;
    grid-auto-columns: max-content;
    grid-auto-flow: column;
    align-items: center;
    gap: 0.9rem;
  }

  .title-button {
    background: none;
    border: none;
    margin: 0;
    padding: 0;
    cursor: pointer;
    color: var(--text-3);
    transition:
      color 150ms ease,
      transform 150ms ease;
  }
  .title-button:hover {
    color: var(--text-1);
    transform: scale(1.08);
  }
  .close-compare-button {
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
  }
  .title-button:focus-visible {
    outline: var(--main-theme-color) solid 2px;
    outline-offset: 0.25em;
  }

  .no-opts {
    padding: 12px var(--horizontal-padding);
    color: var(--text-3);
    margin: 0;
  }

  /* Card footer: filesize + delta + download (see Results.svelte). */
  .options-results {
    flex: none;
    border-top: 1px solid var(--border);
    background: rgba(0, 0, 0, 0.18);
  }

  @media (max-width: 760px) {
    .options-scroller {
      /* Grow to fill the fixed-height mobile card (set on .options in the page)
         so both sides match height and the panel scrolls internally rather than
         letting tall content clip behind the results footer. */
      flex: 1 1 auto;
    }

    .options-title {
      padding: 8px var(--horizontal-padding) 6px;
      font-size: 0.92rem;
    }

    .title-and-buttons {
      gap: 0.6rem;
    }
  }
</style>
