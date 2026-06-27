<script lang="ts">
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import { pushState } from '$app/navigation';
  import { resolve } from '$app/paths';
  import { page } from '$app/state';
  import { registerSqushServiceWorker } from '$lib/service-worker-registration';
  import Output from '$lib/editor/output/Output.svelte';
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import Snackbar from '$lib/editor/Snackbar.svelte';
  import Intro from '$lib/editor/intro/Intro.svelte';
  import { snackbar } from '$lib/editor/snackbar-store.svelte';
  import { fileDrop } from '$lib/editor/file-drop';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import '$lib/editor/theme.css';

  const session = new EditorSession();
  const sideIndexes = [0, 1] as const;

  onMount(() => {
    registerSqushServiceWorker().catch((error: unknown) => {
      console.error('Service worker registration failed', error);
    });

    return () => session.dispose();
  });

  // The per-side encode + spinner effects now live inside EditorSession (set up
  // in its constructor, disposed in dispose()); the page keeps only the effects
  // that depend on page/route state or write back to shared session state.
  $effect(() => session.syncRouteState(!!page.state.editor));
  $effect(() => session.seedResizeDimensions());
  $effect(() => session.persistSettings());

  function pickFiles(list: FileList | null | undefined) {
    session.pickFiles(list, () => pushState('', { editor: true }));
  }

  function back() {
    if (typeof history !== 'undefined') history.back();
    else session.clearFile();
  }
</script>

<svelte:head>
  <title>{session.docTitle}</title>
</svelte:head>

<!-- The whole app is a drop target so an image dropped ANYWHERE (intro padding,
     or over the open editor) loads/replaces it instead of the browser opening
     the file — Squoosh wraps everything in <file-drop> the same way. -->
<div class="app-root" {@attach fileDrop((files) => pickFiles(files))}>
  {#if !session.file}
    <Intro onFiles={pickFiles} onMessage={(t) => snackbar.show(t)} />
    {#if dev}
      <p class="intro-diag">
        <a href={resolve('/diagnostics')}>Pipeline diagnostics →</a>
      </p>
    {/if}
  {:else}
    <div class="compress sqush-editor">
      <Output
        leftImage={session.results[0]?.outputImageData}
        rightImage={session.results[1]?.outputImageData}
        leftWorking={session.showSpinner[0]}
        rightWorking={session.showSpinner[1]}
        leftDone={session.statuses[0] === 'done'}
        rightDone={session.statuses[1] === 'done'}
        leftActivity={session.activities[0]}
        rightActivity={session.activities[1]}
        fileId={session.loadId}
        leftContain={session.leftContain}
        rightContain={session.rightContain}
        containWidth={session.naturalWidth}
        containHeight={session.naturalHeight}
        onRotate={() => session.rotate()}
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

      {#each sideIndexes as index (index)}
        <aside class="options options-{index + 1}">
          <OptionsPanel
            side={index === 0 ? 'left' : 'right'}
            format={session.sides[index].format}
            formats={session.availableFormats}
            options={session.sides[index].optionsByFormat[
              session.sides[index].format
            ] ?? {}}
            processorState={session.sides[index].processorState}
            naturalWidth={session.naturalWidth}
            naturalHeight={session.naturalHeight}
            sourceName={session.file.name}
            isVector={session.isVectorSource}
            result={session.results[index]}
            working={session.showSpinner[index]}
            canImport={session.canImport[index]}
            downloadName={session.downloadName(index)}
            onFormatChange={(f) => session.setFormat(index, f)}
            onCopy={() => session.copyToOther(index)}
            onSave={() => session.saveSide(index)}
            onImport={() => session.importSide(index)}
          />
        </aside>
      {/each}
    </div>
  {/if}

  <Snackbar />
</div>

<style>
  /* Body reset + font stack live in the root +layout.svelte; this page only
     owns its full-height sizing and dark background. */
  :global(html),
  :global(body) {
    height: 100%;
  }
  :global(body) {
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
    }

    :global(.sqush-editor .controls) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset) + 6px);
      padding: 0 48px;
    }
  }
</style>
