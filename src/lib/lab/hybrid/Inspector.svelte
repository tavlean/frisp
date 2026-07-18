<script lang="ts">
  // The right inspector, parameterized by side index so ONE component serves side
  // 1 (always, in the fixed right panel) and side 0 (inside the Compare flyout,
  // `compact`). It mirrors production's OptionsPanel plumbing — the format picker,
  // the {#key options} per-encoder dispatch, the resize / reduce-palette sections,
  // the ···-menu actions, and the pinned Results footer — but arranged as the
  // hybrid's SIGNATURE: STACKED collapsible sections (Resize / Reduce palette /
  // Compress), NO Adjust/Compress tabs. Porcelain skin throughout.
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
  import FormatDropdown from './FormatDropdown.svelte';
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
    /** Compact chrome for the Compare flyout (side 0) — hides the ··· menu. */
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

  // Section expand/collapse is local UI state; a disabled section auto-collapses
  // (its body only shows while both open AND enabled).
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

<div class="hy-inspector" class:compact>
  <header class="hy-inspector-head">
    <span class="hy-side-dot" aria-hidden="true"></span>
    <span class="hy-inspector-title">Output</span>
    {#if !compact}
      <div class="hy-menu-wrap" {@attach menuDismiss}>
        <button
          type="button"
          class="hy-quiet-btn"
          class:active={menuOpen}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          aria-label="More actions"
          bind:this={menuBtn}
          onclick={() => (menuOpen = !menuOpen)}
        >
          <LabIcon svg={moreIcon} size={18} />
        </button>
        {#if menuOpen}
          <div class="hy-menu" role="menu">
            <button
              type="button"
              role="menuitem"
              class="hy-menu-item"
              onclick={() => {
                menuOpen = false;
                onCopy();
              }}>Copy settings to other side</button
            >
            <button
              type="button"
              role="menuitem"
              class="hy-menu-item"
              onclick={() => {
                menuOpen = false;
                onSave();
              }}>Save side settings</button
            >
            <button
              type="button"
              role="menuitem"
              class="hy-menu-item"
              disabled={!canImport}
              onclick={() => {
                menuOpen = false;
                onImport();
              }}>Import saved settings</button
            >
          </div>
        {/if}
      </div>
    {/if}
  </header>

  <div class="hy-inspector-scroll">
    <!-- Resize section: eye = the REAL processorState.resize.enabled. -->
    <div class="hy-section">
      <SectionHeader
        label="Resize"
        hasEnable
        enabled={resizeEnabled}
        open={resizeOpen && resizeEnabled}
        onToggleEnabled={(next) => setEnabled('resize', next)}
        onToggleOpen={() => (resizeOpen = !resizeOpen)}
      />
      {#if resizeEnabled && resizeOpen}
        <div class="hy-section-body" transition:slide={{ duration: 220 }}>
          <ResizeOptions
            options={processorState.resize as unknown as ResizeOptionsState}
            inputWidth={naturalWidth}
            inputHeight={naturalHeight}
            {isVector}
          />
        </div>
      {/if}
    </div>

    <!-- Reduce palette section: eye = the REAL processorState.quantize.enabled. -->
    <div class="hy-section">
      <SectionHeader
        label="Reduce palette"
        hasEnable
        enabled={paletteEnabled}
        open={paletteOpen && paletteEnabled}
        onToggleEnabled={(next) => setEnabled('quantize', next)}
        onToggleOpen={() => (paletteOpen = !paletteOpen)}
      />
      {#if paletteEnabled && paletteOpen}
        <div class="hy-section-body" transition:slide={{ duration: 220 }}>
          <QuantizeOptions
            options={processorState.quantize as unknown as QuantizeOptionsState}
          />
        </div>
      {/if}
    </div>

    <!-- Compress section: always-on, no eye. FormatDropdown + per-encoder
         dispatch (re-key on the options object identity so panels that seed UI
         state once remount when copy/import swaps the object). -->
    <div class="hy-section hy-section-compress">
      <div class="hy-compress-head">
        <span class="hy-compress-label">Compress</span>
      </div>
      <div class="hy-compress-body">
        <FormatDropdown value={format} {formats} onchange={onFormatChange} />
        {#if isOriginal}
          <p class="hy-original-note">Original image — no processing.</p>
        {:else}
          <div class="hy-encoder">
            {#key options}
              {#if format === 'webP'}
                <WebpOptions
                  options={options as unknown as WebpEncodeOptions}
                />
              {:else if format === 'avif'}
                <AvifOptions
                  options={options as unknown as AvifEncodeOptions}
                />
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
                <p class="hy-original-note">
                  {typeLabel} has no adjustable options.
                </p>
              {/if}
            {/key}
          </div>
        {/if}
      </div>
    </div>
  </div>

  <div class="hy-inspector-footer">
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
  .hy-inspector {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
    color: var(--pc-text-1);
  }

  .hy-inspector-head {
    flex: none;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 13px var(--horizontal-padding) 10px;
    border-bottom: 1px solid var(--pc-border);
  }

  .hy-side-dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--main-theme-color);
  }

  .hy-inspector-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--pc-text-1);
  }

  .hy-menu-wrap {
    position: relative;
    flex: none;
  }

  .hy-quiet-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--pc-text-3);
    cursor: pointer;
    padding: 0;
    transition:
      background-color 140ms ease,
      color 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .hy-quiet-btn {
      corner-shape: squircle;
      border-radius: 10px;
    }
  }
  .hy-quiet-btn:hover,
  .hy-quiet-btn.active {
    background: var(--pc-inset);
    color: var(--pc-text-1);
  }
  .hy-quiet-btn:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .hy-menu {
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 214px;
    padding: 5px;
    border-radius: 14px;
    border: 1px solid var(--pc-border);
    background: var(--pc-surface);
    box-shadow: var(--pc-shadow-popover);
  }
  @supports (corner-shape: squircle) {
    .hy-menu {
      corner-shape: squircle;
      border-radius: 16px;
    }
  }

  .hy-menu-item {
    display: block;
    width: 100%;
    min-height: 34px;
    padding: 0 10px;
    border: none;
    border-radius: 9px;
    background: none;
    color: var(--pc-text-1);
    font: inherit;
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition:
      background-color 120ms ease,
      color 120ms ease;
  }
  @supports (corner-shape: squircle) {
    .hy-menu-item {
      corner-shape: squircle;
      border-radius: 11px;
    }
  }
  .hy-menu-item:hover:not(:disabled) {
    background: var(--pc-inset);
  }
  .hy-menu-item:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .hy-menu-item:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: -2px;
  }

  .hy-inspector-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }

  .hy-section {
    border-bottom: 1px solid var(--pc-border);
  }
  .hy-section:last-child {
    border-bottom: none;
  }

  .hy-section-body {
    padding-bottom: 6px;
  }

  /* Compress section: always-on, so a plain sentence-case header (no eye/chevron)
     matching the SectionHeader label metrics. */
  .hy-compress-head {
    display: flex;
    align-items: center;
    min-height: 40px;
    padding: 8px 12px 6px;
  }
  .hy-compress-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--pc-text-1);
  }
  .hy-compress-body {
    padding: 0 var(--horizontal-padding) 10px;
  }

  .hy-encoder {
    padding-top: 4px;
  }

  .hy-original-note {
    margin: 0;
    padding: 12px 2px 6px;
    color: var(--pc-text-3);
    font-size: 13px;
  }

  .hy-inspector-footer {
    flex: none;
    border-top: 1px solid var(--pc-border);
  }

  .compact .hy-inspector-head {
    padding: 11px 12px 9px;
  }
</style>
