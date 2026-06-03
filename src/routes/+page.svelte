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

    session.loadSupportedFormats().catch((error: unknown) => {
      console.error('Format support detection failed', error);
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
        <svg viewBox="0 0 61 53.3">
          <title>Back</title>
          <path
            class="back-blob"
            d="M0 25.6c-.5-7.1 4.1-14.5 10-19.1S23.4.1 32.2 0c8.8 0 19 1.6 24.4 8s5.6 17.8 1.7 27a29.7 29.7 0 01-20.5 18c-8.4 1.5-17.3-2.6-24.5-8S.5 32.6.1 25.6z"
          />
          <path
            class="back-x"
            d="M41.6 17.1l-2-2.1-8.3 8.2-8.2-8.2-2 2 8.2 8.3-8.3 8.2 2.1 2 8.2-8.1 8.3 8.2 2-2-8.2-8.3z"
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
    background: #18181b;
    color: #fff;
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
    --fit-inset-left: 300px;
    --fit-inset-right: 300px;
    --fit-inset-top: 0px;
    --fit-inset-bottom: 0px;
    position: relative;
    width: 100vw;
    height: 100dvh;
    overflow: hidden;
    background: #1a1a1a;
  }

  /* Drag-to-replace feedback, ported from Squoosh's .drop-valid overlay. The
     `drop-valid` class is toggled by the fileDrop attachment while an image is
     dragged anywhere over the app. */
  .app-root::after {
    content: '';
    position: fixed;
    inset: 10px;
    border: 2px dashed var(--pink, #ff3385);
    background-color: rgba(0, 0, 0, 0.1);
    border-radius: 10px;
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
    padding: 6px 14px;
    border-radius: 6px;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    z-index: 8;
    pointer-events: none;
    max-width: 70vw;
  }
  .status-pill.error {
    color: #ff8a8a;
    font-weight: 600;
  }

  /* Back button (pink blob X), ported from Compress/style.css */
  .back {
    position: absolute;
    top: 0;
    left: 0;
    margin: 14px;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    z-index: 10;
  }
  .back svg {
    width: 58px;
    overflow: visible;
    display: block;
  }
  .back-blob {
    fill: var(--hot-pink);
    opacity: 0.77;
  }
  .back-x {
    fill: var(--white);
  }

  /* Bottom-anchored option cards, ported from Compress/style.css.
     Each side is a content-height card in a bottom corner; the canvas shows
     above and between them. */
  .options {
    position: absolute;
    bottom: 0;
    width: 300px;
    max-height: calc(100% - 64px);
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    color: #fff;
    font-size: 1.2rem;
    z-index: 5;
  }
  .options-1 {
    left: 0;
  }
  .options-2 {
    right: 0;
  }

  @media (max-width: 760px) {
    .compress {
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
    }

    :global(.sqush-editor .output) {
      bottom: var(--mobile-options-height);
    }

    :global(.sqush-editor .controls) {
      bottom: calc(var(--mobile-options-height) + 8px);
      padding: 0 56px;
      box-sizing: border-box;
    }

    .back {
      margin: 8px;
    }
    .back svg {
      width: 48px;
    }

    .status-pill {
      top: 8px;
      max-width: calc(100vw - 112px);
      font-size: 0.85rem;
    }

    .options {
      width: 50vw;
      /* Fixed (not just max) height so both bottom cards are the SAME height —
         otherwise the short "Original" side and the tall encoder side bottom-
         align at different heights and read as broken. The inner scroller grows
         to fill and scrolls (see OptionsPanel), keeping the download bubble
         pinned at the bottom of each card. */
      height: var(--mobile-options-height);
      max-height: var(--mobile-options-height);
      font-size: 0.95rem;
    }
    .options-1 {
      left: 0;
    }
    .options-2 {
      right: 0;
    }
  }

  @media (max-width: 420px) {
    .compress {
      --mobile-options-height: 48dvh;
    }

    :global(.sqush-editor .controls) {
      bottom: calc(var(--mobile-options-height) + 6px);
      padding: 0 48px;
    }
  }
</style>
