<script lang="ts">
  // The right-hand editing panel, parameterized by side index so ONE component
  // serves side 1 (always, in the fixed right column) and side 0 (inside the
  // Compare flyout, `compact`). It mirrors production's OptionsPanel plumbing —
  // the format picker, the {#key options} per-encoder dispatch, the resize /
  // reduce-palette sections, the ···-menu actions, and the pinned Results footer
  // — but re-skinned into the darkroom's chip-tab + collapsible-section language.
  import { slide } from 'svelte/transition';
  import Range from '$lib/editor/options/Range.svelte';
  import OptionRow from '$lib/editor/options/OptionRow.svelte';
  import WebpOptions from '$lib/editor/options/WebpOptions.svelte';
  import AvifOptions from '$lib/editor/options/AvifOptions.svelte';
  import JxlOptions from '$lib/editor/options/JxlOptions.svelte';
  import MozjpegOptions from '$lib/editor/options/MozjpegOptions.svelte';
  import OxipngOptions from '$lib/editor/options/OxipngOptions.svelte';
  import ResizeOptions from '$lib/editor/options/ResizeOptions.svelte';
  import QuantizeOptions from '$lib/editor/options/QuantizeOptions.svelte';
  import Results from '$lib/editor/Results.svelte';
  import SectionHeader from './SectionHeader.svelte';
  import DropdownChip from './DropdownChip.svelte';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import moreIcon from '$lib/lab/icons/more.svg?raw';
  import { lightDismiss } from '$lib/editor/light-dismiss';
  import {
    IDENTITY,
    type SideFormat,
    type CompressOutcome,
  } from '$lib/compress';
  import type {
    ResizeOptionsState,
    QuantizeOptionsState,
  } from '$lib/editor/options/processor-types';
  import type { ProcessorState } from 'client/lazy-app/feature-meta';
  import type { EncodeOptions as WebpEncodeOptions } from 'features/encoders/webP/shared/meta';
  import type { EncodeOptions as AvifEncodeOptions } from 'features/encoders/avif/shared/meta';
  import type { EncodeOptions as JxlEncodeOptions } from 'features/encoders/jxl/shared/meta';
  import type { EncodeOptions as MozjpegEncodeOptions } from 'features/encoders/mozJPEG/shared/meta';
  import type { EncodeOptions as OxipngEncodeOptions } from 'features/encoders/oxiPNG/shared/meta';

  interface FormatMeta {
    id: string;
    label: string;
    tooltip?: string;
    ext: string;
  }

  interface Props {
    /** 0 = left/compare side, 1 = right/primary side. */
    side: 0 | 1;
    format: SideFormat;
    formats: FormatMeta[];
    /** The current format's live options proxy from the session. */
    options: Record<string, unknown>;
    processorState: ProcessorState;
    naturalWidth: number;
    naturalHeight: number;
    isVector?: boolean;
    result: CompressOutcome | null;
    working: boolean;
    canImport: boolean;
    downloadName: string;
    /** Compact chrome for the Compare flyout (side 0). */
    compact?: boolean;
    onFormatChange: (format: SideFormat) => void;
    onCopy: () => void;
    onSave: () => void;
    onImport: () => void;
  }

  let {
    side,
    format,
    formats,
    options,
    processorState,
    naturalWidth,
    naturalHeight,
    isVector = false,
    result,
    working,
    canImport,
    downloadName,
    compact = false,
    onFormatChange,
    onCopy,
    onSave,
    onImport,
  }: Props = $props();

  const isOriginal = $derived(format === IDENTITY);
  const typeLabel = $derived(formats.find((f) => f.id === format)?.label ?? '');

  const formatOptions = $derived([
    { value: IDENTITY, label: 'Original Image', hint: undefined },
    ...formats.map((f) => ({ value: f.id, label: f.label, hint: f.tooltip })),
  ]);

  type Tab = 'adjust' | 'compress';
  let tab = $state<Tab>('compress');

  // Section expand/collapse is local UI state; a disabled section auto-collapses
  // (its body is only shown while both open AND enabled).
  let resizeOpen = $state(false);
  let paletteOpen = $state(false);

  const resizeEnabled = $derived(processorState.resize.enabled);
  const paletteEnabled = $derived(processorState.quantize.enabled);

  // ··· overflow menu (copy/save/import), lightDismiss-closed.
  let menuOpen = $state(false);
  let menuBtn = $state<HTMLButtonElement>();
  const menuDismiss = lightDismiss({
    isOpen: () => menuOpen,
    close: () => (menuOpen = false),
    focusOnEscape: () => menuBtn,
  });

  function setEnabled(which: 'resize' | 'quantize', next: boolean): void {
    if (which === 'resize') {
      processorState.resize.enabled = next;
      if (next) resizeOpen = true;
    } else {
      processorState.quantize.enabled = next;
      if (next) paletteOpen = true;
    }
  }
</script>

