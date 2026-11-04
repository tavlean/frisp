<script lang="ts">
  // Dev-only LAB experiment: the "showcase" take on the landing page. The hero
  // FEATURES THE APP ITSELF — a framed, dark app-window mock sits centre stage
  // the way SaaS heroes feature a UI screenshot, except this "screenshot" is a
  // live drop target. Drop (or pick) an image and the window ignites, then a
  // FLIP morph expands it to fill the viewport and hands off to the REAL frisp
  // editor with the image already loading + encoding. Everything past the morph
  // is production: a live EditorSession runs the real pipeline and reports real
  // sizes. No production file is touched; +page.ts opts this subtree out of
  // prerender/SSR and we hard-guard on `dev` below.
  import { onMount, tick } from 'svelte';
  import { dev } from '$app/environment';
  import { APP_NAME } from 'shared/brand';
  import { fromDataTransfer } from '$lib/bulk/import-sources';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import { IDENTITY } from '$lib/compress';
  import Output from '$lib/editor/output/Output.svelte';
  import OptionsPanel from '$lib/editor/OptionsPanel.svelte';
  import ImageInfoPanel from '$lib/editor/ImageInfoPanel.svelte';
  import Snackbar from '$lib/editor/Snackbar.svelte';
  import Brand from '$lib/lab/intro/Brand.svelte';
  import Icon from '$lib/lab/intro/Icon.svelte';
  import ThemeToggle, {
    type ThemeMode,
  } from '$lib/lab/intro/ThemeToggle.svelte';
  import '$lib/editor/theme.css';
  import '$lib/lab/intro/intro-lab.css';

  // Constructed once at module-instance level (porcelain's proven pattern); its
  // encode/spinner effects live in an internal $effect.root, so no component
  // reactive context is needed. Disposed in the onMount cleanup below.
  const session = new EditorSession();

  // Lab-only forced color scheme; System adds no class and defers to the OS.
  let theme = $state<ThemeMode>('system');
  let fileInput = $state<HTMLInputElement>();

  // Drives the ⌘/Ctrl hint in the Undo/Redo tooltips (matches production).
  let isMac = $state(false);
  const undoTitle = $derived(isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)');
  const redoTitle = $derived(isMac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)');

  // ── Drag state (page-level; own depth counter so nested children don't
  // flicker it). We manage this by hand rather than via IntroDropDemo because
  // the morph needs the raw File to feed the real session. ──────────────────
  let dragDepth = $state(0);
  const dragActive = $derived(dragDepth > 0);

  // ── Morph state ────────────────────────────────────────────────────────────
  // `entered` mounts the fullscreen editor container; `heroHidden` fades the
  // hero chrome. The mock window stays in place, covered by the container.
  let entered = $state(false);
  let heroHidden = $state(false);
  let windowCard = $state<HTMLElement>();
  let morphEl = $state<HTMLDivElement>();

  function prefersReducedMotion(): boolean {
    return (
      typeof matchMedia !== 'undefined' &&
      matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  onMount(() => {
    isMac = /mac|iphone|ipad/i.test(
      navigator.platform || navigator.userAgent || '',
    );
    return () => session.dispose();
  });

  function dragHasFiles(event: DragEvent): boolean {
    const types = event.dataTransfer?.types;
    return !!types && Array.prototype.includes.call(types, 'Files');
  }
  function onDragEnter(event: DragEvent) {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    dragDepth += 1;
  }
  function onDragOver(event: DragEvent) {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
  }
  function onDragLeave(event: DragEvent) {
    if (!dragHasFiles(event)) return;
    dragDepth = Math.max(0, dragDepth - 1);
  }
  function onDrop(event: DragEvent) {
    event.preventDefault();
    dragDepth = 0;
    if (entered || !event.dataTransfer) return;
    // Single-image showcase: take the first file, ignore the rest (bulk is out
    // of scope). fromDataTransfer walks folders like the production import path.
    void fromDataTransfer(event.dataTransfer).then((files) => {
      const file = files[0]?.file;
      if (file) void accept(file);
    });
  }

  function browse(): void {
    fileInput?.click();
  }
  function onPick(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void accept(file);
  }

  // Accept → start the real encode, then FLIP the window open into the editor.
  async function accept(file: File): Promise<void> {
    if (entered) return;

    // Feed the real session first so encoding is already running during the
    // animation — the editor renders mid-encode (working badge), which is
    // honest and alive. No editor history is pushed (we own the exit).
    session.pickFiles([file], () => {});
    if (!session.file) return; // non-image: session showed a snackbar, bail

    const reduce = prefersReducedMotion();
    const rect = windowCard?.getBoundingClientRect();

    entered = true;
    await tick();
    const el = morphEl;
    if (!el) return;

    heroHidden = true;

    if (reduce || !rect) {
      // Reduced motion (or no measurable card): a simple crossfade.
      el.style.opacity = '0';
      void el.offsetWidth; // reflow
      el.style.transition = 'opacity 200ms ease';
      el.style.opacity = '1';
      return;
    }

    // FLIP: map the fullscreen container onto the card rect, then release to
    // none. transform-origin top-left makes translate+scale an exact rect map.
    const sx = rect.width / window.innerWidth;
    const sy = rect.height / window.innerHeight;
    el.style.transformOrigin = 'top left';
    el.style.borderRadius = '18px';
    el.style.transform = `translate(${rect.x}px, ${rect.y}px) scale(${sx}, ${sy})`;
    void el.offsetWidth; // reflow so the initial transform is committed
    el.style.transition =
      'transform 480ms cubic-bezier(0.32, 0.72, 0, 1), border-radius 480ms cubic-bezier(0.32, 0.72, 0, 1)';
    el.style.transform = 'none';
    el.style.borderRadius = '0px';
  }

  // Back inside the editor EXITS the showcase (unlike production's history.back):
  // a quick fade back to the hero, session cleared, drop state reset so the hero
  // invites again. The reverse FLIP is intentionally not attempted.
  function exitEditor(): void {
    const reduce = prefersReducedMotion();
    const el = morphEl;
    const done = () => {
      entered = false;
      heroHidden = false;
      dragDepth = 0;
      session.clearFile();
    };
    if (el && !reduce) {
      el.style.transition = 'opacity 300ms ease';
      el.style.opacity = '0';
      window.setTimeout(done, 300);
    } else {
      done();
    }
  }

  // Global undo/redo shortcuts while the editor is open — copied from production
  // +page.svelte (leaves typeable fields' native undo alone).
  function onKeydown(event: KeyboardEvent) {
    if (!entered || !session.file) return;
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

{#if dev}
  <main
    class="intro-lab-root il-showcase-root"
    class:force-light={theme === 'light'}
    class:force-dark={theme === 'dark'}
    class:is-dragging={dragActive && !entered}
    ondragenter={onDragEnter}
    ondragover={onDragOver}
    ondragleave={onDragLeave}
    ondrop={onDrop}
  >
    <input
      bind:this={fileInput}
      class="sr-only"
      type="file"
      accept="image/*"
      tabindex="-1"
      onchange={onPick}
    />

    <header class="masthead" class:faded={heroHidden}>
      <Brand size={17} />
      <div class="masthead-right">
        <span class="tag">open source</span>
        <ThemeToggle value={theme} onchange={(mode) => (theme = mode)} />
      </div>
    </header>

    <section class="stage">
      <div class="intro-copy" class:faded={heroHidden}>
        <h1 class="headline">The editor is already open.</h1>
        <p class="subline">
          Drop an image on it — compression starts right there. Nothing uploads.
        </p>
      </div>

      <!-- The whole app-window mock is one real button opening the file picker.
           Its interior is a CSS miniature of the dark frisp editor. -->
      <button
        bind:this={windowCard}
        type="button"
        class="window"
        onclick={browse}
        aria-label="Drop an image on the app, or click to browse — it opens the editor here"
      >
        <span class="corner-cluster" aria-hidden="true">
          <span class="corner-dot"></span>
          <span class="corner-dot"></span>
        </span>

        <span class="panel panel-left" aria-hidden="true">
          <span class="skel" style="width: 80%"></span>
          <span class="skel" style="width: 60%"></span>
          <span class="skel" style="width: 70%"></span>
          <span class="skel footer-bar"></span>
        </span>
        <span class="panel panel-right" aria-hidden="true">
          <span class="skel" style="width: 70%"></span>
          <span class="skel" style="width: 80%"></span>
          <span class="skel" style="width: 60%"></span>
          <span class="skel footer-bar"></span>
        </span>

        <span class="divider" aria-hidden="true"></span>

        <span class="invite">
          <span class="invite-glyph"><Icon name="drop-tray" size={34} /></span>
          <span class="invite-title">
            {dragActive
              ? 'Release to open the editor'
              : 'Drop an image on the app'}
          </span>
          <span class="invite-sub"
            >or click to browse — it opens right here</span
          >
        </span>
      </button>
    </section>

    <footer class="colophon" class:faded={heroHidden}>
      <span>{APP_NAME} — images never leave your device</span>
      <span class="colophon-right">Open source · Works offline · Free</span>
    </footer>

    {#if entered}
      <!-- The morph surface: fixed fullscreen, holds the REAL editor. Starts
           mapped onto the card rect (set imperatively in accept()) and
           transitions to fill the viewport. -->
      <div class="morph" bind:this={morphEl}>
        {#if session.file}
          <div class="compress editor-root">
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

            {#if session.firstError}
              <p class="status-pill error">{session.firstError}</p>
            {/if}

            <button
              class="back"
              onclick={exitEditor}
              title="Back"
              aria-label="Back"
            >
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
                  result={session.runtime[0].result}
                  working={session.runtime[0].showSpinner}
                  exportable={session.runtime[0].exportable}
                  downloadName={session.downloadName(0)}
                  onFormatChange={(f) => session.setFormat(0, f)}
                  onCloseCompare={() => session.setFormat(0, IDENTITY)}
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
                result={session.runtime[1].result}
                working={session.runtime[1].showSpinner}
                exportable={session.runtime[1].exportable}
                downloadName={session.downloadName(1)}
                onFormatChange={(f) => session.setFormat(1, f)}
              />
            </aside>
          </div>
        {/if}
      </div>
    {/if}

    <Snackbar />
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  .intro-lab-root {
    position: relative;
    box-sizing: border-box;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    font-size: 15px;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Masthead ── */
  .masthead {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 18px 28px;
    transition: opacity 200ms ease;
  }
  .masthead-right {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .tag {
    font-size: 11.5px;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--il-text-3);
  }

  /* ── Stage: headline + the featured window, centred. ── */
  .stage {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 8px 24px 20px;
    min-height: 0;
  }

  .intro-copy {
    text-align: center;
    margin-bottom: 26px;
    transition: opacity 200ms ease;
  }
  .headline {
    margin: 0 0 10px;
    font-size: clamp(26px, 3.4vw, 40px);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.04;
    color: var(--il-text-1);
  }
  .subline {
    margin: 0;
    font-size: 15px;
    color: var(--il-text-2);
  }

  /* ── The featured window: a dark app-window mock, the hero object. Reads as a
     dark product screenshot in BOTH page modes (intentional). ── */
  .window {
    position: relative;
    display: block;
    box-sizing: border-box;
    width: min(880px, calc(100vw - 48px));
    aspect-ratio: 16 / 9.6;
    padding: 0;
    border: 1px solid var(--il-border-strong);
    border-radius: 18px;
    background: #0e0e11;
    box-shadow: var(--il-shadow-card);
    overflow: hidden;
    cursor: pointer;
    appearance: none;
    font: inherit;
    color: inherit;
    transition:
      transform 220ms cubic-bezier(0.32, 0.72, 0, 1),
      border-color 200ms ease,
      box-shadow 220ms ease;
  }
  @supports (corner-shape: squircle) {
    .window {
      corner-shape: squircle;
      border-radius: 22px;
    }
  }
  .is-dragging .window {
    transform: translateY(-3px) scale(1.008);
    border-color: var(--il-accent);
    box-shadow:
      var(--il-shadow-card),
      0 0 0 1px color-mix(in srgb, var(--il-accent) 55%, transparent);
  }

  /* Back/undo cluster mock. */
  .corner-cluster {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    gap: 8px;
  }
  .corner-dot {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  /* Floating option-panel mocks. */
  .panel {
    position: absolute;
    bottom: 12px;
    width: 26%;
    height: 38%;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    border-radius: 10px;
    background: rgba(19, 19, 25, 0.85);
    border: 1px solid rgba(255, 255, 255, 0.08);
    transition: background-color 200ms ease;
  }
  .panel-left {
    left: 12px;
  }
  .panel-right {
    right: 12px;
    justify-content: flex-start;
  }
  .is-dragging .panel {
    background: rgba(28, 28, 36, 0.9);
  }
  .skel {
    height: 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.1);
  }
  .footer-bar {
    margin-top: auto;
    height: 12px;
    width: 100%;
    background: rgba(255, 255, 255, 0.18);
  }

  /* Two-up divider hint. */
  .divider {
    position: absolute;
    top: 22.5%;
    left: 50%;
    width: 1px;
    height: 55%;
    background: rgba(255, 255, 255, 0.1);
    transform: translateX(-50%);
  }

  /* The drop invite, centred over the divider. */
  .invite {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
    pointer-events: none;
  }
  .invite-glyph {
    color: rgba(245, 245, 247, 0.65);
    transition: color 200ms ease;
  }
  .is-dragging .invite-glyph {
    color: var(--il-accent);
  }
  .invite-title {
    font-size: 15.5px;
    font-weight: 700;
    color: #f5f5f7;
  }
  .invite-sub {
    font-size: 12.5px;
    color: rgba(245, 245, 247, 0.45);
  }

  /* ── Colophon ── */
  .colophon {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 14px 28px;
    border-top: 1px solid var(--il-border);
    font-size: 12.5px;
    color: var(--il-text-3);
    transition: opacity 200ms ease;
  }
  .colophon-right {
    text-align: right;
  }

  /* Hero chrome fades out as the morph takes over. */
  .faded {
    opacity: 0;
    pointer-events: none;
  }

  @media (max-width: 560px) {
    .colophon {
      flex-direction: column;
      gap: 4px;
      text-align: center;
    }
    .colophon-right {
      text-align: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .window,
    .is-dragging .window {
      transform: none;
    }
    .window {
      transition:
        border-color 200ms ease,
        box-shadow 200ms ease;
    }
  }

  /* ── Morph surface + the real editor (styles ported from src/routes/+page.svelte,
     scoped here; theme.css supplies the .editor-root token contract). ── */
  .morph {
    position: fixed;
    inset: 0;
    z-index: 30;
    background: #0e0e11;
    overflow: hidden;
  }

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

  @media (max-width: 760px) {
    .compress {
      --panel-inset: 6px;
      --fit-inset-left: 0px;
      --fit-inset-right: 0px;
    }

    :global(.editor-root .output) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset));
    }

    :global(.editor-root .controls) {
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
  }

  @media (max-width: 420px) {
    .compress {
      --mobile-options-height: 48dvh;
    }

    :global(.editor-root .controls) {
      bottom: calc(var(--mobile-options-height) + var(--panel-inset) + 6px);
      padding: 0 48px;
    }
  }
</style>
