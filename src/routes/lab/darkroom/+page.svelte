<script lang="ts">
  // darkroom — a dev-only LAB re-skin of the single-image editor, modeled on a
  // modern pro image-effects tool. Everything is REAL: it loads actual images,
  // encodes with the real pipeline, shows real sizes + real undo/redo. Only the
  // chrome and information architecture are new. Production files are untouched;
  // this subtree mirrors +page.svelte's session wiring but drops the route /
  // history-state / service-worker parts (in the lab, "Back" just clears the
  // file).
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
  import TopBar from '$lib/lab/darkroom/TopBar.svelte';
  import Rail from '$lib/lab/darkroom/Rail.svelte';
  import Flyout from '$lib/lab/darkroom/Flyout.svelte';
  import Inspector from '$lib/lab/darkroom/Inspector.svelte';
  import Filmstrip from '$lib/lab/darkroom/Filmstrip.svelte';
  import type { ThemeMode } from '$lib/lab/darkroom/ThemeToggle.svelte';
  import LabIcon from '$lib/lab/LabIcon.svelte';
  import closeIcon from '$lib/lab/icons/close.svg?raw';
  import { labSourceFile, rememberLabSource } from '$lib/lab/lab-source';
  import '$lib/editor/theme.css';
  import '$lib/lab/darkroom/darkroom.css';

  const session = new EditorSession();

  // Drives the shortcut hint in the Undo/Redo tooltips (⌘ on Apple, Ctrl else).
  let isMac = $state(false);
  const undoTip = $derived(isMac ? 'Undo (⌘Z)' : 'Undo (Ctrl+Z)');
  const redoTip = $derived(isMac ? 'Redo (⇧⌘Z)' : 'Redo (Ctrl+Shift+Z)');

  // ── Session gallery ────────────────────────────────────────────────────────
  // A real, working stepping-stone toward bulk mode. Every file entering the lab
  // (drop, Browse, "+") is appended and deduped by identity; its object URL is
  // created once and revoked on removal + on unmount. Reassign-only so Svelte
  // tracks the array.
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
    rememberLabSource(images[0]);

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
    // The lab has no route history; pickFiles' second arg (push-editor-history)
    // is a no-op here.
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

  // Drop / Browse / "+" all route here (mirrors +page.svelte's routeFiles, minus
  // bulk-store handoff — the lab's own gallery IS the batch stepping-stone).
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

  // Format tiles for the Compare flyout's "pick a format to compare against"
  // grid (only shown while side 0 is the Original).
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

    // Open straight into the editor: the file last used in any lab skin, else
    // the bundled sample. A real drop that lands first wins (checked on both
    // sides of the await).
    let alive = true;
    if (gallery.length === 0) {
      void labSourceFile().then((file) => {
        if (!alive || gallery.length > 0) return;
        addFiles([file]);
      });
    }

    return () => {
      alive = false;
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

  // Global undo/redo shortcuts, ported verbatim from +page.svelte (leaves
  // typeable fields alone so native text-undo still works).
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
  <title>darkroom — lab</title>
</svelte:head>

<svelte:window onkeydown={onKeydown} />

{#if !dev}
  <p>Not found</p>
{:else}
  <div
    class="app-root compress editor-root darkroom-root"
    class:force-light={themeMode === 'light'}
    class:force-dark={themeMode === 'dark'}
    {@attach fileDrop((files) => routeFiles(files))}
  >
    <TopBar
      exportHref={session.runtime[1].result?.outputUrl}
      exportName={session.downloadName(1)}
      exportReady={!!session.runtime[1].result &&
        !session.runtime[1].showSpinner}
      canUndo={session.history.canUndo}
      canRedo={session.history.canRedo}
      {undoTip}
      {redoTip}
      onUndo={() => session.undo()}
      onRedo={() => session.redo()}
      onAddImages={() => addInput?.click()}
    />

    {#if session.file}
      <Rail
        hasFile={!!session.file}
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
        <p class="dr-error-pill">{session.firstError}</p>
      {/if}

      <!-- The fixed right inspector always serves side 1. -->
      <aside class="dr-inspector-dock">
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
          <p class="dr-flyout-filename">{session.file.name}</p>
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
            <p class="dr-compare-caption">
              Pick a format to compare the original against — it renders on the
              left of the split.
            </p>
            <div class="dr-compare-grid">
              {#each compareTiles as tile (tile.id)}
                <button
                  type="button"
                  class="dr-compare-tile"
                  onclick={() => session.setFormat(0, tile.id as SideFormat)}
                >
                  <span class="dr-tile-label">{tile.label}</span>
                  <span class="dr-tile-ext">.{tile.ext}</span>
                </button>
              {/each}
            </div>
          {:else}
            <div class="dr-compare-active">
              <button
                type="button"
                class="dr-compare-clear"
                onclick={() => session.setFormat(0, IDENTITY)}
              >
                <LabIcon svg={closeIcon} size={13} />
                Stop comparing
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
      <div class="dr-empty">
        <div class="dr-empty-card">
          <p class="dr-empty-eyebrow">darkroom — lab</p>
          <h1 class="dr-empty-title">Drop images to start</h1>
          <p class="dr-empty-caption">Multiple files build a session strip.</p>
          <button
            type="button"
            class="dr-empty-browse"
            onclick={() => browseInput?.click()}
          >
            Browse…
          </button>
        </div>
      </div>
    {/if}

    <!-- Hidden multi file inputs (add + browse). -->
    <input
      class="dr-visually-hidden"
      type="file"
      accept="image/*"
      multiple
      bind:this={addInput}
      onchange={onAddInput}
    />
    <input
      class="dr-visually-hidden"
      type="file"
      accept="image/*"
      multiple
      bind:this={browseInput}
      onchange={onAddInput}
    />

    <Snackbar />
  </div>
{/if}
