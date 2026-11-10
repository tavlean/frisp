<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { dev } from '$app/env';
  import { resolve } from '$app/paths';
  import { page, updated } from '$app/state';
  import {
    registerServiceWorker,
    checkForServiceWorkerUpdate,
    applyServiceWorkerUpdate,
    anotherTabIsBusy,
    answerBusyQueries,
  } from '$lib/service-worker-registration';
  import Output from '$lib/editor/output/Output.svelte';
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import ImageInfoPanel from '$lib/editor/ImageInfoPanel.svelte';
  import Snackbar from '$lib/editor/Snackbar.svelte';
  import CrashPanel from '$lib/editor/CrashPanel.svelte';
  import Intro from '$lib/editor/intro/Intro.svelte';
  import BulkMode from '$lib/bulk/BulkMode.svelte';
  import { bulkStore } from '$lib/bulk/store.svelte';
  import type { ImportedFile } from '$lib/bulk/import-sources';
  import { snackbar } from '$lib/editor/snackbar-store.svelte';
  import { fileDrop } from '$lib/editor/file-drop';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import {
    isEditorOpen,
    pushEditorRoute,
  } from '$lib/editor/editor-route.svelte';
  import type { AutoQualityControl } from '$lib/editor/auto-quality';
  import { IDENTITY, type CompressOutcome } from '$lib/compress';
  import { isSupportedBulkImage } from 'client/lazy-app/bulk';
  import { isMac } from 'client/lazy-app/util';
  import { APP_NAME } from 'shared/brand';
  import '$lib/editor/theme.css';

  const session = new EditorSession();

  // Each side's Auto quality action. A getter, not a copied value, so the
  // panel reads `running` live from the session.
  const autoQualityFor = (index: 0 | 1): AutoQualityControl => ({
    get running() {
      return session.autoQualityRunning[index];
    },
    run: (target) => void session.autoQuality(index, target),
    cancel: () => session.cancelAutoQuality(index),
  });
  const autoQuality = [autoQualityFor(0), autoQualityFor(1)] as const;

  // A side whose output IS an SVG file (the Original side of an SVG source, or
  // the optimized 'svg' side) previews via the vector-true overlay instead of
  // the canvas — Output switches on the URL's presence.
  const svgPreviewUrl = (outcome: CompressOutcome | null) =>
    outcome?.outputFile.type === 'image/svg+xml' ? outcome.outputUrl : null;

  // Drives the shortcut hint in the Undo/Redo tooltips (⌘ on Apple, Ctrl else).
  const undoTitle = isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)';
  const redoTitle = isMac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)';

  // The landing screen shows until an image loads or a batch opens. Both the
  // mobile browser chrome (theme-color) and the page canvas follow it: the
  // landing is theme-aware (light in light mode), while the editor/bulk view has
  // no light theme and is always dark.
  const isLanding = $derived(!bulkStore.hasJobs && !session.file);

  onMount(() => {
    // When a new build is downloaded and waiting, offer a non-intrusive
    // "refresh now" prompt rather than reloading mid-task. Clicking Refresh
    // activates the waiting worker, which reloads EVERY open tab onto the new
    // build, so first check that no other tab would lose open images.
    const stopAnswering = answerBusyQueries(() => !isLanding);
    registerServiceWorker({
      onUpdateReady: () => {
        void snackbar
          .show(`A new version of ${APP_NAME} is available.`, {
            actions: ['Refresh'],
            timeout: null,
          })
          .then(async (action) => {
            if (action !== 'Refresh') return;
            if (await anotherTabIsBusy()) {
              const confirm = await snackbar.show(
                `Refreshing also reloads another ${APP_NAME} tab that has images open.`,
                { actions: ['Refresh anyway'], timeout: null },
              );
              if (confirm !== 'Refresh anyway') return;
            }
            applyServiceWorkerUpdate();
          });
      },
    }).catch((error: unknown) => {
      console.error('Service worker registration failed', error);
    });

    return () => {
      stopAnswering();
      session.dispose();
    };
  });

  // The per-side encode + spinner effects now live inside EditorSession (set up
  // in its constructor, disposed in dispose()); the page keeps only the effects
  // that depend on page/route state or write back to shared session state.
  $effect(() => session.syncRouteState(isEditorOpen()));
  // Bulk mirror of syncRouteState: leaving the editor history state while a
  // batch is open tears the batch down (browser back = exit bulk); an editor
  // history state left behind after the batch emptied (last image removed) is
  // unwound so the intro doesn't sit on a stale entry.
  $effect(() => {
    const editorOpen = isEditorOpen();
    const hasJobs = bulkStore.hasJobs;
    const hasFile = !!session.file;
    untrack(() => {
      if (!editorOpen && hasJobs) {
        bulkStore.reset();
        bulkStore.runtime.disposeBridges();
      } else if (editorOpen && !hasJobs && !hasFile) {
        history.back();
      }
    });
  });
  $effect(() => session.persistSettings());

  // SvelteKit refetches _app/version.json whenever the tab regains focus, but
  // the browser only rechecks the service worker on a full navigation, which
  // this single-route app rarely makes. So when SvelteKit sees a new deploy,
  // ask the worker to update; the waiting-worker prompt above takes it from
  // there.
  $effect(() => {
    if (updated.current) void checkForServiceWorkerUpdate();
  });

  // Mirror the current view onto the root data-view attribute so the global
  // body canvas and the OS color-scheme can switch with it (see the style
  // block). The intro paints its own theme-aware surface on top; this keeps the
  // body behind it in step, which is what mobile browsers sample for the bars.
  $effect(() => {
    document.documentElement.dataset.view = isLanding ? 'landing' : 'app';
    return () => delete document.documentElement.dataset.view;
  });

  function pickFiles(list: ArrayLike<File> | null | undefined) {
    session.pickFiles(list, pushEditorRoute);
  }

  function routeFiles(imported: ImportedFile[]): void {
    const files = imported.filter((item) => isSupportedBulkImage(item.file));
    if (files.length === 0) {
      void snackbar.show('No supported images found.');
      return;
    }
    if (bulkStore.hasJobs) {
      void bulkStore.importFiles(files);
      return;
    }
    if (files.length > 1) {
      void bulkStore.importFiles(files);
      // A previously open single image is abandoned (NOT added to the batch);
      // reuse its editor history entry rather than stacking a second one, so
      // one Back press exits bulk cleanly.
      if (session.file) session.clearFile();
      pushEditorRoute();
      return;
    }
    pickFiles([files[0].file]);
  }

  function exitBulk() {
    if (page.state.editor) {
      history.back();
    } else {
      bulkStore.reset();
      bulkStore.runtime.disposeBridges();
    }
  }

  function back() {
    if (typeof history !== 'undefined') history.back();
    else session.clearFile();
  }

  // Global undo/redo shortcuts. ⌘/Ctrl+Z undoes, +Shift (or Ctrl+Y) redoes. We
  // leave typeable fields alone so their native text-undo still works; range and
  // checkbox inputs have no text undo, so the editor's undo takes over there.
  function onKeydown(event: KeyboardEvent) {
    if (!session.file) return;
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) return;

    const key = event.key.toLowerCase();
    const isUndo = key === 'z' && !event.shiftKey;
    const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !isMac);
    if (!isUndo && !isRedo) return;

    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName;
      const typeable =
        tag === 'TEXTAREA' ||
        target.isContentEditable ||
        (tag === 'INPUT' &&
          !['range', 'checkbox', 'radio'].includes(
            (target as HTMLInputElement).type,
          ));
      if (typeable) return;
    }

    event.preventDefault();
    if (isRedo) session.redo();
    else session.undo();
  }
