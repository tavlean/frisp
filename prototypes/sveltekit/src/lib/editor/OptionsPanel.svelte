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
  import WebpOptions from './options/WebpOptions.svelte';
  import Wp2Options from './options/Wp2Options.svelte';
  import AvifOptions from './options/AvifOptions.svelte';
  import JxlOptions from './options/JxlOptions.svelte';
  import MozjpegOptions from './options/MozjpegOptions.svelte';
  import OxipngOptions from './options/OxipngOptions.svelte';
  import BrowserJpegOptions from './options/BrowserJpegOptions.svelte';
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
  import type { EncodeOptions as Wp2EncodeOptions } from 'features/encoders/wp2/shared/meta';
  import type { EncodeOptions as AvifEncodeOptions } from 'features/encoders/avif/shared/meta';
  import type { EncodeOptions as JxlEncodeOptions } from 'features/encoders/jxl/shared/meta';
  import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
  import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';

  interface Props {
    side: 'left' | 'right';
    format: SideFormat;
    /** Encoder choices to list (already filtered to those the browser supports). */
    formats?: { id: string; label: string; ext: string }[];
    /** The current format's option object (live $state proxy from the parent). */
    options: Record<string, unknown>;
    processorState: ProcessorState;
    naturalWidth: number;
    naturalHeight: number;
    /** Source filename, shown on the "Original Image (…)" option. */
    sourceName?: string;
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
  }

  let {
    side,
    format,
    formats = OUTPUT_FORMATS,
    options,
    processorState,
    naturalWidth,
    naturalHeight,
    sourceName,
    isVector = false,
    result,
    working,
    canImport,
    downloadName,
    onFormatChange,
    onCopy,
    onSave,
    onImport,
  }: Props = $props();

  const isOriginal = $derived(format === 'identity');
  const typeLabel = $derived(formats.find((f) => f.id === format)?.label ?? '');
</script>

<div class="options-scroller" class:original-image={isOriginal}>
  {#if !isOriginal}
    <div transition:slide={{ duration: 300 }}>
      <h3 class="options-title">
        <div class="title-and-buttons">
          Edit
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

      <label class="option-toggle section-enabler">
        Resize
        <Toggle bind:checked={processorState.resize.enabled} />
      </label>
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

      <label class="option-toggle section-enabler">
        Reduce palette
        <Toggle bind:checked={processorState.quantize.enabled} />
      </label>
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
      onchange={(e) =>
        onFormatChange((e.currentTarget as HTMLSelectElement).value as SideFormat)}
    >
      <option value="identity"
        >{sourceName ? `Original Image (${sourceName})` : 'Original Image'}</option
      >
      {#each formats as option (option.id)}
        <option value={option.id}>{option.label}</option>
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
      {:else if format === 'wp2'}
        <Wp2Options options={options as unknown as Wp2EncodeOptions} />
      {:else if format === 'avif'}
        <AvifOptions options={options as unknown as AvifEncodeOptions} />
      {:else if format === 'jxl'}
        <JxlOptions options={options as unknown as JxlEncodeOptions} />
      {:else if format === 'mozJPEG'}
        <MozjpegOptions options={options as unknown as MozjpegEncodeOptions} />
      {:else if format === 'oxiPNG'}
        <OxipngOptions options={options as unknown as OxipngEncodeOptions} />
      {:else if format === 'browserJPEG'}
        <BrowserJpegOptions options={options as unknown as { quality: number }} />
      {:else if typeof options.quality === 'number'}
        <div class="option-one-cell">
          <Range
            min={0}
            max={100}
            step={0.1}
            value={Number(options.quality)}
            oninput={(v) => (options.quality = v)}>Quality:</Range
          >
        </div>
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
    border-radius: var(--scroller-radius);
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: var(--off-black);
    flex: 0 1 auto;
    min-height: 0;
  }

  .options-title {
    background-color: var(--main-theme-color);
    color: var(--header-text-color);
    margin: 0;
    padding: 10px var(--horizontal-padding);
    font-weight: bold;
    font-size: 1.4rem;
    border-bottom: 1px solid var(--off-black);
    position: sticky;
    top: 0;
    z-index: 1;
  }
  .original-image .options-title {
    background-color: var(--black);
    color: var(--white);
  }

  .title-and-buttons {
    display: grid;
    grid-template-columns: 1fr;
    grid-auto-columns: max-content;
    grid-auto-flow: column;
    align-items: center;
    gap: 0.8rem;
  }

  .title-button {
    background: none;
    border: none;
    margin: 0;
    padding: 0;
    cursor: pointer;
  }
  .title-button svg {
    --size: 20px;
    display: block;
    width: var(--size);
    height: var(--size);
  }
  .copy-over-button {
    /* Point the filled arrow towards the other side (set per-side in theme). */
    transform: rotate(var(--rotate-copyoverbutton-angle, 0deg));
  }
  .copy-over-button svg {
    fill: var(--header-text-color);
  }
  .save-button svg,
  .import-button svg {
    stroke: var(--header-text-color);
  }
  .title-button:focus-visible {
    outline: var(--header-text-color) solid 2px;
    outline-offset: 0.25em;
  }
  .button-opacity {
    pointer-events: none;
    cursor: not-allowed;
  }
  .button-opacity svg {
    opacity: 0.5;
  }

  .no-opts {
    padding: 12px var(--horizontal-padding);
    color: var(--less-light-gray);
    margin: 0;
  }

  .options-results {
    /* No horizontal padding: the results span the full panel so the download
       blob hugs the outer bottom corner (its negative margins overflow the
       edge), matching the original. */
    padding: 14px 0 0;
    flex: none;
  }

  @media (max-width: 760px) {
    .options-title {
      padding: 8px 10px;
      font-size: 1rem;
    }

    .title-and-buttons {
      gap: 0.5rem;
    }

    .title-button svg {
      --size: 18px;
    }

    .options-results {
      padding-top: 8px;
    }
  }
</style>
