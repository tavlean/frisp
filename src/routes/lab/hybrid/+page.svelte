<script lang="ts">
  // hybrid — a dev-only LAB experiment fusing the two prior lab re-skins:
  // darkroom's INFORMATION ARCHITECTURE (top bar + left icon rail + flyouts +
  // right inspector + a single bottom bar carrying the session strip AND the
  // docked canvas zoom cluster) wearing porcelain's SKIN (light/airy squircle
  // surfaces). Everything is REAL: a live EditorSession loads images, encodes
  // with the production pipeline, reports real sizes + real undo/redo. Only the
  // chrome is new. No production file is modified; +page.ts opts this subtree out
  // of prerender/SSR and we hard-guard on `dev` below. Session wiring mirrors the
  // other labs but drops route/history-state/service-worker parts (here "Back"
  // just clears the file, and the gallery is the batch stepping-stone).
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import Output from '$lib/editor/output/Output.svelte';
  import Snackbar from '$lib/editor/Snackbar.svelte';
  import ImageInfoRows from '$lib/editor/ImageInfoRows.svelte';
  import { fileDrop } from '$lib/editor/file-drop';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import { IDENTITY, type SideFormat } from '$lib/compress';
  import { isSupportedBulkImage } from 'client/lazy-app/bulk';
  import type { ImportedFile } from '$lib/bulk/import-sources';
  import TopBar from '$lib/lab/hybrid/TopBar.svelte';
  import Rail from '$lib/lab/hybrid/Rail.svelte';
  import Flyout from '$lib/lab/hybrid/Flyout.svelte';
  import Inspector from '$lib/lab/hybrid/Inspector.svelte';
  import Filmstrip from '$lib/lab/hybrid/Filmstrip.svelte';
  import type { ThemeMode } from '$lib/lab/hybrid/ThemeToggle.svelte';
  import '$lib/editor/theme.css';
  import '$lib/lab/hybrid/hybrid.css';

  const session = new EditorSession();

  // Drives the ⌘/Ctrl hint in the TopBar tooltips (⌘ on Apple, Ctrl else).
  let isMac = $state(false);

  // ── Session gallery ────────────────────────────────────────────────────────
  // A real, working stepping-stone toward bulk mode. Every file entering the lab
  // (drop, "+") is appended and deduped by identity; its object URL is created
  // once and revoked on removal + on unmount. Reassign-only so Svelte tracks it.
  interface GalleryEntry {
    id: string;
    file: File;
    url: string;
  }
  let gallery = $state<GalleryEntry[]>([]);

  const entryId = (file: File) =>
    `${file.name}:${file.size}:${file.lastModified}`;

  const galleryView = $derived(
    gallery.map((entry) => ({
      id: entry.id,
      name: entry.file.name,
      url: entry.url,
      active: session.file ? entryId(session.file) === entry.id : false,
    })),
  );

  /** Append new files (deduped), create their URLs, and load the FIRST new one. */
  function addFiles(files: File[]): void {
    const images = files.filter((file) => file.type.startsWith('image/'));
    if (images.length === 0) return;

    let firstNew: File | null = null;
    for (const file of images) {
      const id = entryId(file);
      if (gallery.some((entry) => entry.id === id)) continue;
      gallery.push({ id, file, url: URL.createObjectURL(file) });
      if (!firstNew) firstNew = file;
    }
    // If everything was a duplicate, load the first dropped one anyway so the
    // gesture isn't a no-op.
    const toLoad = firstNew ?? images[0];
    if (toLoad) loadFile(toLoad);
  }

  function loadFile(file: File): void {
    // The lab has no route history; pickFiles' second arg is a no-op here.
    session.pickFiles([file], () => {});
  }

  function removeEntry(id: string): void {
    const index = gallery.findIndex((entry) => entry.id === id);
    if (index === -1) return;
    const [removed] = gallery.splice(index, 1);
    URL.revokeObjectURL(removed.url);

    const wasActive = session.file && entryId(session.file) === id;
    if (!wasActive) return;
    // Load the next remaining entry (prefer the one now at this index), else
    // clear back to the no-file state.
    const next = gallery[index] ?? gallery[gallery.length - 1];
    if (next) loadFile(next.file);
    else session.clearFile();
  }

  // Drop / "+" / Browse all route here (mirrors the other labs' routeFiles, minus
  // any bulk-store handoff — the lab's own gallery IS the batch stepping-stone).
  function routeFiles(imported: ImportedFile[]): void {
    const files = imported
      .map((item) => item.file)
      .filter((file) => isSupportedBulkImage(file));
    if (files.length === 0) return;
    addFiles(files);
  }

  // ── File inputs ────────────────────────────────────────────────────────────
  let addInput = $state<HTMLInputElement>();
  let browseInput = $state<HTMLInputElement>();

  function onAddInput(event: Event): void {
    const input = event.currentTarget as HTMLInputElement;
    if (input.files) addFiles(Array.from(input.files));
    input.value = '';
  }

  // ── Flyouts ────────────────────────────────────────────────────────────────
  let openFlyout = $state<'info' | 'compare' | null>(null);
  let infoBtn = $state<HTMLButtonElement>();
  let compareBtn = $state<HTMLButtonElement>();

  function toggleFlyout(which: 'info' | 'compare'): void {
    openFlyout = openFlyout === which ? null : which;
  }

  // Format tiles for the Compare flyout's "pick a format to compare against" grid
  // (only shown while side 0 is the Original).
  const compareTiles = session.availableFormats;

  // ── Theme ──────────────────────────────────────────────────────────────────
  // Default = System; the toggle cycles System → Light → Dark. `resolved` tracks
  // the live system appearance so the sun/moon glyph is correct in System mode.
  let themeMode = $state<ThemeMode>('system');
  let systemDark = $state(true);
  const themeResolved = $derived<'light' | 'dark'>(
    themeMode === 'system' ? (systemDark ? 'dark' : 'light') : themeMode,
  );

  function cycleTheme(): void {
    themeMode =
      themeMode === 'system'
        ? 'light'
        : themeMode === 'light'
          ? 'dark'
          : 'system';
  }

  onMount(() => {
    isMac = /mac|iphone|ipad/i.test(
      navigator.platform || navigator.userAgent || '',
    );

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    systemDark = media.matches;
    const onMedia = (event: MediaQueryListEvent) =>
      (systemDark = event.matches);
    media.addEventListener('change', onMedia);

    return () => {
      media.removeEventListener('change', onMedia);
      // Revoke every gallery object URL and dispose the session's workers/effects.
      for (const entry of gallery) URL.revokeObjectURL(entry.url);
      session.dispose();
    };
  });

  // The per-side encode + spinner effects live inside EditorSession; the shell
  // keeps only the two effects the production page also keeps (seed + persist).
  $effect(() => session.seedResizeDimensions());
  $effect(() => session.persistSettings());

  // Global undo/redo shortcuts, ported verbatim from production +page.svelte
  // (leaves typeable fields alone so native text-undo still works).
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

  function back(): void {
    openFlyout = null;
    session.clearFile();
  }
