<script lang="ts">
  import { onMount, type Snippet } from 'svelte';
  import Output from '$lib/editor/output/Output.svelte';
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import type { EditorSession } from '$lib/editor/editor-session.svelte';
  import type { SideFormat } from '$lib/compress';
  import { bulkStore } from './store.svelte';
  import BatchInfoPanel from './BatchInfoPanel.svelte';
  import FilmStrip from './FilmStrip.svelte';
  import GlobalOptionsPanel from './GlobalOptionsPanel.svelte';
  import StackStage from './StackStage.svelte';
  import ViewModePicker from './ViewModePicker.svelte';

  export const FOCUS_VIEW_LANDSCAPE_OR_SQUARE_RATIO = 0.95;

  interface Props {
    focusSession: EditorSession;
    onReseed?: (() => void) | null;
    /**
     * Optional custom strip renderer. When omitted, FocusView renders the
     * baseline FilmStrip.
     */
    strip?: Snippet | null;
    /**
     * Strip-region height in CSS px. Lets the home grow the dock. Defaults to
     * the baseline 104px.
     */
    stripHeight?: number;
  }

  let {
    focusSession,
    onReseed = null,
    strip = null,
    stripHeight = 104,
  }: Props = $props();

  let isMac = $state(false);
  let viewportWidth = $state(1024);
  let viewportHeight = $state(768);
  let isSafari = $state(false);

  // ── Stack stage view controls ─────────────────────────────────────────────
  // The stack resting state has no production Output, so bulk owns a toolbar
  // that mirrors the production bottom bar (zoom / view-options) and actually
  // drives the composition: `stackZoom` scales the fan via a CSS transform,
  // `stackAltBackground` swaps the stage backdrop to the light variant (same
  // treatment as production's view-option), `stackPixelated` toggles
  // image-rendering on the cards. State lives here so the backdrop class can sit
  // on `.stage-region` while the zoom/smoothing flow into StackStage as props.
  const STACK_ZOOM_MIN = 0.4;
  const STACK_ZOOM_MAX = 2.5;
  let stackZoom = $state(1);
  let stackAltBackground = $state(false);
  let stackPixelated = $state(false);
  let stackViewOptionsOpen = $state(false);
  let stackViewOptionsEl = $state<HTMLDivElement>();
  let stackViewOptionsBtn = $state<HTMLButtonElement>();
  const stackViewOptionsDirty = $derived(stackPixelated || stackAltBackground);
  const stackZoomPercent = $derived(Math.round(stackZoom * 100));
  const stackViewDirty = $derived(Math.abs(stackZoom - 1) > 1e-3);

  function stackZoomTo(next: number): void {
    stackZoom = Math.min(STACK_ZOOM_MAX, Math.max(STACK_ZOOM_MIN, next));
  }
  function stackResetView(): void {
    stackZoom = 1;
  }

  // Light-dismiss the stack view-options popover while it's open (pointerdown
  // outside or Escape), mirroring the production Output popover behaviour.
  $effect(() => {
    if (!stackViewOptionsOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        stackViewOptionsEl &&
        !stackViewOptionsEl.contains(event.target as Node)
      ) {
        stackViewOptionsOpen = false;
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        stackViewOptionsOpen = false;
        stackViewOptionsBtn?.focus();
      }
    };
    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  });

  // ── Phone layout state ────────────────────────────────────────────────────
  // Below this width the two side-by-side bottom sheets can't coexist without
  // overlapping (each wants ≥250px). We switch to a phone stack: a compact
  // sticky summary bar for the batch result, the full info panel behind a tap,
  // and the settings panel as a single bottom sheet opened from a FAB.
  // We ALSO switch to it on short viewports (landscape phones, e.g. 844×390):
  // there, docked panels eat the whole height and bury the stage, so the same
  // stack — where the stage owns the screen and panels are on-demand sheets —
  // is the right answer.
  const PHONE_MAX = 620;
  const SHORT_MAX = 500;
  const isPhone = $derived(
    viewportWidth <= PHONE_MAX || viewportHeight <= SHORT_MAX,
  );
  // Which phone sheet (if any) is open. Only one at a time; both start closed so
  // the stage + strip own the screen.
  let phoneSheet = $state<'none' | 'info' | 'settings'>('none');

  const selectedId = $derived(bulkStore.selectedId);
  const selectedCount = $derived(bulkStore.selectedCount);
  const file = $derived(bulkStore.selectedFile);
  const thumb = $derived(bulkStore.selectedThumb);

  // The real focus viewer (production Output + its toolbar) is for a SINGLE
  // selected image. Global scope (nothing selected) and a multi-selection both
  // rest on the STACK instead — that's where a global / multi edit's reach is
  // shown, not one image's inspector.
  const showFocus = $derived(selectedCount === 1);
  const showStack = $derived(!showFocus && bulkStore.stackItems.length > 0);
  const stackItems = $derived(bulkStore.stackItems);

  // Compact summary figures for the phone summary bar (mirrors BatchInfoPanel).
  const summary = $derived(bulkStore.summary);
  const SIZE_UNITS = ['B', 'kB', 'MB', 'GB', 'TB'];
  function prettySize(bytes: number): string {
    if (bytes < 1) return '0 B';
    const exponent = Math.min(
      Math.floor(Math.log10(bytes) / 3),
      SIZE_UNITS.length - 1,
    );
    return `${(bytes / 1000 ** exponent).toPrecision(3)} ${SIZE_UNITS[exponent]}`;
  }
  const summaryOriginal = $derived(
    prettySize(summary.output.totalOriginalSize),
  );
  const summaryOptimized = $derived(
    summary.output.optimized > 0
      ? prettySize(summary.output.totalOutputSize)
      : null,
  );
  const summaryPercent = $derived(summary.output.percentChange);
  const orientationOverride = $derived.by(() => {
    if (viewportWidth > 760) return 'horizontal';
    if (!thumb?.w || !thumb.h) return null;
    return thumb.w / thumb.h >= FOCUS_VIEW_LANDSCAPE_OR_SQUARE_RATIO
      ? 'horizontal'
      : 'vertical';
  });
  const imageScopeActive = $derived(
    selectedId !== undefined && bulkStore.panelScope === 'image',
  );
  const imageTabLabel = $derived(
    selectedCount > 1 ? `${selectedCount} images` : 'This image',
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
    // image-rendering:pixelated is a no-op in Safari, so (like the production
    // Output) the smoothing toggle is omitted there — detect it the same way.
    const ua = navigator.userAgent;
    isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  });

  // Leaving phone width closes any open sheet, so the desktop layout never
  // inherits a stuck-open overlay.
  $effect(() => {
    if (!isPhone && phoneSheet !== 'none') phoneSheet = 'none';
  });

  function togglePhoneSheet(sheet: 'info' | 'settings'): void {
    phoneSheet = phoneSheet === sheet ? 'none' : sheet;
  }

  function openPhoneSettings(scope: 'global' | 'image'): void {
    setPanelScope(scope);
    phoneSheet = 'settings';
  }

  function setRightFormat(format: SideFormat): void {
    if (format === 'identity') return;
    focusSession.setFormat(1, format);
  }

  function resetOverrides(): void {
    if (bulkStore.selectedCount === 0) return;
    bulkStore.clearSelectedOverrides();
    onReseed?.();
  }

  function setPanelScope(scope: 'global' | 'image'): void {
    if (scope === 'image' && !selectedId) return;
    bulkStore.panelScope = scope;
  }

  // ── Stage deselect ────────────────────────────────────────────────────────
  // A plain click on the open backdrop deselects (mirrors the strip's empty
  // space). Guarded by a drag threshold so a press-drag on the backdrop — e.g.
  // an accidental smear — never deselects. Cards, the toolbar and the picker all
  // stop-propagate / sit above the backdrop, so only true empty space hits here.
  const BACKDROP_DRAG_THRESHOLD = 4;
  let backdropDown: { x: number; y: number } | null = null;

  function onBackdropPointerdown(event: PointerEvent): void {
    if (event.button !== 0) return;
    backdropDown = { x: event.clientX, y: event.clientY };
  }
  function onBackdropPointerup(event: PointerEvent): void {
    if (!backdropDown) return;
    const dx = event.clientX - backdropDown.x;
    const dy = event.clientY - backdropDown.y;
    if (Math.hypot(dx, dy) >= BACKDROP_DRAG_THRESHOLD) {
      // Treated as a drag — cancel the pending deselect for this gesture.
      backdropDown = null;
    }
  }
  function onBackdropClick(): void {
    const wasClick = backdropDown !== null;
    backdropDown = null;
    if (wasClick && selectedCount > 0) bulkStore.deselect();
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

    if (
      (event.key === 'Delete' || event.key === 'Backspace') &&
      selectedCount > 0 &&
      !typeable
    ) {
      event.preventDefault();
      bulkStore.removeSelected();
      return;
    }

    if (event.key === 'Escape' && phoneSheet !== 'none') {
      event.preventDefault();
      phoneSheet = 'none';
      return;
    }

    if (event.key === 'Escape' && selectedCount > 0) {
      event.preventDefault();
      bulkStore.deselect();
      return;
    }

    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    if (showStack) return;
    if (typeable || target?.getAttribute('role') === 'slider') return;

    event.preventDefault();
    if (event.key === 'ArrowLeft') bulkStore.selectPrevious();
    else bulkStore.selectNext();
  }
