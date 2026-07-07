<script lang="ts">
  // Dev-only LAB experiment: a full porcelain re-skin of the single-image
  // editor. Everything here is REAL — a live EditorSession loads an image,
  // encodes with the production pipeline, and reports real sizes / undo-redo.
  // Only the chrome is new. No production file is modified; the +page.ts opts
  // this subtree out of prerender/SSR and we hard-guard on `dev` below.
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import Output from '$lib/editor/output/Output.svelte';
  import Snackbar from '$lib/editor/Snackbar.svelte';
  import { snackbar } from '$lib/editor/snackbar-store.svelte';
  import { fileDrop } from '$lib/editor/file-drop';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import { IDENTITY } from '$lib/compress';
  import type { ImportedFile } from '$lib/bulk/import-sources';
  import TopBar from '$lib/lab/porcelain/TopBar.svelte';
  import LeftPanel from '$lib/lab/porcelain/LeftPanel.svelte';
  import LabOptionsPanel from '$lib/lab/porcelain/LabOptionsPanel.svelte';
  import CropStage from '$lib/lab/crop/CropStage.svelte';
  import CropPanel from '$lib/lab/crop/CropPanel.svelte';
  import { CropTool } from '$lib/lab/crop/crop-tool.svelte';
  import type { CropSnapshot } from '$lib/lab/crop/crop-types';
  import ThemeSwitch, {
    type ThemeMode,
  } from '$lib/lab/porcelain/ThemeSwitch.svelte';
  import '$lib/editor/theme.css';
  import '$lib/lab/porcelain/porcelain.css';

  const session = new EditorSession();

  // Drives the ⌘/Ctrl hint in TopBar tooltips (matches production +page.svelte).
  let isMac = $state(false);
  // Lab-only forced color scheme; default System (no class).
  let theme = $state<ThemeMode>('system');
  let fileInput = $state<HTMLInputElement>();

  // ── Crop mode (lab-level, upstream of the session) ──────────────────────
  // Crop is NON-DESTRUCTIVE within the session: `original` is the file the
  // user actually picked, `cropSnapshot` the last applied crop — re-opening
  // the tool restores the crop over the ORIGINAL pixels. Apply feeds a
  // rendered PNG through pickFiles, so the whole pipeline sees a plain file.
  let cropTool = $state<CropTool | null>(null);
  let cropBusy = $state(false);
  let original: File | null = null;
  let cropSnapshot: CropSnapshot | null = null;

  onMount(() => {
    isMac = /mac|iphone|ipad/i.test(
      navigator.platform || navigator.userAgent || '',
    );
    return () => {
      session.dispose();
      cropTool?.dispose();
    };
  });

  async function openCrop() {
    if (!session.file || session.isVectorSource || cropTool) return;
    const source = original ?? session.file;
    try {
      cropTool = await CropTool.create(source, cropSnapshot);
    } catch {
      void snackbar.show("Couldn't decode this image for cropping.");
    }
  }

  function closeCrop() {
    cropTool?.dispose();
    cropTool = null;
    cropBusy = false;
  }

  async function applyCrop() {
    if (!cropTool || cropBusy) return;
    cropBusy = true;
    try {
      const file = await cropTool.applyToFile();
      cropSnapshot = cropTool.snapshot();
      // Internal re-pick: deliberately does NOT touch `original`.
      session.pickFiles([file], () => {});
      closeCrop();
    } catch {
      cropBusy = false;
      void snackbar.show('Cropping failed — nothing was changed.');
    }
  }

  // Mirror the production per-side effects that live OUTSIDE EditorSession.
  // (Route/history/bulk/service-worker effects are intentionally skipped — see
  // the brief: "Back" here simply clears the file.)
  $effect(() => session.seedResizeDimensions());
  $effect(() => session.persistSettings());

  // pickFiles takes a callback the production page uses to push editor history;
  // the lab has no route history, so pass a no-op.
  function pickFiles(list: ArrayLike<File> | null | undefined) {
    session.pickFiles(list, () => {});
  }

  // All drops route to the single editor: take the first supported image.
  // A genuinely new image resets the crop lineage (original + snapshot).
  function routeFiles(imported: ImportedFile[]) {
    const first = imported.find((item) => item.file.type.startsWith('image/'));
    if (!first) {
      void snackbar.show('No supported images found.');
      return;
    }
    closeCrop();
    original = first.file;
    cropSnapshot = null;
    pickFiles([first.file]);
  }

  function onBrowse() {
    fileInput?.click();
  }

  function onFileInputChange(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const first = input.files?.[0];
    if (first) {
      closeCrop();
      original = first;
      cropSnapshot = null;
    }
    pickFiles(input.files);
    input.value = '';
  }

  // Global undo/redo shortcuts, ported verbatim from production +page.svelte:
  // leave typeable fields alone so native text-undo still works.
  function onKeydown(event: KeyboardEvent) {
    if (!session.file) return;

    // Crop mode owns Esc (disarm sampling, then cancel) and Enter (apply).
    if (cropTool) {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (cropTool.sampling) cropTool.sampling = false;
        else closeCrop();
        return;
      }
      if (event.key === 'Enter') {
        const target = event.target as HTMLElement | null;
        if (target && target.tagName === 'INPUT') return; // field commit
        event.preventDefault();
        void applyCrop();
        return;
      }
      return; // no editor shortcuts while cropping
    }

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

