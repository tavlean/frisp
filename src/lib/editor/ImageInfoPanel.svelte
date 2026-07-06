<script lang="ts">
  import ImageInfoRows from './ImageInfoRows.svelte';
  import { OUTPUT_FORMATS, type OutputFormat } from '$lib/compress';
  import { lightDismiss } from './light-dismiss';

  interface Props {
    file: File;
    width: number;
    height: number;
    onCompareAs: (format: OutputFormat) => void;
  }

  let { file, width, height, onCompareAs }: Props = $props();

  let compareOpen = $state(false);
  let compareBtn = $state<HTMLButtonElement>();

  const compareLightDismiss = lightDismiss({
    isOpen: () => compareOpen,
    close: () => (compareOpen = false),
    focusOnEscape: () => compareBtn,
  });

  function chooseFormat(format: OutputFormat) {
    compareOpen = false;
    compareBtn?.focus();
    onCompareAs(format);
  }
</script>

<div class="image-info-panel">
  <div class="info-scroller">
    <div class="head">
      <p class="title filename" title={file.name}>{file.name}</p>
    </div>

    <div class="body">
      <ImageInfoRows {file} {width} {height} />

      <section class="compare-section" aria-label="Compare as">
        <div class="compare-wrap" {@attach compareLightDismiss}>
          <button
            type="button"
            class="compare-trigger"
            onclick={() => (compareOpen = !compareOpen)}
            aria-haspopup="true"
            aria-expanded={compareOpen}
            bind:this={compareBtn}
          >
            Compare as…
          </button>

          {#if compareOpen}
            <div class="compare-popover" role="group" aria-label="Compare as">
              {#each OUTPUT_FORMATS as format (format.id)}
                <button
                  type="button"
                  class="compare-option"
                  title={format.tooltip}
                  onclick={() => chooseFormat(format.id)}
                >
                  {format.label}
                </button>
              {/each}
            </div>
          {/if}
        </div>
        <p class="caption">
          Preview the image in a second format, side by side.
        </p>
      </section>
    </div>
  </div>
</div>

<style>
  .image-info-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
    color: var(--text-1, #f5f5f7);
  }

  .info-scroller {
    display: flex;
    flex-direction: column;
    min-height: 0;
    overflow-y: auto;
    border-radius: var(--scroller-radius) var(--scroller-radius) 0 0;
    padding-top: 4px;
  }

  .head {
    display: grid;
    gap: 3px;
    padding: 14px var(--horizontal-padding) 10px;
  }

  .title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text-1, #f5f5f7);
  }

  .filename {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .body {
    display: grid;
    gap: 16px;
    padding: 0 var(--horizontal-padding) 16px;
  }

  .compare-section {
    display: grid;
    gap: 7px;
    padding-top: 2px;
  }

  .compare-wrap {
    position: relative;
  }

  .compare-trigger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.07);
    color: var(--text-1, #f5f5f7);
    font: inherit;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }

  .compare-trigger:hover,
  .compare-trigger[aria-expanded='true'] {
    background: rgba(255, 255, 255, 0.11);
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
  }

  .compare-trigger:active {
    transform: translateY(1px);
  }

  .compare-trigger:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: 2px;
  }

  .compare-popover {
    /* Anchored ABOVE the trigger (like Output's view-options popover): the
       panel hugs the viewport bottom, so downward/in-flow growth would push
       past the screen edge on phones. */
    position: absolute;
    bottom: calc(100% + 8px);
    left: 0;
    right: 0;
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px;
    min-width: 196px;
    background-color: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 14px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }

  .compare-option {
    display: flex;
    align-items: center;
    width: 100%;
    height: 38px;
    padding: 0 10px;
    border: none;
    border-radius: 9px;
    background: transparent;
    color: var(--text-2, #bbb);
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    text-align: left;
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }

  .compare-option:hover {
    background: rgba(45, 45, 54, 0.92);
    color: var(--text-1, #fff);
  }

  .compare-option:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: -2px;
  }

  .caption {
    margin: 0;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    font-size: 0.88rem;
    line-height: 1.35;
  }

  @media (max-width: 760px) {
    .info-scroller {
      flex: 1 1 auto;
    }

    .head {
      padding: 12px var(--horizontal-padding) 8px;
    }

    .title {
      font-size: 0.96rem;
    }

    .body {
      gap: 14px;
      padding-bottom: 14px;
    }

    .compare-trigger {
      min-height: 38px;
      font-size: 0.92rem;
    }

    .caption {
      font-size: 0.82rem;
    }
  }
</style>
