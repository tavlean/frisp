<script lang="ts">
  // One comparison side's panel body for the porcelain lab. Mirrors the
  // production OptionsPanel's prop plumbing exactly (format list, the
  // `{#key options}` encoder-panel remount, the resize/quantize enable binds,
  // the Results footer) but arranges it as porcelain Edit | Compress tabs with
  // a FormatDropdown at the top. Used by BOTH sides.
  import { slide } from 'svelte/transition';
  import Toggle from '#lib/editor/options/Toggle.svelte';
  import Range from '#lib/editor/options/Range.svelte';
  import OptionRow from '#lib/editor/options/OptionRow.svelte';
  import WebpOptions from '#lib/editor/options/WebpOptions.svelte';
  import AvifOptions from '#lib/editor/options/AvifOptions.svelte';
  import JxlOptions from '#lib/editor/options/JxlOptions.svelte';
  import MozjpegOptions from '#lib/editor/options/MozjpegOptions.svelte';
  import JpegliOptions from '#lib/editor/options/JpegliOptions.svelte';
  import OxipngOptions from '#lib/editor/options/OxipngOptions.svelte';
  import ResizeOptions from '#lib/editor/options/ResizeOptions.svelte';
  import QuantizeOptions from '#lib/editor/options/QuantizeOptions.svelte';
  import Results from '#lib/editor/Results.svelte';
  import Segmented from './Segmented.svelte';
  import FormatDropdown from './FormatDropdown.svelte';
  import {
    OUTPUT_FORMATS,
    IDENTITY,
    type SideFormat,
    type CompressOutcome,
  } from '#lib/compress.ts';
  import type {
    ResizeOptionsState,
    QuantizeOptionsState,
  } from '#lib/editor/options/processor-types.ts';
  import type { ProcessorState } from '#client/lazy-app/feature-meta/index.ts';
  import type { EncodeOptions as WebpEncodeOptions } from '#features/encoders/webP/shared/meta.ts';
  import type { EncodeOptions as AvifEncodeOptions } from '#features/encoders/avif/shared/meta.ts';
  import type { EncodeOptions as JxlEncodeOptions } from '#features/encoders/jxl/shared/meta.ts';
  import type { EncodeOptions as MozjpegEncodeOptions } from '#features/encoders/mozJPEG/shared/meta.ts';
  import type { EncodeOptions as JpegliEncodeOptions } from '#features/encoders/jpegli/shared/meta.ts';
  import type { EncodeOptions as OxipngEncodeOptions } from '#features/encoders/oxiPNG/shared/meta.ts';

  interface Props {
    side: 'left' | 'right';
    format: SideFormat;
    formats?: { id: string; label: string; tooltip?: string; ext: string }[];
    /** The active format's live option $state proxy from the session. */
    options: Record<string, unknown>;
    processorState: ProcessorState;
    naturalWidth: number;
    naturalHeight: number;
    isVector?: boolean;
    result: CompressOutcome | null;
    working: boolean;
    downloadName: string;
    onFormatChange: (format: SideFormat) => void;
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
    downloadName,
    onFormatChange,
  }: Props = $props();

  const isOriginal = $derived(format === IDENTITY);
  const typeLabel = $derived(formats.find((f) => f.id === format)?.label ?? '');

  // Local, non-persisted tab state; Compress is the default working surface.
  let tab = $state<'edit' | 'compress'>('compress');
  const tabs = [
    { id: 'edit', label: 'Edit' },
    { id: 'compress', label: 'Compress' },
  ];
</script>

<div class="lab-options">
  <div class="scroll">
    <div class="format-row">
      <FormatDropdown value={format} {formats} onchange={onFormatChange} />
    </div>

    {#if isOriginal}
      <p class="original-note">Original image — no processing.</p>
    {:else}
      <div class="tabs">
        <Segmented
          options={tabs}
          value={tab}
          ariaLabel="Panel section"
          onchange={(id) => (tab = id as 'edit' | 'compress')}
        />
      </div>

      {#if tab === 'edit'}
        <div class="section" transition:slide={{ duration: 300 }}>
          <div class="enabler-row">
            <span class="enabler-label">Resize</span>
            <Toggle bind:checked={processorState.resize.enabled} />
          </div>
          {#if processorState.resize.enabled}
            <div class="reveal" transition:slide={{ duration: 300 }}>
              <ResizeOptions
                options={processorState.resize as unknown as ResizeOptionsState}
                inputWidth={naturalWidth}
                inputHeight={naturalHeight}
                {isVector}
              />
            </div>
          {/if}

          <div class="enabler-row">
            <span class="enabler-label">Reduce palette</span>
            <Toggle bind:checked={processorState.quantize.enabled} />
          </div>
          {#if processorState.quantize.enabled}
            <div class="reveal" transition:slide={{ duration: 300 }}>
              <QuantizeOptions
                options={processorState.quantize as unknown as QuantizeOptionsState}
              />
            </div>
          {/if}
        </div>
      {:else}
        <div
          class="section encoder-section"
          transition:slide={{ duration: 300 }}
        >
          <!-- Re-key on the options object identity so panels that seed UI
               state once (AVIF/JXL) remount when copy/import swaps the object.
               In-place slider edits keep identity, so dragging is undisturbed. -->
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
            {:else if format === 'jpegli'}
              <JpegliOptions
                options={options as unknown as JpegliEncodeOptions}
              />
            {:else if format === 'oxiPNG'}
              <OxipngOptions
                options={options as unknown as OxipngEncodeOptions}
              />
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
    {/if}
  </div>

  <div class="footer">
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
</div>

<style>
  .lab-options {
    display: flex;
    flex-direction: column;
    min-height: 0;
    flex: 1 1 auto;
  }

  .scroll {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 4px 0 6px;
  }

  .format-row {
    padding: 6px var(--horizontal-padding) 4px;
  }

  .tabs {
    padding: 6px var(--horizontal-padding) 4px;
  }

  .original-note {
    margin: 0;
    padding: 10px var(--horizontal-padding) 14px;
    color: var(--pc-text-3);
    font-size: 13px;
  }

  .section {
    padding-top: 2px;
  }

  .no-opts {
    margin: 0;
    padding: 12px var(--horizontal-padding);
    color: var(--pc-text-3);
    font-size: 13px;
  }

  /* Resize / Reduce-palette enabler rows: raised inset chips with a Toggle. */
  .enabler-row {
    display: grid;
    grid-template-columns: 1fr auto;
    align-items: center;
    gap: 10px;
    margin: 4px 10px;
    padding: 9px 12px;
    border-radius: 12px;
    background: var(--pc-inset);
    border: 1px solid var(--pc-border);
  }
  @supports (corner-shape: squircle) {
    .enabler-row {
      corner-shape: squircle;
      border-radius: 14px;
    }
  }

  .enabler-label {
    font-size: 13px;
    font-weight: 500;
    color: var(--pc-text-1);
  }

  .reveal {
    padding-top: 2px;
  }

  .footer {
    flex: none;
    border-top: 1px solid var(--pc-border);
  }
</style>
