<script lang="ts">
  // One configurable comparison side, ported from
  // src/client/lazy-app/Compress/Options/index.tsx. Order matches Squoosh:
  // an "Edit" section (resize / reduce-palette, hidden for the Original side)
  // above a "Compress" section (encoder picker + that encoder's options), with
  // the download/result bubble pinned at the bottom.
  import { slide } from 'svelte/transition';
  import Select from './options/Select.svelte';
  import Toggle from './options/Toggle.svelte';
  import Range from './options/Range.svelte';
  import OptionRow from './options/OptionRow.svelte';
  import ToggleRow from './options/ToggleRow.svelte';
  import WebpOptions from './options/WebpOptions.svelte';
  import AvifOptions from './options/AvifOptions.svelte';
  import JxlOptions from './options/JxlOptions.svelte';
  import MozjpegOptions from './options/MozjpegOptions.svelte';
  import OxipngOptions from './options/OxipngOptions.svelte';
  import ResizeOptions from './options/ResizeOptions.svelte';
  import QuantizeOptions from './options/QuantizeOptions.svelte';
  import Results from './Results.svelte';
  import {
    OUTPUT_FORMATS,
    type SideFormat,
    type CompressOutcome,
  } from '$lib/compress';
  import type {
    ResizeOptionsState,
    QuantizeOptionsState,
  } from './options/processor-types';
  import type { ProcessorState } from 'client/lazy-app/feature-meta';
  import type { EncodeOptions as WebpEncodeOptions } from 'features/encoders/webP/shared/meta';
  import type { EncodeOptions as AvifEncodeOptions } from 'features/encoders/avif/shared/meta';
  import type { EncodeOptions as JxlEncodeOptions } from 'features/encoders/jxl/shared/meta';
  import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
  import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';

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
    result: CompressOutcome | null;
    working: boolean;
    canImport: boolean;
    downloadName: string;
    onFormatChange: (format: SideFormat) => void;
    onCopy: () => void;
    onSave: () => void;
    onImport: () => void;
    onCloseCompare?: () => void;
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
    result,
    working,
    canImport,
    downloadName,
    onFormatChange,
    onCopy,
    onSave,
    onImport,
    onCloseCompare,
  }: Props = $props();

  const isOriginal = $derived(format === 'identity');
  const typeLabel = $derived(formats.find((f) => f.id === format)?.label ?? '');
  // Encoder/engine for the active format, shown as the picker's hover tooltip.
  const formatTooltip = $derived(formats.find((f) => f.id === format)?.tooltip);
</script>

<div class="options-scroller" class:original-image={isOriginal}>
  {#if !isOriginal}
    <div transition:slide={{ duration: 300 }}>
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
          <button
            type="button"
            class="title-button copy-over-button"
            title="Copy settings to other side"
            onclick={onCopy}
          >
            <svg viewBox="0 0 18 14">
              <path
                d="M5.5 3.6v6.8L2.1 7l3.4-3.4M7 0L0 7l7 7V0zm4 0v14l7-7-7-7z"
              />
            </svg>
          </button>
          <button
            type="button"
            class="title-button save-button"
            title="Save side settings"
            onclick={onSave}
          >
            <svg viewBox="0 0 24 24">
              <g
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              >
                <path
                  d="M12.501 20.93c-.866.25-1.914-.166-2.176-1.247a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.074.26 1.49 1.296 1.252 2.158M19 22v-6m3 3l-3-3l-3 3"
                />
                <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0" />
              </g>
            </svg>
          </button>
          <button
            type="button"
            class="title-button import-button"
            class:button-opacity={!canImport}
            title="Import saved side settings"
            onclick={onImport}
            disabled={!canImport}
          >
            <svg viewBox="0 0 24 24">
              <g
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
              >
                <path
                  d="M12.52 20.924c-.87.262-1.93-.152-2.195-1.241a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37c1 .608 2.296.07 2.572-1.065c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.088.264 1.502 1.323 1.242 2.192M19 16v6m3-3l-3 3l-3-3"
                />
                <path d="M9 12a3 3 0 1 0 6 0a3 3 0 0 0-6 0" />
              </g>
            </svg>
          </button>
        </div>
      </h3>

      <ToggleRow class="section-enabler" label="Resize">
        <Toggle bind:checked={processorState.resize.enabled} />
      </ToggleRow>
      {#if processorState.resize.enabled}
        <div transition:slide={{ duration: 300 }}>
          <ResizeOptions
            options={processorState.resize as unknown as ResizeOptionsState}
            inputWidth={naturalWidth}
            inputHeight={naturalHeight}
            {isVector}
          />
        </div>
      {/if}

      <ToggleRow class="section-enabler" label="Reduce palette">
        <Toggle bind:checked={processorState.quantize.enabled} />
      </ToggleRow>
      {#if processorState.quantize.enabled}
        <div transition:slide={{ duration: 300 }}>
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
    <div class="options-section" transition:slide={{ duration: 300 }}>
      <!-- Re-key on the options object identity so a panel that seeds its UI
           state once (AVIF/JXL etc.) remounts and re-derives when copy/import
           replaces the options object. In-place edits keep the same identity,
           so this does not disrupt normal slider dragging. -->
      {#key options}
        {#if format === 'webP'}
          <WebpOptions options={options as unknown as WebpEncodeOptions} />
        {:else if format === 'avif'}
          <AvifOptions options={options as unknown as AvifEncodeOptions} />
        {:else if format === 'jxl'}
          <JxlOptions options={options as unknown as JxlEncodeOptions} />
        {:else if format === 'mozJPEG'}
          <MozjpegOptions
            options={options as unknown as MozjpegEncodeOptions}
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
    downloadHref={result?.outputUrl ?? '#'}
    {downloadName}
    loading={working}
    disabled={!result || working}
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
  .title-button svg {
    --size: 18px;
    display: block;
    width: var(--size);
    height: var(--size);
  }
  .close-compare-button {
    font-size: 1.1rem;
    font-weight: 700;
    line-height: 1;
  }
  .copy-over-button {
    /* Point the filled arrow towards the other side (set per-side in theme). */
    transform: rotate(var(--rotate-copyoverbutton-angle, 0deg));
  }
  .copy-over-button:hover {
    transform: rotate(var(--rotate-copyoverbutton-angle, 0deg)) scale(1.08);
  }
  .copy-over-button svg {
    fill: currentColor;
  }
  .save-button svg,
  .import-button svg {
    stroke: currentColor;
  }
  .title-button:focus-visible {
    outline: var(--main-theme-color) solid 2px;
    outline-offset: 0.25em;
  }
  .button-opacity {
    pointer-events: none;
    cursor: not-allowed;
  }
  .button-opacity svg {
    opacity: 0.4;
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

    .title-button svg {
      --size: 17px;
    }
  }
</style>