</script>

<svelte:window
  onkeydown={onKeydown}
  bind:innerWidth={viewportWidth}
  bind:innerHeight={viewportHeight}
/>

<div class="compress sqush-editor" style="--strip-height: {stripHeight}px;">
  <div
    class="stage-region"
    class:alt-background={showStack && stackAltBackground}
  >
    {#if !showFocus}
      <!-- Stage deselect: clicking the open backdrop (not a card, toolbar
           or picker — those stop the event) deselects, exactly like clicking the
           strip's empty space. A plain click only, guarded by a small drag
           threshold so a press-drag never deselects. Present in the stack
           resting state; NOT in the single-image focus view, where the
           production Output owns its own pointer gestures. Sits at the back of
           the stage so cards/controls layer above it. -->
      <button
        type="button"
        class="stage-backdrop"
        aria-label="Deselect"
        onpointerdown={onBackdropPointerdown}
        onpointerup={onBackdropPointerup}
        onclick={onBackdropClick}
      ></button>
    {/if}
    {#if showFocus}
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
        {orientationOverride}
        onRotate={() => focusSession.rotate()}
      />
    {:else if showStack}
      <StackStage
        items={stackItems}
        zoom={stackZoom}
        pixelated={stackPixelated}
      />
    {/if}

    {#if focusSession.firstError}
      <p class="status-pill error">{focusSession.firstError}</p>
    {/if}

    {#if selectedCount > 1 && !showStack}
      <p class="selection-chip">{selectedCount} selected</p>
    {/if}

    {#if showFocus}
      <div class="history-controls">
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

    <aside
      class="options options-1"
      class:phone-sheet={isPhone}
      class:open={isPhone && phoneSheet === 'info'}
      aria-hidden={isPhone && phoneSheet !== 'info' ? 'true' : undefined}
    >
      {#if isPhone}
        <div class="sheet-handle-row">
          <span class="sheet-title">Batch details</span>
          <button
            type="button"
            class="sheet-close"
            aria-label="Close details"
            onclick={() => (phoneSheet = 'none')}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M7 7l10 10M17 7L7 17"
                fill="none"
                stroke="currentColor"
                stroke-width="2.1"
                stroke-linecap="round"
              />
            </svg>
          </button>
        </div>
      {/if}
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
      class:phone-sheet={isPhone}
      class:open={isPhone && phoneSheet === 'settings'}
      aria-hidden={isPhone && phoneSheet !== 'settings' ? 'true' : undefined}
    >
      <div class="scope-tabs" role="tablist" aria-label="Settings scope">
        <button
          type="button"
          class="tab-global"
          role="tab"
          aria-selected={bulkStore.panelScope === 'global'}
          class:active={bulkStore.panelScope === 'global'}
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
          {imageTabLabel}
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

    {#if isPhone}
      <!-- Phone summary bar: the batch result stays reachable at a glance,
           replacing the full left panel. Tap the figures to expand the full
           info sheet; Save all sits on the right. -->
      <div class="phone-summary" class:dimmed={phoneSheet !== 'none'}>
        <button
          type="button"
          class="summary-facts"
          aria-label="Show batch details"
          aria-expanded={phoneSheet === 'info'}
          onclick={() => togglePhoneSheet('info')}
        >
          <span class="summary-sizes">
            <span class="s-original">{summaryOriginal}</span>
            <span class="s-arrow" aria-hidden="true">→</span>
            <span class="s-optimized">{summaryOptimized ?? '…'}</span>
          </span>
          {#if summaryOptimized}
            <span class="s-delta">↓{Math.abs(Math.round(summaryPercent))}%</span
            >
          {/if}
          <svg class="s-caret" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M8 10l4 4 4-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          class="summary-save"
          disabled={!bulkStore.canSaveAll}
          onclick={() => void bulkStore.saveAll()}
        >
          {bulkStore.exporting ? 'Saving…' : 'Save all'}
        </button>
      </div>

      <!-- Settings FAB: the clear affordance that opens the options bottom
           sheet. Coral when it will open GLOBAL settings, azure when an image is
           selected (it opens THIS-image settings by default then). -->
      <button
        type="button"
        class="settings-fab"
        class:image={selectedId}
        aria-label="Open settings"
        aria-expanded={phoneSheet === 'settings'}
        onclick={() => openPhoneSettings(selectedId ? 'image' : 'global')}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
          />
        </svg>
      </button>

      {#if phoneSheet !== 'none'}
        <!-- Scrim dismisses whichever sheet is open. -->
        <button
          type="button"
          class="phone-scrim"
          aria-label="Close sheet"
          onclick={() => (phoneSheet = 'none')}
        ></button>
      {/if}
    {/if}

    {#if showStack}
      <!-- Stack stage toolbar. The single-image focus view reuses the production
           Output bar; the stack has no Output, so this bulk-owned bar mirrors it
           1:1 (same pill/glass, same icon language — see Output.svelte) and
           actually drives the composition: zoom −/%/+ scales the fan, Reset view
           fits it back to 100%, and the view-options popover toggles the stage
           background + card smoothing exactly like production's. -->
      <div class="stack-controls">
        <div class="button-group">
          <button
            class="button first-button"
            onclick={() => stackZoomTo(stackZoom / 1.25)}
            title="Zoom out"
            aria-label="Zoom out"
          >
            <svg class="icon" viewBox="0 0 24 24"
              ><path d="M19 13H5v-2h14v2z" /></svg
            >
          </button>
          <span class="zoom" aria-label="Zoom level">
            <span class="zoom-value">{stackZoomPercent}</span>%
          </span>
          <button
            class="button"
            onclick={() => stackZoomTo(stackZoom * 1.25)}
            title="Zoom in"
            aria-label="Zoom in"
          >
            <svg class="icon" viewBox="0 0 24 24"
              ><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" /></svg
            >
          </button>
          <button
            class="button last-button"
            onclick={stackResetView}
            disabled={!stackViewDirty}
            title="Fit — reset the stack to 100%"
            aria-label="Fit stack"
          >
            <svg class="icon" viewBox="0 0 24 24"
              ><path
                d="M5 15H3v4c0 1.1.9 2 2 2h4v-2H5v-4zM5 5h4V3H5c-1.1 0-2 .9-2 2v4h2V5zm14-2h-4v2h4v4h2V5c0-1.1-.9-2-2-2zm0 16h-4v2h4c1.1 0 2-.9 2-2v-4h-2v4zM12 9c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"
              /></svg
            >
          </button>
        </div>

        <div class="button-group" bind:this={stackViewOptionsEl}>
          <button
            class="button first-button last-button view-options-trigger"
            class:active={stackViewOptionsOpen}
            class:dirty={stackViewOptionsDirty}
            onclick={() => (stackViewOptionsOpen = !stackViewOptionsOpen)}
            title="View options — preview smoothing &amp; background"
            aria-label="View options"
            aria-haspopup="true"
            aria-expanded={stackViewOptionsOpen}
            bind:this={stackViewOptionsBtn}
          >
            <svg class="icon" viewBox="0 0 24 24"
              ><path
                d="M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z"
              /></svg
            >
          </button>

          {#if stackViewOptionsOpen}
            <div class="view-options" role="group" aria-label="View options">
              {#if !isSafari}
                <button
                  class="view-option"
                  class:active={stackPixelated}
                  onclick={() => (stackPixelated = !stackPixelated)}
                  aria-pressed={stackPixelated}
                >
                  {#if stackPixelated}
                    <svg class="icon" viewBox="0 0 24 24"
                      ><path
                        d="M12 3h5v2h2v2h2v5h-2V9h-2V7h-2V5h-3V3M21 12v5h-2v2h-2v2h-5v-2h3v-2h2v-2h2v-3h2M12 21H7v-2H5v-2H3v-5h2v3h2v2h2v2h3v2M3 12V7h2V5h2V3h5v2H9v2H7v2H5v3H3"
                      /></svg
                    >
                  {:else}
                    <svg class="icon" viewBox="0 0 24 24"
                      ><circle
                        cx="12"
                        cy="12"
                        r="8"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                      /></svg
                    >
                  {/if}
                  <span class="view-option-label">Smoothing</span>
                  <span class="view-option-state"
                    >{stackPixelated ? 'Pixelated' : 'On'}</span
                  >
                </button>
              {/if}
              <button
                class="view-option"
                class:active={stackAltBackground}
                onclick={() => (stackAltBackground = !stackAltBackground)}
                aria-pressed={stackAltBackground}
              >
                {#if stackAltBackground}
                  <svg class="icon" viewBox="0 0 24 24"
                    ><path
                      d="M9 7H7v2h2V7zm0 4H7v2h2v-2zm0-8a2 2 0 0 0-2 2h2V3zm4 12h-2v2h2v-2zm6-12v2h2a2 2 0 0 0-2-2zm-6 0h-2v2h2V3zM9 17v-2H7c0 1.1.9 2 2 2zm10-4h2v-2h-2v2zm0-4h2V7h-2v2zm0 8a2 2 0 0 0 2-2h-2v2zM5 7H3v12c0 1.1.9 2 2 2h12v-2H5V7zm10-2h2V3h-2v2zm0 12h2v-2h-2v2z"
                    /></svg
                  >
                {:else}
                  <svg class="icon" viewBox="0 0 24 24"
                    ><path
                      d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm2 4v-2H3c0 1.1.9 2 2 2zM3 9h2V7H3v2zm12 12h2v-2h-2v2zm4-18H9a2 2 0 0 0-2 2v10c0 1.1.9 2 2 2h10a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2zm0 12H9V5h10v10zm-8 6h2v-2h-2v2zm-4 0h2v-2H7v2z"
                    /></svg
                  >
                {/if}
                <span class="view-option-label">Background</span>
                <span class="view-option-state"
                  >{stackAltBackground ? 'Light' : 'Dark'}</span
                >
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <!-- View picker, docked to the STAGE'S bottom toolbar. In the single-image
         focus view the production zoom/rotate bar owns bottom-centre, so the
         picker pairs just to its RIGHT (same pill/glass language, small gap); in
         the stack state the bulk toolbar (above) owns centre, so the picker
         pairs beside it the SAME way. It never overlaps the strip
         (it sits inside the stage region, above the strip) nor the toolbar. -->
    <div
      class="view-picker-dock"
      class:with-toolbar={showFocus || showStack}
      class:phone={isPhone}
    >
      <ViewModePicker />
    </div>
  </div>

  <div class="strip-region" role="group" aria-label="Image strip">
    {#if strip}
      {@render strip()}
    {:else}
      <FilmStrip />
    {/if}
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

  /* ── View-picker dock ──────────────────────────────────────────────────────
     Lives inside the stage region (so it always clears the strip below) and
     pins to the bottom. Default: bottom-centre, for the stack state where no
     production toolbar exists. `.with-toolbar` (single-image focus)
     shifts it right of the centred zoom/rotate bar so the two read as one
     paired cluster with a small gap between them. The production toolbar is
     ~290px wide and centred (zoom group ~204px + rotate/view group ~80px), so
     its right edge sits ~145px past centre; ~168px of translate clears it with
     a small gap, with headroom for the zoom-% readout growing (e.g. 1000%). */
  .view-picker-dock {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    z-index: 6;
    display: flex;
    align-items: center;
    pointer-events: none;
  }
  .view-picker-dock :global(.view-mode) {
    pointer-events: auto;
    /* Match the production toolbar's glass so the pair reads as one language. */
    height: 38px;
    box-sizing: border-box;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  }
  .view-picker-dock.with-toolbar {
    left: 50%;
    transform: translateX(168px);
  }
  /* 901–1240px: the toolbar is present but there's no room to sit the picker
     beside it without crowding the right settings panel (312px @ right:14px,
     starting ~vw-326; the offset picker's right edge reaches ~vw/2+280 and
     collides below ~1212px). Lift it to its own lane just above the centred
     toolbar instead. */
  @media (min-width: 901px) and (max-width: 1240px) {
    .view-picker-dock.with-toolbar {
      transform: translateX(-50%);
      bottom: 60px;
    }
  }
  /* 621–900px: the two settings panels dock as tall bottom sheets and the
     Output/toolbar is lifted above them, so the bottom is fully occupied. Park
     the picker at the TOP-centre of the stage (clear of the top-right
     controls) in every state here — visible and reachable. */
  @media (min-width: 621px) and (max-width: 900px) {
    .view-picker-dock,
    .view-picker-dock.with-toolbar {
      /* Bottom-centre, in the gap between the fan and the docked panels' top
         edge (panels are mobile-options-height tall @ panel-inset from bottom).
         In focus state the lifted Output toolbar shares this lane and the picker
         sits just above it. */
      top: auto;
      bottom: calc(var(--mobile-options-height, 360px) + 52px);
      left: 50%;
      transform: translateX(-50%);
    }
  }
  /* Phone (≤620px): panels are on-demand sheets (hidden by default), so the
     bottom is free. Keep the picker reachable and uncropped at bottom-LEFT,
     clear of the settings FAB (bottom-right) and above the strip. */
  .view-picker-dock.phone,
  .view-picker-dock.phone.with-toolbar {
    left: 12px;
    right: auto;
    top: auto;
    bottom: 12px;
    transform: none;
  }

  /* Resting canvas texture: the SAME faint dot grid + soft vignette the
     production Output stage paints (Output.svelte `.output::before`), so the
     bulk resting stage reads as the identical canvas the editor uses, never a
     different flat void. The values below are copied verbatim from production,
     one source. The
     real focus-view Output paints its own stage, so this is suppressed the
     moment a single image is selected (`.stage-region:has(.output)`). */
  .stage-region:not(:has(.output))::before {
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
    /* Match production's colour cross-fade when the background toggle flips. */
    transition: background-color 500ms ease;
    pointer-events: none;
  }
  /* Background view-option (stack toolbar): swap to the same near-white the
     production alt-background uses, so only the colour cross-fades on toggle. */
  .stage-region.alt-background:not(:has(.output))::before {
    background-color: #d4d4d8;
  }

  /* Empty-stage deselect surface: a transparent full-region button at the BACK
     of the stage (above the ::before texture, below the fan + controls). The
     stack fan container is pointer-events:none except on its cards, so clicks in
     the open gaps fall through to this; cards/toolbar/picker stop-propagate. */
  .stage-backdrop {
    position: absolute;
    inset: 0;
    z-index: 0;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: default;
    -webkit-appearance: none;
    appearance: none;
  }

  /* ── Stack stage toolbar ────────────────────────────────────────────────────
     A faithful copy of the production Output bottom bar (Output.svelte
     `.controls` + descendants), so the stack state has the identical zoom /
     view-options affordance the focus view gets for free. Same glass, same pill
     radii, same icon sizing — only the buttons here drive the bulk stack view
     controls instead of the pinch-zoom two-up. Docked bottom-centre; the
     view-picker pairs to its right via `.view-picker-dock.with-toolbar`. */
  .stack-controls {
    position: absolute;
    bottom: 12px;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 6px;
    z-index: 6;
    pointer-events: none;
  }
  .stack-controls > * {
    pointer-events: auto;
  }
  /* 621–900px: the docked panels + picker occupy the bottom, so lift the stack
     toolbar into its own centred lane just above the picker (which sits at
     mobile-options-height + 52). Mirrors the focus view's picker handling. */
  @media (min-width: 621px) and (max-width: 900px) {
    .stack-controls {
      bottom: calc(var(--mobile-options-height, 360px) + 100px);
    }
  }
  /* Phone (≤620px) / short: the picker docks bottom-LEFT and the settings FAB
     bottom-RIGHT, so a centred toolbar at bottom:12 would collide with the
     picker. Lift the stack toolbar into its own lane just above that row. */
  @media (max-width: 620px), (max-height: 500px) {
    .stack-controls {
      bottom: 68px;
    }
  }
  .stack-controls .button-group {
    display: flex;
    position: relative;
    border-radius: 999px;
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.4);
  }
  .stack-controls .button,
  .stack-controls .zoom {
    display: flex;
    align-items: center;
    box-sizing: border-box;
    background-color: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px) saturate(1.3);
    -webkit-backdrop-filter: blur(16px) saturate(1.3);
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-width: 1px 0 1px 1px;
    line-height: 1.1;
    white-space: nowrap;
    height: 38px;
    padding: 0 12px;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--text-2, #bbb);
    transition:
      background-color 150ms ease,
      color 150ms ease;
  }
  .stack-controls .button {
    justify-content: center;
    min-width: 40px;
    padding: 0 7px;
  }
  .stack-controls .icon {
    display: block;
    width: 20px;
    height: 20px;
    fill: currentColor;
  }
  .stack-controls .button:hover:not(:disabled) {
    background: rgba(45, 45, 54, 0.92);
    color: var(--text-1, #fff);
  }
  .stack-controls .button.active {
    background: rgba(62, 62, 74, 0.95);
    color: var(--text-1, #fff);
  }
  .stack-controls .button:disabled {
    opacity: 0.35;
    cursor: default;
  }
  .stack-controls .button:disabled:hover {
    background-color: var(--surface, rgba(19, 19, 25, 0.82));
    color: var(--text-2, #bbb);
  }
  .stack-controls .first-button {
    border-radius: 999px 0 0 999px;
    padding-left: 11px;
  }
  .stack-controls .last-button {
    border-radius: 0 999px 999px 0;
    border-right-width: 1px;
    padding-right: 11px;
  }
  .stack-controls .first-button.last-button {
    border-radius: 999px;
  }
  .stack-controls .zoom {
    cursor: default;
    width: 5.5rem;
    font: inherit;
    text-align: center;
    justify-content: center;
    color: var(--text-3, #939393);
    font-size: 0.85rem;
  }
  .stack-controls .zoom-value {
    margin: 0 3px 0 0;
    padding: 0 2px;
    font-size: 1.15rem;
    letter-spacing: 0.04rem;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: var(--text-1, #fff);
  }
  .stack-controls .view-options-trigger {
    position: relative;
  }
  .stack-controls .view-options-trigger.dirty::after {
    content: '';
    position: absolute;
    top: 8px;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--accent-1, #ff8a5e);
  }
  .stack-controls .view-options {
    position: absolute;
    bottom: calc(100% + 8px);
    right: 0;
    z-index: 10;
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
  .stack-controls .view-option {
    display: flex;
    align-items: center;
    gap: 10px;
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
  .stack-controls .view-option:hover {
    background: rgba(45, 45, 54, 0.92);
    color: var(--text-1, #fff);
  }
  .stack-controls .view-option.active {
    color: var(--text-1, #fff);
  }
  .stack-controls .view-option .icon {
    width: 20px;
    height: 20px;
  }
  .stack-controls .view-option-label {
    flex: 1;
  }
  .stack-controls .view-option-state {
    color: var(--text-3, #939393);
    font-size: 0.8rem;
    font-variant-numeric: tabular-nums;
  }
  .stack-controls .view-option.active .view-option-state {
    color: var(--accent-1, #ff8a5e);
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
    padding: 0;
    border-top: 1px solid var(--border, rgba(255, 255, 255, 0.06));
    background: color-mix(in srgb, var(--bg-0, #0c0c0f) 82%, transparent);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    display: flex;
    align-items: center;
    user-select: none;
    -webkit-user-select: none;
    /* Smooth the dock resize when S/M/L changes, so the stage
       grows/shrinks without jank. */
    transition: height 220ms cubic-bezier(0.22, 0.61, 0.36, 1);
  }

  @media (prefers-reduced-motion: reduce) {
    .strip-region {
      transition: none;
    }
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

  .selection-chip {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9;
    margin: 0;
    padding: 6px 12px;
    border-radius: 999px;
    border: 1px solid
      color-mix(in srgb, var(--accent-2, #53b2ff) 28%, transparent);
    background: rgba(12, 12, 15, 0.68);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--text-2, rgba(235, 235, 245, 0.62));
    font-size: 0.85rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    pointer-events: none;
  }

  .history-controls {
    position: absolute;
    top: 0;
    left: 0;
    margin: 14px;
    display: flex;
    gap: 8px;
    z-index: 10;
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
    .history-controls {
      margin: 8px;
      gap: 6px;
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

  /* ── Phone layout (≤620px) ────────────────────────────────────────────────
     Two side-by-side bottom sheets can't coexist here without overlapping, so
     we switch stacks entirely: the stage + strip own the screen, a compact
     summary bar pins the batch result to the top, the full info panel and the
     settings panel become single full-width bottom SHEETS opened on demand (one
     at a time), and a settings FAB is the affordance for the options sheet. The
     Output is no longer lifted for docked panels (there are none now); it fills
     the stage down to the strip, with just top clearance for the summary bar.
     Also engaged on short viewports (landscape phones) where docked panels would
     bury the stage — must stay in lockstep with the isPhone JS condition. */
  @media (max-width: 620px), (max-height: 500px) {
    .compress {
      --panel-inset: 10px;
      --summary-h: 54px;
      /* Back/Add production chrome: 8px top margin + 36px buttons. */
      --bulk-topbar-h: 44px;
      --summary-top: calc(var(--bulk-topbar-h) + 4px);
      --stage-top: calc(var(--summary-top) + var(--summary-h) + 10px);
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
      --fit-inset-top: var(--stage-top);
    }

    /* Output fills the stage down to the strip again — undo the 900px lift. */
    :global(.compress .stage-region .output) {
      bottom: 0;
      top: var(--stage-top);
    }
    :global(.compress .stage-region .controls) {
      bottom: 10px;
      padding: 0 12px;
    }

    /* Move the top-left chrome below the summary bar so nothing collides. */
    .history-controls {
      top: calc(var(--summary-top) + var(--summary-h) - 6px);
    }

    /* ── Summary bar ──────────────────────────────────────────────────────── */
    .phone-summary {
      position: absolute;
      top: var(--summary-top);
      left: var(--panel-inset);
      right: var(--panel-inset);
      height: var(--summary-h);
      z-index: 12;
      display: flex;
      align-items: stretch;
      gap: 8px;
      padding: 6px;
      box-sizing: border-box;
      border-radius: 14px;
      background: var(--surface, rgba(19, 19, 25, 0.86));
      backdrop-filter: blur(16px) saturate(1.3);
      -webkit-backdrop-filter: blur(16px) saturate(1.3);
      border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
      box-shadow: 0 8px 24px -12px rgba(0, 0, 0, 0.6);
      transition: opacity 150ms ease;
    }
    .phone-summary.dimmed {
      opacity: 0;
      pointer-events: none;
    }
    .summary-facts {
      flex: 1;
      min-width: 0;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
      border: none;
      border-radius: 10px;
      background: transparent;
      color: var(--text-1, #f5f5f7);
      font: inherit;
      cursor: pointer;
      text-align: left;
    }
    .summary-facts:hover {
      background: var(--surface-raise, rgba(255, 255, 255, 0.06));
    }
    .summary-sizes {
      display: inline-flex;
      align-items: baseline;
      gap: 6px;
      min-width: 0;
      font-weight: 700;
      font-size: 0.98rem;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .s-original {
      color: var(--text-2, rgba(235, 235, 245, 0.62));
    }
    .s-arrow {
      color: var(--text-3, rgba(235, 235, 245, 0.38));
    }
    .s-optimized {
      color: var(--text-1, #f5f5f7);
    }
    .s-delta {
      flex: none;
      color: var(--good, #46d39a);
      font-weight: 700;
      font-size: 0.9rem;
      font-variant-numeric: tabular-nums;
    }
    .s-caret {
      flex: none;
      width: 18px;
      height: 18px;
      margin-left: auto;
      color: var(--text-3, rgba(235, 235, 245, 0.38));
    }
    .summary-save {
      flex: none;
      padding: 0 16px;
      border: none;
      border-radius: 10px;
      font: inherit;
      font-weight: 700;
      font-size: 0.95rem;
      white-space: nowrap;
      cursor: pointer;
      color: #16161c;
      background: linear-gradient(
        135deg,
        var(--accent-1, #ff8a5e),
        var(--accent-1-hot, #ff6a3c)
      );
      box-shadow: 0 2px 10px var(--accent-1-glow, rgba(255, 122, 80, 0.32));
    }
    .summary-save:active:not(:disabled) {
      transform: translateY(1px);
    }
    .summary-save:disabled {
      opacity: 0.45;
      cursor: default;
      box-shadow: none;
      filter: saturate(0.6);
    }

    /* ── Settings FAB ─────────────────────────────────────────────────────── */
    .settings-fab {
      position: absolute;
      right: var(--panel-inset);
      bottom: var(--panel-inset);
      z-index: 12;
      width: 52px;
      height: 52px;
      display: grid;
      place-items: center;
      border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.16));
      border-radius: 50%;
      cursor: pointer;
      color: #16161c;
      background: linear-gradient(
        135deg,
        var(--accent-1, #ff8a5e),
        var(--accent-1-hot, #ff6a3c)
      );
      box-shadow: 0 8px 22px -6px var(--accent-1-glow, rgba(255, 122, 80, 0.5));
      transition:
        transform 150ms ease,
        opacity 150ms ease;
    }
    /* When an image is selected the FAB opens THIS-image settings — wear azure. */
    .settings-fab.image {
      color: #06121f;
      background: linear-gradient(
        135deg,
        var(--accent-2, #53b2ff),
        var(--accent-2-hot, #2f97ff)
      );
      box-shadow: 0 8px 22px -6px var(--accent-2-glow, rgba(74, 163, 255, 0.5));
    }
    .settings-fab svg {
      width: 24px;
      height: 24px;
    }
    .settings-fab:active {
      transform: scale(0.94);
    }

    /* ── Bottom sheets (info + settings share the mechanism) ──────────────────
       Fixed to the VIEWPORT (not the stage region) so translateY(100%) fully
       hides them past the bottom edge — anchoring to the stage bottom would let
       a closed sheet peek up over the strip. Open, they overlay the strip too,
       which is the expected bottom-sheet behaviour. */
    .options.phone-sheet {
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      top: auto;
      width: 100%;
      max-width: 100%;
      height: auto;
      max-height: 82dvh;
      justify-content: flex-start;
      border-radius: 18px 18px 0 0;
      transform: translateY(100%);
      transition: transform 260ms cubic-bezier(0.22, 0.61, 0.36, 1);
      z-index: 25;
      font-size: 1rem;
    }
    .options.phone-sheet.open {
      transform: translateY(0);
    }

    /* The info sheet gets a titled grab-row; its inner panel scrolls. */
    .sheet-handle-row {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px 8px;
    }
    .sheet-title {
      font-size: 0.95rem;
      font-weight: 700;
      color: var(--text-1, #f5f5f7);
    }
    .sheet-close {
      width: 32px;
      height: 32px;
      display: grid;
      place-items: center;
      border: none;
      border-radius: 50%;
      background: var(--surface-raise, rgba(255, 255, 255, 0.06));
      color: var(--text-2, rgba(235, 235, 245, 0.62));
      cursor: pointer;
    }
    .sheet-close svg {
      width: 18px;
      height: 18px;
    }
    .options-1.phone-sheet :global(.batch-info) {
      min-height: 0;
    }

    @media (prefers-reduced-motion: reduce) {
      .options.phone-sheet {
        transition: none;
      }
    }

    /* Scrim behind an open sheet — fixed so it also covers the strip below the
       stage region (the sheet overlays it). */
    .phone-scrim {
      position: fixed;
      inset: 0;
      z-index: 24;
      border: none;
      padding: 0;
      background: rgba(6, 6, 9, 0.5);
      backdrop-filter: blur(2px);
      -webkit-backdrop-filter: blur(2px);
      cursor: pointer;
    }
  }
</style>
