<script lang="ts">
  import { onMount } from 'svelte';
  import Output from '$lib/editor/output/Output.svelte';
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import type { SideFormat } from '$lib/compress';
  import { labBulk } from './store.svelte';
  import BatchInfoPanel from './BatchInfoPanel.svelte';
  import FilmStrip from './FilmStrip.svelte';
  import GlobalOptionsPanel from './GlobalOptionsPanel.svelte';

  interface Props {
    focusSession: EditorSession;
    onBack?: (() => void) | null;
    onReseed?: (() => void) | null;
  }

  let { focusSession, onBack = null, onReseed = null }: Props = $props();

  let isMac = $state(false);

  const selectedId = $derived(labBulk.selectedId);
  const file = $derived(labBulk.selectedFile);
  const thumb = $derived(labBulk.selectedThumb);
  const imageScopeActive = $derived(
    selectedId !== undefined && labBulk.panelScope === 'image',
  );
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

  function setPanelScope(scope: 'global' | 'image'): void {
    if (scope === 'image' && !selectedId) return;
    labBulk.panelScope = scope;
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

    if (event.key === 'Escape' && !onBack && selectedId) {
      event.preventDefault();
      labBulk.deselect();
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (typeable || target?.getAttribute('role') === 'slider') return;

    event.preventDefault();
    if (event.key === 'ArrowLeft') labBulk.selectPrevious();
    else labBulk.selectNext();
  }

  function onStripPointerdown(event: PointerEvent): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('button')) return;
    labBulk.deselect();
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="compress sqush-editor">
  <div class="stage-region">
    {#if selectedId}
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
    {:else}
      <div class="blank-stage">
        <svg class="blank-icon" viewBox="0 0 48 48" aria-hidden="true">
          <rect
            x="7"
            y="11"
            width="34"
            height="26"
            rx="3.5"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          />
          <circle cx="17.5" cy="20" r="2.6" fill="currentColor" />
          <path
            d="M9 32l9-8 6 5 7-6 8 7"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <p class="blank-title">
          Global settings apply to all {labBulk.summary.totalJobs} images
        </p>
        <p class="blank-sub">Select an image below to fine-tune it</p>
      </div>
    {/if}

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

    {#if selectedId}
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
    {/if}

    <aside class="options options-1">
      <BatchInfoPanel
        {file}
        width={thumb?.w ?? 0}
        height={thumb?.h ?? 0}
        onReset={resetOverrides}
      />
    </aside>

    <aside
      class="options options-2"
      class:scope-global={!imageScopeActive}
      class:scope-image={imageScopeActive}
    >
      <div class="scope-tabs" role="tablist" aria-label="Settings scope">
        <button
          type="button"
          class="tab-global"
          role="tab"
          aria-selected={labBulk.panelScope === 'global'}
          class:active={labBulk.panelScope === 'global'}
          onclick={() => setPanelScope('global')}
        >
          Global
        </button>
        <button
          type="button"
          class="tab-image"
          role="tab"
          aria-selected={imageScopeActive}
          class:active={imageScopeActive}
          disabled={!selectedId}
          title={selectedId ? undefined : 'Select an image first'}
          onclick={() => setPanelScope('image')}
        >
          This image
        </button>
      </div>

      <div class="options-slot">
        {#if imageScopeActive}
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
        {:else}
          <GlobalOptionsPanel {focusSession} />
        {/if}
      </div>
    </aside>
  </div>

  <div
    class="strip-region"
    role="group"
    aria-label="Image strip"
    onpointerdown={onStripPointerdown}
  >
    <FilmStrip />
  </div>
</div>

<style>
  .compress {
    --mobile-options-height: min(44dvh, 360px);
    --panel-width: 312px;
    --panel-inset: 14px;
    --strip-height: 104px;
    --fit-inset-left: calc(var(--panel-width) + var(--panel-inset) * 2);
    --fit-inset-right: calc(var(--panel-width) + var(--panel-inset) * 2);
    --fit-inset-top: 0px;
    --fit-inset-bottom: 0px;
    position: relative;
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
    background: var(--bg-0, #0c0c0f);
  }

  /* The stage takes all the height above the strip; the production Output fills
     it and its own bottom control bar sits naturally above the strip. */
  .stage-region {
    position: relative;
    flex: 1;
    min-height: 0;
  }

  /* Resting canvas texture: the SAME faint dot grid + soft vignette the
     production Output stage uses (Output.svelte), so the idle global stage
     reads as an intentional canvas awaiting work rather than an empty void.
     Only painted when nothing is selected — the real Output paints its own
     stage otherwise. */
  .stage-region:not(:has(.blank-stage))::before {
    content: none;
  }
  .stage-region::before {
    content: '';
    position: absolute;
    inset: 0;
    background-color: #101014;
    background-image:
      radial-gradient(
        ellipse 120% 90% at 50% 40%,
        rgba(255, 255, 255, 0.045),
        transparent 70%
      ),
      radial-gradient(rgba(128, 128, 140, 0.3) 1px, transparent 1.4px);
    background-size:
      100% 100%,
      22px 22px;
    background-position: center;
    pointer-events: none;
  }

  /* Real layout space for the strip — no longer an overlay footer. The strip
     spans the FULL viewport width (small breathing padding only) and its
     content starts from the LEFT; the panels live in the stage region above,
     so nothing overlaps. No panel-width side voids are reserved here. */
  .strip-region {
    flex: none;
    height: var(--strip-height);
    width: 100%;
    box-sizing: border-box;
    padding: 0 10px;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.06));
    background: color-mix(in srgb, var(--bg-0, #0c0c0f) 82%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
  }

  /* Idle resting state for the global scope: no card, no border — a faint
     centered icon + one quiet line, so it reads as "nothing selected", never
     as a failed load. */
  .blank-stage {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 24px;
    color: var(--text-3, rgba(235, 235, 245, 0.38));
    text-align: center;
    pointer-events: none;
  }
  .blank-icon {
    width: 52px;
    height: 52px;
    margin-bottom: 14px;
    opacity: 0.5;
  }
  .blank-stage p {
    margin: 0;
    font-variant-numeric: tabular-nums;
  }
  .blank-stage .blank-title {
    font-size: 1.1rem;
    font-weight: 650;
    color: var(--text-1, #f5f5f7);
    max-width: 26ch;
  }
  .blank-stage .blank-sub {
    font-size: 0.95rem;
    font-weight: 400;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
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

  /* Side panels are anchored to the BOTTOM of the stage region (which already
     excludes the strip), so they always clear the strip. */
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

  /* Scope colour language: the right panel is coral while it edits the GLOBAL
     batch, and switches to azure while it edits THIS image. theme.css sets
     .options-2 azure by default (that's the image case); the global case
     re-points the same variable contract at the coral accent, so every child
     control (sliders, toggles, section-header ticks) recolours in one move. */
  .options-2.scope-global {
    --main-theme-color: var(--accent-1, #ff8a5e);
    --hot-theme-color: var(--accent-1-hot, #ff6a3c);
    --main-theme-glow: var(--accent-1-glow, rgba(255, 122, 80, 0.32));
    --accent-color: var(--accent-1, #ff8a5e);
  }

  /* The OptionsPanel exposes two sibling roots (scroller + results footer);
     wrap them in a flex column so the scroller grows/scrolls and the footer
     pins to the bottom of the card. */
  .options-slot {
    display: flex;
    flex-direction: column;
    flex: 1 1 auto;
    min-height: 0;
    width: 100%;
  }

  /* A slim, quiet tab row attached to the top of the options card. Not a loud
     toggle: transparent text tabs, the active one carries the accent underline
     that the panel's section headers use. "This image" dims when disabled. */
  .scope-tabs {
    flex: none;
    display: flex;
    gap: 2px;
    padding: 4px 8px 0;
    border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  }
  .scope-tabs button {
    position: relative;
    border: none;
    background: transparent;
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font: inherit;
    font-size: 0.92rem;
    font-weight: 650;
    letter-spacing: 0.01em;
    cursor: pointer;
    padding: 11px 12px 12px;
    transition: color 150ms ease;
  }
  .scope-tabs button::after {
    content: '';
    position: absolute;
    left: 12px;
    right: 12px;
    bottom: -1px;
    height: 2px;
    border-radius: 2px 2px 0 0;
    background: transparent;
    transition: background-color 150ms ease;
  }
  .scope-tabs button:hover:not(:disabled):not(.active) {
    color: var(--text-1, #f5f5f7);
  }
  .scope-tabs button.active {
    color: var(--text-1, #f5f5f7);
  }
  /* Each tab's active accent matches its OWN scope hue, independent of the
     panel's currently-themed side: Global = coral, This image = azure. */
  .scope-tabs button.tab-global.active::after {
    background: var(--accent-1, #ff8a5e);
    box-shadow: 0 0 8px var(--accent-1-glow, rgba(255, 122, 80, 0.32));
  }
  .scope-tabs button.tab-image.active::after {
    background: var(--accent-2, #53b2ff);
    box-shadow: 0 0 8px var(--accent-2-glow, rgba(74, 163, 255, 0.32));
  }
  .scope-tabs button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .scope-tabs button.tab-global:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: -2px;
    border-radius: 6px;
  }
  .scope-tabs button.tab-image:focus-visible {
    outline: 2px solid var(--accent-2, #53b2ff);
    outline-offset: -2px;
    border-radius: 6px;
  }

  /* ── Compact layout ───────────────────────────────────────────────────────
     Below 900px the two 312px side panels no longer fit alongside a usable
     stage without squeezing it to a sliver and hiding the viewer's control bar
     behind the left card. So we drop the horizontal stage insets (stage goes
     full width) and dock both panels as two half-width bottom sheets inside the
     stage region — ABOVE the strip, which now stays put. The Output's own
     control bar and canvas are lifted clear of the docked panels, mirroring the
     production editor's bottom-sheet handling, so nothing is hidden behind
     anything. */
  @media (max-width: 900px) {
    .compress {
      --panel-inset: 8px;
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
    }

    /* Lift the reused production Output's control bar + canvas above the docked
       panels (the panels live inside the stage region, so clearing their height
       is enough — the strip sits outside/below the stage region). */
    :global(.compress .stage-region .output) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset));
    }
    :global(.compress .stage-region .controls) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset) + 8px);
      padding: 0 12px;
      box-sizing: border-box;
    }

    /* Centre the resting-stage message in the visible canvas above the docked
       panels, not behind them. */
    .blank-stage {
      inset-block-end: calc(var(--mobile-options-height) + var(--panel-inset));
    }

    /* Two half-width bottom sheets. They clamp to a usable minimum width so
       controls inside stay legible; at ~700px 2×250 + insets still clears the
       viewport, so the panels never reach across the stage or over each other. */
    .options {
      width: calc(50vw - var(--panel-inset) * 1.5);
      min-width: 250px;
      max-width: calc(50vw - var(--panel-inset) * 1.5);
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
  }

  @media (max-width: 760px) {
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
  }
</style>
