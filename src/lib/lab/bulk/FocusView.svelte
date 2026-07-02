<script lang="ts">
  import { onMount } from 'svelte';
  import Output from '$lib/editor/output/Output.svelte';
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import type { SideFormat } from '$lib/compress';
  import { labBulk } from './store.svelte';
  import BatchCard from './BatchCard.svelte';
  import FilmStrip from './FilmStrip.svelte';
  import GlobalOptionsPanel from './GlobalOptionsPanel.svelte';
  import InfoPanel from './InfoPanel.svelte';

  interface Props {
    focusSession: EditorSession;
    onBack?: (() => void) | null;
    onReseed?: (() => void) | null;
  }

  let { focusSession, onBack = null, onReseed = null }: Props = $props();

  let leftMode = $state<'batch' | 'global'>('batch');
  let isMac = $state(false);

  const file = $derived(labBulk.selectedFile);
  const thumb = $derived(labBulk.selectedThumb);
  const formats = $derived(
    focusSession.availableFormats.filter(
      (format) => (format.id as string) !== 'identity',
    ),
  );
  const undoTitle = $derived(isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)');
  const redoTitle = $derived(isMac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)');

  onMount(() => {
    isMac = /mac|iphone|ipad/i.test(
      navigator.platform || navigator.userAgent || '',
    );
  });

  function setRightFormat(format: SideFormat): void {
    if (format === 'identity') return;
    focusSession.setFormat(1, format);
  }

  function resetOverrides(): void {
    const id = labBulk.selectedId;
    if (!id) return;
    labBulk.resetAllOverrides(id);
    onReseed?.();
  }

  function onKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    const tag = target?.tagName;
    const typeable =
      !!target &&
      (tag === 'TEXTAREA' ||
        target.isContentEditable ||
        (tag === 'INPUT' &&
          !['range', 'checkbox', 'radio'].includes(
            (target as HTMLInputElement).type,
          )));

    const mod = event.metaKey || event.ctrlKey;
    if (mod && focusSession.file && !typeable) {
      const key = event.key.toLowerCase();
      const isUndo = key === 'z' && !event.shiftKey;
      const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !isMac);
      if (isUndo || isRedo) {
        event.preventDefault();
        if (isRedo) focusSession.redo();
        else focusSession.undo();
        return;
      }
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (typeable || target?.getAttribute('role') === 'slider') return;

    event.preventDefault();
    if (event.key === 'ArrowLeft') labBulk.selectPrevious();
    else labBulk.selectNext();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="compress sqush-editor">
  <Output
    leftImage={focusSession.runtime[0].result?.outputImageData}
    rightImage={focusSession.runtime[1].result?.outputImageData}
    leftWorking={focusSession.runtime[0].showSpinner}
    rightWorking={focusSession.runtime[1].showSpinner}
    leftDone={focusSession.runtime[0].status === 'done'}
    rightDone={focusSession.runtime[1].status === 'done'}
    leftActivity={focusSession.runtime[0].activity}
    rightActivity={focusSession.runtime[1].activity}
    fileId={focusSession.loadId}
    leftContain={focusSession.leftContain}
    rightContain={focusSession.rightContain}
    containWidth={focusSession.naturalWidth}
    containHeight={focusSession.naturalHeight}
    onRotate={() => focusSession.rotate()}
  />

  {#if focusSession.firstError}
    <p class="status-pill error">{focusSession.firstError}</p>
  {/if}

  {#if onBack}
    <button
      class="back"
      onclick={onBack}
      title="Back to grid"
      aria-label="Back to grid"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M15 6l-6 6 6 6"
          fill="none"
          stroke="currentColor"
          stroke-width="2.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  {/if}

  <div class="history-controls" class:no-back={!onBack}>
    <button
      class="hist"
      onclick={() => focusSession.undo()}
      disabled={!focusSession.history.canUndo}
      title={undoTitle}
      aria-label={undoTitle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H9"
          fill="none"
          stroke="currentColor"
          stroke-width="2.1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <button
      class="hist"
      onclick={() => focusSession.redo()}
      disabled={!focusSession.history.canRedo}
      title={redoTitle}
      aria-label={redoTitle}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H15"
          fill="none"
          stroke="currentColor"
          stroke-width="2.1"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
  </div>

  <aside class="options options-1">
    {#if leftMode === 'global'}
      <div class="left-stack">
        <button
          type="button"
          class="stack-link"
          onclick={() => (leftMode = 'batch')}
        >
          ← Batch
        </button>
        <GlobalOptionsPanel {focusSession} {thumb} />
      </div>
    {:else}
      <div class="left-stack">
        <BatchCard compact showGlobal onGlobal={() => (leftMode = 'global')} />
        <InfoPanel {file} width={thumb?.w ?? 0} height={thumb?.h ?? 0} />
        {#if labBulk.selectedHasOverrides}
          <div class="override-row">
            <span aria-hidden="true">●</span>
            <strong>Custom settings</strong>
            <button type="button" onclick={resetOverrides}
              >Reset to global</button
            >
          </div>
        {/if}
      </div>
    {/if}
  </aside>

  <aside class="options options-2">
    <OptionsPanel
      side="right"
      format={focusSession.sides[1].format}
      {formats}
      options={focusSession.sides[1].optionsByFormat[
        focusSession.sides[1].format
      ] ?? {}}
      processorState={focusSession.sides[1].processorState}
      naturalWidth={focusSession.naturalWidth}
      naturalHeight={focusSession.naturalHeight}
      sourceName={focusSession.file?.name}
      isVector={focusSession.isVectorSource}
      result={focusSession.runtime[1].result}
      working={focusSession.runtime[1].showSpinner}
      canImport={focusSession.canImport[1]}
      downloadName={focusSession.downloadName(1)}
      onFormatChange={setRightFormat}
      onCopy={() => focusSession.copyToOther(1)}
      onSave={() => focusSession.saveSide(1)}
      onImport={() => focusSession.importSide(1)}
    />
  </aside>

  <div class="filmstrip-dock">
    <FilmStrip />
  </div>
</div>

<style>
  .compress {
    --mobile-options-height: min(44dvh, 360px);
    --panel-width: 312px;
    --panel-inset: 14px;
    --fit-inset-left: calc(var(--panel-width) + var(--panel-inset) * 2);
    --fit-inset-right: calc(var(--panel-width) + var(--panel-inset) * 2);
    --fit-inset-top: 0px;
    --fit-inset-bottom: 0px;
    position: relative;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
    background: var(--bg-0, #0c0c0f);
  }

  .status-pill {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 7px 16px;
    border-radius: 999px;
    background: rgba(12, 12, 15, 0.82);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    color: #fff;
    z-index: 8;
    pointer-events: none;
    max-width: 70vw;
  }
  .status-pill.error {
    color: var(--bad, #ff7d92);
    border-color: color-mix(in srgb, var(--bad, #ff7d92) 35%, transparent);
    font-weight: 600;
  }

  .back {
    position: absolute;
    top: 0;
    left: 0;
    margin: 14px;
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    color: var(--text-2, #aaa);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    z-index: 10;
    transition:
      color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }
  .back:hover {
    color: var(--text-1, #fff);
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    transform: scale(1.06);
  }
  .back:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: 2px;
  }
  .back svg {
    width: 18px;
    height: 18px;
    display: block;
  }

  .history-controls {
    position: absolute;
    top: 0;
    left: 0;
    margin: 14px;
    margin-left: 64px;
    display: flex;
    gap: 8px;
    z-index: 10;
  }
  .history-controls.no-back {
    margin-left: 14px;
  }
  .hist {
    width: 40px;
    height: 40px;
    display: grid;
    place-items: center;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 50%;
    padding: 0;
    cursor: pointer;
    color: var(--text-2, #aaa);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    transition:
      color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease,
      opacity 150ms ease;
  }
  .hist:hover:not(:disabled) {
    color: var(--text-1, #fff);
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    transform: scale(1.06);
  }
  .hist:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: 2px;
  }
  .hist:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .hist svg {
    width: 18px;
    height: 18px;
    display: block;
  }

  .options {
    position: absolute;
    bottom: var(--panel-inset);
    width: var(--panel-width);
    max-height: calc(100% - 76px);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    color: var(--text-1, #fff);
    font-size: 1.2rem;
    z-index: 5;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(20px) saturate(1.3);
    -webkit-backdrop-filter: blur(20px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: var(--options-radius, 16px);
    box-shadow: var(--panel-shadow, 0 24px 48px -16px rgba(0, 0, 0, 0.55));
    overflow: hidden;
  }
  .options-1 {
    left: var(--panel-inset);
  }
  .options-2 {
    right: var(--panel-inset);
  }

  .left-stack {
    display: grid;
    gap: 12px;
    min-height: 0;
    overflow-y: auto;
    padding: 12px;
  }

  .stack-link {
    justify-self: start;
    border: none;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font: inherit;
    font-weight: 800;
    cursor: pointer;
  }

  .stack-link:hover {
    color: var(--text-1, #f5f5f7);
  }

  .override-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.95rem;
  }
  .override-row span {
    color: var(--accent-1, #ff8a5e);
  }
  .override-row strong {
    color: var(--text-1, #f5f5f7);
  }
  .override-row button {
    margin-left: auto;
    border: none;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font: inherit;
    font-weight: 700;
    cursor: pointer;
  }
  .override-row button:hover {
    color: var(--text-1, #f5f5f7);
  }

  .filmstrip-dock {
    position: absolute;
    left: var(--fit-inset-left);
    right: var(--fit-inset-right);
    bottom: 0;
    z-index: 6;
    padding: 0 12px 8px;
    box-sizing: border-box;
  }

  @media (max-width: 760px) {
    .compress {
      --panel-inset: 6px;
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
    }

    :global(.sqush-editor .output) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset));
    }

    :global(.sqush-editor .controls) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset) + 8px);
      padding: 0 56px;
      box-sizing: border-box;
    }

    .back {
      margin: 8px;
      width: 36px;
      height: 36px;
    }
    .back svg {
      width: 16px;
      height: 16px;
    }

    .history-controls {
      margin: 8px;
      margin-left: 52px;
      gap: 6px;
    }
    .history-controls.no-back {
      margin-left: 8px;
    }
    .hist {
      width: 36px;
      height: 36px;
    }
    .hist svg {
      width: 16px;
      height: 16px;
    }

    .status-pill {
      top: 8px;
      max-width: calc(100vw - 112px);
      font-size: 0.85rem;
    }

    .options {
      width: calc(50vw - var(--panel-inset) * 1.5);
      height: var(--mobile-options-height);
      max-height: var(--mobile-options-height);
      font-size: 0.95rem;
    }
    .options-1 {
      left: var(--panel-inset);
    }
    .options-2 {
      right: var(--panel-inset);
    }

    .filmstrip-dock {
      display: none;
    }
  }

  @media (max-width: 420px) {
    .compress {
      --mobile-options-height: 48dvh;
    }

    :global(.sqush-editor .controls) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset) + 6px);
      padding: 0 48px;
    }
  }
</style>