</script>

<svelte:head>
  <title>{session.docTitle}</title>
  <!-- Tell mobile browsers (Safari/Chrome) what to tint the toolbar + status
       bar. Without it they sample the body background — the always-dark editor
       canvas — so the bars stayed dark even on the light landing. The landing
       follows the OS theme; the editor/bulk view is always dark. The hex values
       mirror Intro's --i-page tokens and the body canvas below (and #0c0c0f =
       the editor's --bg-0) — keep them in sync. -->
  {#if isLanding}
    <meta
      name="theme-color"
      media="(prefers-color-scheme: light)"
      content="#f4f3f1"
    />
    <meta
      name="theme-color"
      media="(prefers-color-scheme: dark)"
      content="#111113"
    />
  {:else}
    <meta name="theme-color" content="#0c0c0f" />
  {/if}
</svelte:head>

<svelte:window onkeydown={onKeydown} />

<!-- The whole app is a drop target so an image dropped ANYWHERE (intro padding,
     or over the open editor) loads/replaces it instead of the browser opening
     the file — Squoosh wraps everything in <file-drop> the same way. -->
<div class="app-root" {@attach fileDrop((files) => routeFiles(files))}>
  <!-- The boundaries keep a render crash inside the view that threw. The
       session and the bulk store live outside them, so recovery keeps the
       image. src/hooks.client.ts logs the error. -->
  {#if bulkStore.hasJobs}
    <svelte:boundary>
      <BulkMode onExit={exitBulk} />
      {#snippet failed(error, reset)}
        <CrashPanel {error} onclose={exitBulk} onretry={reset} />
      {/snippet}
    </svelte:boundary>
  {:else if session.file}
    <svelte:boundary>
      <div class="compress editor-root">
        <!-- grainPreview (the live grain scrub frame) outranks the stale result
           while its encode is in flight; see EditorSession.updateGrainPreview. -->
        <Output
          leftImage={session.runtime[0].grainPreview ??
            session.runtime[0].result?.outputImageData}
          rightImage={session.runtime[1].grainPreview ??
            session.runtime[1].result?.outputImageData}
          leftWorking={session.runtime[0].showSpinner}
          rightWorking={session.runtime[1].showSpinner}
          leftDone={session.runtime[0].status === 'done'}
          rightDone={session.runtime[1].status === 'done'}
          leftActivity={session.runtime[0].activity}
          rightActivity={session.runtime[1].activity}
          fileId={session.loadId}
          leftContain={session.leftContain}
          rightContain={session.rightContain}
          containWidth={session.naturalWidth}
          containHeight={session.naturalHeight}
          onRotate={session.isVectorSource ? undefined : () => session.rotate()}
          leftSvgUrl={svgPreviewUrl(session.runtime[0].result)}
          rightSvgUrl={svgPreviewUrl(session.runtime[1].result)}
        />

        {#if session.firstError}
          <p class="status-pill error">{session.firstError}</p>
        {/if}

        <button class="back" onclick={back} title="Back" aria-label="Back">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M6.5 6.5l11 11m0-11l-11 11"
              fill="none"
              stroke="currentColor"
              stroke-width="2.2"
              stroke-linecap="round"
            />
          </svg>
        </button>

        <div class="history-controls">
          <button
            class="hist"
            onclick={() => session.undo()}
            disabled={!session.history.canUndo}
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
            onclick={() => session.redo()}
            disabled={!session.history.canRedo}
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
          {#if session.sides[0].format === IDENTITY}
            <ImageInfoPanel
              file={session.file}
              width={session.naturalWidth}
              height={session.naturalHeight}
              onCompareAs={(f) => session.setFormat(0, f)}
            />
          {:else}
            <OptionsPanel
              side="left"
              format={session.sides[0].format}
              formats={session.availableFormats}
              options={session.sides[0].optionsByFormat[
                session.sides[0].format
              ] ?? {}}
              processorState={session.sides[0].processorState}
              naturalWidth={session.naturalWidth}
              naturalHeight={session.naturalHeight}
              isVector={session.isVectorSource}
              sourceType={session.sourceType}
              transcodeBlocked={session.transcodeBlocked(0)}
              result={session.runtime[0].result}
              working={session.runtime[0].showSpinner}
              exportable={session.runtime[0].exportable}
              downloadName={session.downloadName(0)}
              onFormatChange={(f) => session.setFormat(0, f)}
              onCloseCompare={() => session.setFormat(0, IDENTITY)}
              autoQuality={autoQuality[0]}
            />
          {/if}
        </aside>

        <aside class="options options-2">
          <OptionsPanel
            side="right"
            format={session.sides[1].format}
            formats={session.availableFormats}
            options={session.sides[1].optionsByFormat[
              session.sides[1].format
            ] ?? {}}
            processorState={session.sides[1].processorState}
            naturalWidth={session.naturalWidth}
            naturalHeight={session.naturalHeight}
            isVector={session.isVectorSource}
            sourceType={session.sourceType}
            transcodeBlocked={session.transcodeBlocked(1)}
            result={session.runtime[1].result}
            working={session.runtime[1].showSpinner}
            exportable={session.runtime[1].exportable}
            downloadName={session.downloadName(1)}
            onFormatChange={(f) => session.setFormat(1, f)}
            autoQuality={autoQuality[1]}
          />
        </aside>
      </div>
      {#snippet failed(error, reset)}
        <CrashPanel {error} onclose={back} onretry={reset} />
      {/snippet}
    </svelte:boundary>
  {:else}
    <Intro onFiles={routeFiles} onMessage={(m) => void snackbar.show(m)} />
    {#if dev}
      <p class="intro-diag">
        <a href={resolve('/diagnostics')}>Pipeline diagnostics →</a>
      </p>
    {/if}
  {/if}

  <Snackbar />
</div>

<style>
  /* Body reset + font stack live in the root +layout.svelte; this page owns the
     full-height sizing and the canvas behind everything. */
  :global(html),
  :global(body) {
    height: 100%;
  }
  /* The landing is the default view and follows the OS theme, so light mode is
     genuinely light — the body itself, not just the intro surface painted over
     it. This is also what the mobile browser chrome samples. The editor and
     bulk views have no light theme, so [data-view='app'] forces the dark canvas
     back (the attribute is mirrored from the current view in script). */
  :global(html) {
    color-scheme: light dark;
  }
  :global(body) {
    background: light-dark(#f4f3f1, #111113);
    color: light-dark(#1a1a1e, #f5f5f7);
  }
  :global(html[data-view='app']) {
    color-scheme: dark;
  }
  :global(html[data-view='app'] body) {
    background: #0c0c0f;
    color: #f5f5f7;
  }

  /* The landing screen itself lives in Intro.svelte. The whole viewport is the
     drop target (see the fileDrop attachment on .app-root), with the pink
     dashed drop overlay for feedback. This page only adds the dev-only
     diagnostics link, pinned out of the way in a corner. */
  .intro-diag {
    position: fixed;
    bottom: 12px;
    right: 14px;
    margin: 0;
    z-index: 20;
  }
  .intro-diag a {
    color: #5fb4e4;
  }

  /* App wrapper — the drop target spanning both intro and editor. */
  .app-root {
    position: relative;
  }

  /* Full-bleed editor */
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

  /* Drag-to-replace feedback, ported from Squoosh's .drop-valid overlay. The
     `drop-valid` class is toggled by the fileDrop attachment while an image is
     dragged anywhere over the app. */
  .app-root::after {
    content: '';
    position: fixed;
    inset: 10px;
    border: 2px dashed var(--accent-1, #ff8a5e);
    background-color: rgba(255, 122, 80, 0.06);
    border-radius: 16px;
    opacity: 0;
    transform: scale(0.95);
    transition:
      opacity 200ms ease-in,
      transform 200ms ease-in;
    pointer-events: none;
    z-index: 40;
  }
  .app-root:global(.drop-valid)::after {
    opacity: 1;
    transform: scale(1);
    transition-timing-function: ease-out;
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

  /* Back button: a circular glass control in the top-left corner. */
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

  /* Undo / Redo: a pair of glass circles sitting just right of the Back button,
     sharing its visual language. Disabled when there's nothing to step to. */
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

  /* Bottom-anchored option cards: floating glass panels, inset from the
     viewport edges; the canvas shows above and between them. */
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

  @media (max-width: 760px) {
    .compress {
      --panel-inset: 6px;
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
      /* Lift Output's stage and bar clear of the docked bottom cards. */
      --output-bottom: calc(var(--mobile-options-height) + var(--panel-inset));
      --controls-bottom: calc(
        var(--mobile-options-height) + var(--panel-inset) + 8px
      );
      --controls-padding-inline: 56px;
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
      /* Fixed (not just max) height so both bottom cards are the SAME height —
         otherwise the short "Original" side and the tall encoder side bottom-
         align at different heights and read as broken. The inner scroller grows
         to fill and scrolls (see OptionsPanel), keeping the download footer
         pinned at the bottom of each card. */
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

  @media (max-width: 420px) {
    .compress {
      --mobile-options-height: 48dvh;
      --controls-bottom: calc(
        var(--mobile-options-height) + var(--panel-inset) + 6px
      );
      --controls-padding-inline: 48px;
    }
  }
</style>