<svelte:window onkeydown={onKeydown} />

{#if !dev}
  <p>Not found</p>
{:else}
  <div
    class="app-root compress editor-root porcelain-root"
    class:force-light={theme === 'light'}
    class:force-dark={theme === 'dark'}
    {@attach fileDrop((files) => routeFiles(files))}
  >
    {#if session.file && cropTool}
      <CropStage tool={cropTool} />

      <aside class="panel panel-right options-2 crop-panel-host">
        <CropPanel
          tool={cropTool}
          onapply={() => void applyCrop()}
          oncancel={closeCrop}
        />
      </aside>
    {:else if session.file}
      <Output
        leftImage={session.runtime[0].result?.outputImageData}
        rightImage={session.runtime[1].result?.outputImageData}
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
        onRotate={() => session.rotate()}
      />

      <TopBar
        {session}
        {isMac}
        oncrop={() => void openCrop()}
        cropDisabled={session.isVectorSource}
      />

      {#if session.firstError}
        <p class="error-pill" role="alert">{session.firstError}</p>
      {/if}

      <aside class="panel panel-left options-1">
        <LeftPanel {session} />
      </aside>

      <aside class="panel panel-right options-2">
        <header class="right-head">
          <span class="side-dot" aria-hidden="true"></span>
          <span class="right-title">Output</span>
          <div class="right-actions">
            <button
              type="button"
              class="quiet-btn"
              aria-label="Copy settings to left side"
              onclick={() => session.copyToOther(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect
                  x="9"
                  y="9"
                  width="11"
                  height="11"
                  rx="2.5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                />
                <path
                  d="M15 6.5A2.5 2.5 0 0 0 12.5 4H6.5A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </button>
            <button
              type="button"
              class="quiet-btn"
              aria-label="Save side settings"
              onclick={() => session.saveSide(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M5 5.5A1.5 1.5 0 0 1 6.5 4h9.3L20 8.2V18.5A1.5 1.5 0 0 1 18.5 20h-12A1.5 1.5 0 0 1 5 18.5z"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linejoin="round"
                />
                <path
                  d="M8 4v4.5h6.5M8.5 20v-5h7v5"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
            <button
              type="button"
              class="quiet-btn"
              aria-label="Import saved side settings"
              disabled={!session.canImport[1]}
              onclick={() => session.importSide(1)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M12 4v10m0 0l4-4M12 14l-4-4"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M5 16v2.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V16"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.6"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </div>
        </header>

        <LabOptionsPanel
          side="right"
          format={session.sides[1].format}
          formats={session.availableFormats}
          options={session.sides[1].optionsByFormat[session.sides[1].format] ??
            {}}
          processorState={session.sides[1].processorState}
          naturalWidth={session.naturalWidth}
          naturalHeight={session.naturalHeight}
          isVector={session.isVectorSource}
          result={session.runtime[1].result}
          working={session.runtime[1].showSpinner}
          downloadName={session.downloadName(1)}
          onFormatChange={(f) => session.setFormat(1, f)}
        />
      </aside>
    {:else}
      <div class="dropzone">
        <div class="drop-card">
          <span class="eyebrow">porcelain — lab</span>
          <p class="drop-title">Drop an image to start</p>
          <p class="drop-caption">
            Or browse for a file. Everything runs on the real pipeline — real
            encoders, real sizes, real undo.
          </p>
          <button type="button" class="browse-btn" onclick={onBrowse}>
            Browse…
          </button>
        </div>
      </div>
    {/if}

    <input
      class="hidden-input"
      type="file"
      accept="image/*"
      bind:this={fileInput}
      onchange={onFileInputChange}
    />

    <ThemeSwitch value={theme} onchange={(mode) => (theme = mode)} />
    <Snackbar />
  </div>
{/if}

<style>
  /* The lab root is full-bleed with its OWN background — we never style body. */
  .app-root {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: var(--bg-0);
    color: var(--text-1);
  }

  /* Reserve gutters so Output's fit/centre keeps the image clear of the panels
     (same mechanism as production .compress). */
  .compress {
    --panel-width: 296px;
    --fit-inset-left: calc(var(--panel-width) + 32px);
    --fit-inset-right: calc(var(--panel-width) + 32px);
    --fit-inset-top: 84px;
    --fit-inset-bottom: 16px;
  }

  .panel {
    position: absolute;
    top: 84px;
    bottom: 16px;
    width: var(--panel-width);
    display: flex;
    flex-direction: column;
    min-height: 0;
    z-index: 8;
    background: var(--pc-panel);
    border: 1px solid var(--pc-border);
    border-radius: 20px;
    box-shadow: var(--pc-shadow-panel);
    overflow: hidden;
  }
  @supports (corner-shape: squircle) {
    .panel {
      corner-shape: squircle;
      border-radius: 24px;
    }
  }

  .panel-left {
    left: 16px;
  }

  .panel-right {
    right: 16px;
  }

  .right-head {
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 13px var(--horizontal-padding) 8px;
  }

  .side-dot {
    flex: none;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--main-theme-color);
  }

  .right-title {
    flex: 1;
    font-size: 15px;
    font-weight: 600;
    color: var(--pc-text-1);
  }

  .right-actions {
    display: flex;
    gap: 2px;
  }

  .quiet-btn {
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
      color 140ms ease,
      opacity 140ms ease;
  }

  .quiet-btn svg {
    width: 18px;
    height: 18px;
  }

  .quiet-btn:hover:not(:disabled) {
    background: var(--pc-inset);
    color: var(--pc-text-1);
  }

  .quiet-btn:disabled {
    opacity: 0.32;
    cursor: default;
  }

  .quiet-btn:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* Error pill: white pill, red text — porcelain twin of production's. */
  .error-pill {
    position: absolute;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
    padding: 7px 16px;
    border-radius: 999px;
    background: var(--pc-surface);
    border: 1px solid var(--pc-border);
    color: var(--bad);
    font-size: 13px;
    font-weight: 600;
    z-index: 14;
    pointer-events: none;
    max-width: 70vw;
    box-shadow: var(--pc-shadow-control);
  }

  .hidden-input {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  /* ── No-file drop state ────────────────────────────────────────────────── */
  .dropzone {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .drop-card {
    display: grid;
    justify-items: center;
    gap: 6px;
    max-width: 380px;
    padding: 34px 40px 30px;
    text-align: center;
    background: var(--pc-panel);
    border: 1px solid var(--pc-border);
    border-radius: 20px;
    box-shadow: var(--pc-shadow-panel);
  }
  @supports (corner-shape: squircle) {
    .drop-card {
      corner-shape: squircle;
      border-radius: 24px;
    }
  }

  .eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--pc-text-3);
    text-transform: none;
  }

  .drop-title {
    margin: 2px 0 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--pc-text-1);
  }

  .drop-caption {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--pc-text-2);
  }

  .browse-btn {
    height: 38px;
    padding: 0 18px;
    border: 1px solid var(--pc-border);
    border-radius: 11px;
    background: var(--pc-raise);
    color: var(--pc-text-1);
    font: inherit;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--pc-shadow-control);
    transition:
      border-color 140ms ease,
      transform 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .browse-btn {
      corner-shape: squircle;
      border-radius: 13px;
    }
  }

  .browse-btn:hover {
    border-color: var(--pc-border-strong);
    transform: translateY(-1px);
  }

  .browse-btn:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* Drop-valid overlay (fileDrop toggles `.drop-valid` on the root). */
  .app-root::after {
    content: '';
    position: fixed;
    inset: 10px;
    border: 2px dashed var(--main-theme-color);
    background-color: color-mix(
      in srgb,
      var(--main-theme-color) 6%,
      transparent
    );
    border-radius: 18px;
    opacity: 0;
    transform: scale(0.97);
    transition:
      opacity 200ms ease,
      transform 200ms ease;
    pointer-events: none;
    z-index: 40;
  }
  .app-root:global(.drop-valid)::after {
    opacity: 1;
    transform: scale(1);
  }

  @media (max-width: 900px) {
    .compress {
      --panel-width: min(46vw, 300px);
    }
  }

  @media (max-width: 760px) {
    .compress {
      --panel-width: calc(50vw - 20px);
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
      --fit-inset-top: 72px;
      --fit-inset-bottom: calc(46dvh + 12px);
    }
    .panel {
      top: auto;
      bottom: 12px;
      height: 46dvh;
    }
    .panel-left {
      left: 12px;
    }
    .panel-right {
      right: 12px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .app-root::after,
    .browse-btn {
      transition-duration: 0ms;
    }
  }
</style>