</script>

<svelte:head>
  <title>hybrid — lab</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#if !dev}
  <p>Not found</p>
{:else}
  <div
    class="app-root compress editor-root hybrid-root"
    class:force-light={themeMode === 'light'}
    class:force-dark={themeMode === 'dark'}
    {@attach fileDrop((files) => routeFiles(files))}
  >
    <TopBar {session} {isMac} onAddImages={() => addInput?.click()} />

    {#if session.file}
      <Rail
        {openFlyout}
        {themeMode}
        {themeResolved}
        bind:infoBtn
        bind:compareBtn
        onBack={back}
        onToggleFlyout={toggleFlyout}
        onRotate={() => session.rotate()}
        onCycleTheme={cycleTheme}
      />

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
        <p class="hy-error-pill" role="alert">{session.firstError}</p>
      {/if}

      <!-- The fixed right inspector always serves side 1. -->
      <aside class="hy-inspector-dock">
        <Inspector
          side={1}
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
          canImport={session.canImport[1]}
          downloadName={session.downloadName(1)}
          onFormatChange={(f) => session.setFormat(1, f)}
          onCopy={() => session.copyToOther(1)}
          onSave={() => session.saveSide(1)}
          onImport={() => session.importSide(1)}
        />
      </aside>

      {#if openFlyout === 'info'}
        <Flyout
          title="Image info"
          anchorTop={96}
          onClose={() => (openFlyout = null)}
          focusOnClose={() => infoBtn}
        >
          <p class="hy-flyout-filename">{session.file.name}</p>
          <ImageInfoRows
            file={session.file}
            width={session.naturalWidth}
            height={session.naturalHeight}
          />
        </Flyout>
      {:else if openFlyout === 'compare'}
        <Flyout
          title={session.sides[0].format === IDENTITY
            ? 'Compare'
            : `Compare — ${session.availableFormats.find((f) => f.id === session.sides[0].format)?.label ?? ''}`}
          anchorTop={140}
          onClose={() => (openFlyout = null)}
          focusOnClose={() => compareBtn}
        >
          {#if session.sides[0].format === IDENTITY}
            <p class="hy-compare-caption">
              Pick a format to compare the original against — it renders on the
              left of the split.
            </p>
            <div class="hy-compare-grid">
              {#each compareTiles as tile (tile.id)}
                <button
                  type="button"
                  class="hy-compare-tile"
                  title={tile.tooltip}
                  onclick={() => session.setFormat(0, tile.id as SideFormat)}
                >
                  <span class="hy-tile-label">{tile.label}</span>
                  <span class="hy-tile-ext">{tile.ext.toUpperCase()}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="hy-compare-active">
              <button
                type="button"
                class="hy-compare-clear"
                onclick={() => session.setFormat(0, IDENTITY)}
              >
                ✕ Compare — {session.availableFormats.find(
                  (f) => f.id === session.sides[0].format,
                )?.label ?? ''}
              </button>
              <Inspector
                side={0}
                compact
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
                canImport={session.canImport[0]}
                downloadName={session.downloadName(0)}
                onFormatChange={(f) => session.setFormat(0, f)}
                onCopy={() => session.copyToOther(0)}
                onSave={() => session.saveSide(0)}
                onImport={() => session.importSide(0)}
              />
            </div>
          {/if}
        </Flyout>
      {/if}

      <Filmstrip
        entries={galleryView}
        onPick={(id) => {
          const entry = gallery.find((e) => e.id === id);
          if (entry) loadFile(entry.file);
        }}
        onRemove={removeEntry}
        onAdd={() => addInput?.click()}
      />
    {:else}
      <div class="hy-empty">
        <div class="hy-empty-card">
          <span class="hy-empty-eyebrow">hybrid — lab</span>
          <p class="hy-empty-title">Drop images to start</p>
          <p class="hy-empty-caption">Multiple files build a session strip.</p>
          <button
            type="button"
            class="hy-empty-browse"
            onclick={() => browseInput?.click()}
          >
            Browse…
          </button>
        </div>
      </div>
    {/if}

    <!-- Hidden multi file inputs (add + browse). -->
    <input
      class="hy-visually-hidden"
      type="file"
      accept="image/*"
      multiple
      bind:this={addInput}
      onchange={onAddInput}
    />
    <input
      class="hy-visually-hidden"
      type="file"
      accept="image/*"
      multiple
      bind:this={browseInput}
      onchange={onAddInput}
    />

    <Snackbar />
  </div>
{/if}

<style>
  /* ── Fixed inspector dock (right column) — porcelain white panel ─────────── */
  .hy-inspector-dock {
    position: fixed;
    top: calc(var(--hy-margin) + var(--hy-topbar-h) + 8px);
    right: var(--hy-margin);
    bottom: calc(var(--hy-margin) + var(--hy-bar-h) + 8px);
    width: var(--hy-inspector-w);
    z-index: 20;
    display: flex;
    flex-direction: column;
    border-radius: 18px;
    border: 1px solid var(--pc-border);
    background: var(--pc-panel);
    box-shadow: var(--pc-shadow-panel);
    overflow: hidden;
  }
  @supports (corner-shape: squircle) {
    .hy-inspector-dock {
      corner-shape: squircle;
      border-radius: 22px;
    }
  }

  /* ── Error pill: porcelain surface pill, red text ───────────────────────── */
  .hy-error-pill {
    position: fixed;
    top: calc(var(--hy-margin) + var(--hy-topbar-h) + 12px);
    left: 50%;
    transform: translateX(-50%);
    z-index: 26;
    margin: 0;
    padding: 7px 16px;
    border-radius: 999px;
    border: 1px solid var(--pc-border);
    background: var(--pc-surface);
    box-shadow: var(--pc-shadow-control);
    color: var(--bad);
    font-size: 13px;
    font-weight: 600;
    pointer-events: none;
    max-width: 60vw;
  }

  /* ── Flyout content owned by the page ───────────────────────────────────── */
  .hy-flyout-filename {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
    color: var(--pc-text-1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hy-compare-caption {
    margin: 0 0 12px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--pc-text-2);
  }

  .hy-compare-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .hy-compare-tile {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 12px 12px;
    border-radius: 12px;
    border: 1px solid var(--pc-border);
    background: var(--pc-raise);
    color: var(--pc-text-1);
    cursor: pointer;
    font: inherit;
    text-align: left;
    box-shadow: var(--pc-shadow-control);
    transition:
      transform 140ms ease,
      border-color 140ms ease;
  }
  @supports (corner-shape: squircle) {
    .hy-compare-tile {
      corner-shape: squircle;
      border-radius: 14px;
    }
  }
  .hy-compare-tile:hover {
    transform: translateY(-2px);
    border-color: var(--pc-border-strong);
  }
  .hy-compare-tile:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  .hy-tile-label {
    font-size: 14px;
    font-weight: 600;
  }
  .hy-tile-ext {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--pc-text-3);
  }

  .hy-compare-active {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: -6px -6px 0;
  }

  .hy-compare-clear {
    align-self: flex-start;
    margin: 0 6px;
    padding: 6px 10px;
    border-radius: 9px;
    border: 1px solid var(--pc-border);
    background: var(--pc-raise);
    color: var(--pc-text-2);
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    max-width: calc(100% - 12px);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    box-shadow: var(--pc-shadow-control);
    transition:
      color 140ms ease,
      background-color 140ms ease;
  }
  .hy-compare-clear:hover {
    color: var(--pc-text-1);
    background: var(--pc-inset);
  }
  .hy-compare-clear:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  /* ── No-file drop state — porcelain drop card ───────────────────────────── */
  .hy-empty {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
  }

  .hy-empty-card {
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
    .hy-empty-card {
      corner-shape: squircle;
      border-radius: 24px;
    }
  }

  .hy-empty-eyebrow {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--pc-text-3);
  }

  .hy-empty-title {
    margin: 2px 0 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--pc-text-1);
  }

  .hy-empty-caption {
    margin: 0 0 6px;
    font-size: 13px;
    line-height: 1.45;
    color: var(--pc-text-2);
  }

  .hy-empty-browse {
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
    .hy-empty-browse {
      corner-shape: squircle;
      border-radius: 13px;
    }
  }
  .hy-empty-browse:hover {
    border-color: var(--pc-border-strong);
    transform: translateY(-1px);
  }
  .hy-empty-browse:focus-visible {
    outline: 2px solid var(--pc-focus);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .hy-compare-tile,
    .hy-empty-browse {
      transition-duration: 0ms;
    }
  }
</style>