<div class="dr-inspector" class:compact>
  <!-- Header: format picker, chip tabs + ··· menu (hidden for the Original side,
       which has nothing to adjust or compress). -->
  <div class="dr-inspector-head">
    <DropdownChip
      value={format}
      options={formatOptions}
      ariaLabel="Output format"
      onchange={(v) => onFormatChange(v as SideFormat)}
    />

    {#if !isOriginal}
      <div class="dr-tabs-row">
        <div class="dr-tabs" role="tablist" aria-label="Inspector tabs">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'adjust'}
            class="dr-tab"
            class:active={tab === 'adjust'}
            onclick={() => (tab = 'adjust')}>Adjust</button
          >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'compress'}
            class="dr-tab"
            class:active={tab === 'compress'}
            onclick={() => (tab = 'compress')}>Compress</button
          >
        </div>

        <div class="dr-menu-wrap" {@attach menuDismiss}>
          <button
            type="button"
            class="dr-chip-btn dr-menu-btn"
            class:active={menuOpen}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            data-tooltip="More actions"
            aria-label="More actions"
            bind:this={menuBtn}
            onclick={() => (menuOpen = !menuOpen)}
          >
            <LabIcon svg={moreIcon} size={18} />
          </button>
          {#if menuOpen}
            <div class="dr-menu" role="menu">
              <button
                type="button"
                role="menuitem"
                class="dr-menu-item"
                onclick={() => {
                  menuOpen = false;
                  onCopy();
                }}>Copy settings to other side</button
              >
              <button
                type="button"
                role="menuitem"
                class="dr-menu-item"
                onclick={() => {
                  menuOpen = false;
                  onSave();
                }}>Save side settings</button
              >
              <button
                type="button"
                role="menuitem"
                class="dr-menu-item"
                disabled={!canImport}
                onclick={() => {
                  menuOpen = false;
                  onImport();
                }}>Import saved settings</button
              >
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>

  <div class="dr-inspector-scroll">
    {#if isOriginal}
      <p class="dr-original-note">Original image — no processing.</p>
    {:else if tab === 'adjust'}
      <div class="dr-sections">
        <div class="dr-section">
          <SectionHeader
            label="Resize"
            hasEnable
            enabled={resizeEnabled}
            open={resizeOpen && resizeEnabled}
            onToggleEnabled={(next) => setEnabled('resize', next)}
            onToggleOpen={() => (resizeOpen = !resizeOpen)}
          />
          {#if resizeEnabled && resizeOpen}
            <div class="dr-section-body" transition:slide={{ duration: 220 }}>
              <ResizeOptions
                options={processorState.resize as unknown as ResizeOptionsState}
                inputWidth={naturalWidth}
                inputHeight={naturalHeight}
                {isVector}
              />
            </div>
          {/if}
        </div>

        <div class="dr-section">
          <SectionHeader
            label="Reduce palette"
            hasEnable
            enabled={paletteEnabled}
            open={paletteOpen && paletteEnabled}
            onToggleEnabled={(next) => setEnabled('quantize', next)}
            onToggleOpen={() => (paletteOpen = !paletteOpen)}
          />
          {#if paletteEnabled && paletteOpen}
            <div class="dr-section-body" transition:slide={{ duration: 220 }}>
              <QuantizeOptions
                options={processorState.quantize as unknown as QuantizeOptionsState}
              />
            </div>
          {/if}
        </div>
      </div>
    {:else}
      <!-- COMPRESS: per-encoder options, dispatched exactly like production's
           OptionsPanel (re-key on the options object identity so panels that
           seed UI state once remount when copy/import swaps the object). -->
      <div class="dr-encoder">
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
            <p class="dr-original-note">
              {typeLabel} has no adjustable options.
            </p>
          {/if}
        {/key}
      </div>
    {/if}
  </div>

  <div class="dr-inspector-footer">
    <Results
      side={side === 0 ? 'left' : 'right'}
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
  .dr-inspector {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    color: var(--dr-text-1);
  }

  .dr-inspector-head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 12px 10px;
    border-bottom: 1px solid var(--dr-border);
  }

  .dr-tabs-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .dr-tabs {
    flex: 1;
    display: flex;
    gap: 4px;
  }

  .dr-tab {
    flex: 1;
    height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    background: none;
    color: var(--dr-text-2);
    font: inherit;
    font-size: 0.92rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }
  .dr-tab:hover {
    color: var(--dr-text-1);
    background: var(--dr-chip-hover);
  }
  .dr-tab.active {
    background: var(--dr-chip-active);
    color: var(--dr-text-1);
  }
  .dr-tab:focus-visible {
    outline: 2px solid var(--dr-focus);
    outline-offset: 2px;
  }

  .dr-menu-wrap {
    position: relative;
    flex: none;
  }

  .dr-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 210px;
    padding: 4px;
    border-radius: 10px;
    border: 1px solid var(--dr-border);
    background: var(--dr-panel);
    box-shadow: var(--dr-shadow-pop);
  }

  .dr-menu-item {
    display: block;
    width: 100%;
    min-height: 30px;
    padding: 0 10px;
    border: none;
    border-radius: 7px;
    background: none;
    color: var(--dr-text-2);
    font: inherit;
    font-size: 1rem;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }
  .dr-menu-item:hover:not(:disabled) {
    background: var(--dr-chip-hover);
    color: var(--dr-text-1);
  }
  .dr-menu-item:disabled {
    opacity: 0.4;
    cursor: default;
  }

  .dr-inspector-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .dr-sections {
    display: flex;
    flex-direction: column;
  }

  .dr-section {
    border-bottom: 1px solid var(--dr-border);
  }
  .dr-section:last-child {
    border-bottom: none;
  }

  .dr-section-body {
    padding-bottom: 6px;
  }

  .dr-encoder {
    padding: 4px 0 8px;
  }

  .dr-original-note {
    margin: 0;
    padding: 16px;
    color: var(--dr-text-3);
    font-size: 1rem;
  }

  .dr-inspector-footer {
    flex: none;
    border-top: 1px solid var(--dr-border);
  }

  .compact .dr-inspector-head {
    padding: 10px 10px 8px;
  }
</style>
