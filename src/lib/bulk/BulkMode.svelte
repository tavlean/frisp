<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { EditorSession } from '$lib/editor/editor-session.svelte';
  import { applyRecipeToSide, recipeFromSide } from '$lib/editor/side-recipe';
  import { bulkStore } from '$lib/bulk/store.svelte';
  import { fromFileList } from '$lib/bulk/import-sources';
  import Home from '$lib/bulk/Home.svelte';
  import { applyRecipeChanges } from 'client/lazy-app/bulk';
  import { recipeSignature, type ImageRecipe } from 'client/lazy-app/recipe';

  interface Props {
    onExit: () => void;
  }

  let { onExit }: Props = $props();

  // The focus view is a real EditorSession: side 0 shows the original, side 1
  // the selected image's effective recipe. Edits flow one way, from side 1
  // into the store; a load writes the recipe in and nothing else.
  const focusSession = new EditorSession();

  let fileInput = $state<HTMLInputElement>();
  // The focus recipe as last loaded or sent. Each edit is sent as the change
  // from it (so it lands on every selected image without flattening their
  // other differences), and the load's own write compares equal by signature,
  // so it is never sent back as an edit.
  let lastFocusRecipe: ImageRecipe | null = null;

  onMount(() => () => focusSession.dispose());

  $effect(() => focusSession.seedResizeDimensions());

  $effect(() => {
    const selectedId = bulkStore.selectedId;
    untrack(() => (selectedId ? loadFocus() : clearFocus()));
  });

  $effect(() => {
    bulkStore.session.sharedRecipe;
    untrack(() => bulkStore.refreshGlobalSideFromSession());
  });

  $effect(() => {
    $state.snapshot(bulkStore.globalSide);
    bulkStore.queueGlobalSideApply(() => loadFocus());
  });

  $effect(() => {
    const recipe = $state.snapshot(
      recipeFromSide(focusSession.sides[1], focusSession.preprocessorState),
    ) as ImageRecipe;
    const before = lastFocusRecipe;
    if (!before || recipeSignature(before) === recipeSignature(recipe)) return;
    lastFocusRecipe = recipe;
    bulkStore.editSelected((target) =>
      applyRecipeChanges(target, before, recipe),
    );
  });

  /** Load the selected image and its effective recipe into the focus view. A
   *  current bulk output is adopted as the result, so it shows without a new
   *  encode; otherwise the editor encodes as usual. */
  function loadFocus(): void {
    const job = bulkStore.selectedJob;
    const recipe = job && bulkStore.effectiveRecipeFor(job.id);
    if (!job || !recipe) return;

    const transfer = new DataTransfer();
    transfer.items.add(job.sourceFile);
    // The callback is the single editor's "first open" route hook; bulk owns
    // route state, so it is inert here.
    focusSession.pickFiles(transfer.files, () => {});
    focusSession.sides[0].format = 'identity';
    focusSession.preprocessorState = applyRecipeToSide(
      recipe,
      focusSession.sides[1],
    );
    focusSession.history.clear();
    lastFocusRecipe = recipe;

    if (job.output?.settingsHash === bulkStore.settingsHashForJob(job)) {
      focusSession.adoptResult(recipe, job.output.file);
    }
  }

  function clearFocus(): void {
    lastFocusRecipe = null;
    focusSession.clearFile();
  }

  function onPick(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const files = input.files ? fromFileList(input.files) : [];
    if (files.length) void bulkStore.importFiles(files);
    input.value = '';
  }
</script>

<div class="bulk-mode editor-root">
  <div class="bulk-controls" aria-label="Bulk controls">
    <button class="back" onclick={onExit} title="Back" aria-label="Back">
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

    <button type="button" class="add-images" onclick={() => fileInput?.click()}>
      Add images
    </button>

    <input
      bind:this={fileInput}
      class="hidden-input"
      type="file"
      accept="image/*"
      multiple
      onchange={onPick}
    />
  </div>

  <Home {focusSession} onReseed={loadFocus} />
</div>

<style>
  .bulk-mode {
    position: relative;
    width: 100vw;
    min-height: 100dvh;
    overflow: hidden;
    background: var(--bg-0, #0c0c0f);
    color: var(--text-1, #f5f5f7);
  }

  .bulk-controls {
    position: fixed;
    top: 14px;
    left: 14px;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  /* Back button: a circular glass control in the top-left corner. */
  .back {
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

  .add-images {
    height: 40px;
    border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
    border-radius: 999px;
    padding: 0 14px;
    background: var(--surface, rgba(19, 19, 25, 0.82));
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    color: var(--text-1, #f5f5f7);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
    cursor: pointer;
    font: inherit;
    font-weight: 750;
    transition:
      background-color 150ms ease,
      border-color 150ms ease,
      transform 150ms ease;
  }
  .add-images:hover {
    background: var(--surface-raise-2, rgba(255, 255, 255, 0.09));
    border-color: var(--border-strong, rgba(255, 255, 255, 0.16));
    transform: translateY(-1px);
  }
  .add-images:focus-visible {
    outline: 2px solid var(--accent-1, #ff8a5e);
    outline-offset: 2px;
  }

  .hidden-input {
    display: none;
  }

  /* Compact under the SAME conditions that summon FocusView's phone summary
     bar (max-height 500px included) — its --bulk-topbar-h: 44px offset assumes
     this 8px + 36px cluster footprint. */
  @media (max-width: 760px), (max-height: 500px) {
    .bulk-controls {
      top: 8px;
      left: 8px;
      gap: 6px;
    }

    .back {
      width: 36px;
      height: 36px;
    }
    .back svg {
      width: 16px;
      height: 16px;
    }

    .add-images {
      height: 36px;
      padding: 0 12px;
      font-size: 0.95rem;
    }
  }
</style>
