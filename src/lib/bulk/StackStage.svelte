<script lang="ts">
  // THE STACK — the resting stage for the global / multi-select scope.
  //
  // Instead of a dead empty canvas, the stage holds the batch as a fanned stack
  // of cards: the anchor image is the centred top card (a BEFORE/AFTER split of
  // original vs optimized), the rest peek out behind it, alternating left/right
  // with growing offset + rotation so depth reads at a glance. It is a resting
  // COMPOSITION, not the production inspector — the split is a lightweight
  // CSS-clipped pairing of the full source image (original) and the engine's
  // output download URL (optimized), never the pinch-zoom two-up.
  //
  // Which images: nothing selected → the whole batch (anchor = first image);
  // a multi-selection (N>1) → exactly those, anchor on top. The parent only
  // mounts this for those two cases; a single selection is the real focus view.
  //
  // Interactions: click the top card → select that image (opens the focus view);
  // click a peeking card → bring it to the top (a local cycle, no selection
  // change); ←/→ cycle the top card. Cards whose job is mid-encode wear a
  // delayed shimmer so a global change visibly ripples through the fan.
  import { SvelteSet } from 'svelte/reactivity';
  import { innerHeight, innerWidth } from 'svelte/reactivity/window';
  import type { BulkStripItem } from 'client/lazy-app/bulk';
  import { bulkStore } from './store.svelte';
  import DeltaPill from './DeltaPill.svelte';

  interface Props {
    items: BulkStripItem[];
    /** Stage-toolbar zoom (1 = fit). Scales the whole fan via a CSS transform. */
    zoom?: number;
    /** Stage-toolbar smoothing toggle → image-rendering:pixelated on the cards. */
    pixelated?: boolean;
  }

  let { items, zoom = 1, pixelated = false }: Props = $props();

  // Track viewport width so the top card can stay in the usable centre corridor
  // while the peeks fan out toward the real stage edges.
  const viewportWidth = $derived(innerWidth.current ?? 1280);
  const viewportHeight = $derived(innerHeight.current ?? 800);
  let stageWidth = $state(1280);
  const DESKTOP_PANEL_CORRIDOR = 680;
  const MAX_CARD_WIDTH = 680;
  const MIN_CARD_WIDTH = 180;
  const FAN_EDGE_INSET = 34;
  const MIN_USABLE_REVEAL = 34;
  const DESKTOP_REVEAL_RATIO = 0.075;
  const MAX_COMFORT_REVEAL = 52;
  const MIN_PEEK_SCALE = 0.74;
  const STACK_MOTION_MS = 290;
  const COMPACT_STRIP_HEIGHT = 148;
  const COMPACT_STAGE_TOP_PAD = 72;
  const COMPACT_STAGE_TOOLBAR_PAD = 44;
  const COMPACT_OPTIONS_HEIGHT_RATIO = 0.44;
  const COMPACT_OPTIONS_HEIGHT_MAX = 360;

  type CardSlot = {
    item: BulkStripItem;
    depth: number;
    x: number;
    y: number;
    rotation: number;
    scale: number;
    opacity: number;
  };

  function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  // Local cycle pointer: which item is currently on top. It's an OFFSET into the
  // incoming order, so ←/→ and peek-clicks rotate the fan without touching the
  // engine selection. Reset whenever the underlying set changes (add/remove/
  // reselect) so a stale pointer can't point past the end.
  let frontOffset = $state(0);
  // Plain (non-reactive) marker of the last item set we reset for. Reading it in
  // the effect must NOT create a dependency, so it stays a bare local.
  let lastSignature = '';

  const signature = $derived(items.map((item) => item.id).join('|'));
  // Reset the local cycle pointer whenever the underlying set changes (add /
  // remove / reselect) so it can never point past the new end.
  $effect(() => {
    if (signature !== lastSignature) {
      lastSignature = signature;
      frontOffset = 0;
    }
  });

  // The visible order: rotate the incoming list so `frontOffset` sits first.
  const ordered = $derived.by(() => {
    if (items.length === 0) return [] as BulkStripItem[];
    const n = items.length;
    const start = ((frontOffset % n) + n) % n;
    return [...items.slice(start), ...items.slice(0, start)];
  });

  const total = $derived(ordered.length);
  const topItem = $derived(ordered[0]);

  const topThumb = $derived(
    topItem ? bulkStore.thumbs.get(topItem.id)?.url : undefined,
  );
  const topSourceUrl = $derived(
    topItem ? bulkStore.sourceUrlFor(topItem.id) : undefined,
  );
  const topDownload = $derived(
    topItem ? bulkStore.downloadFor(topItem.id) : undefined,
  );
  const topHasOutput = $derived(
    !!topItem &&
      topItem.outputSize !== undefined &&
      topItem.percentChange !== undefined,
  );

  // 500ms-delayed working treatment, per the strip's no-flicker rule: a card
  // only shimmers if its job stays active past the threshold.
  const activeIds = $derived(
    new Set(
      items.filter((item) => item.statusGroup === 'active').map((i) => i.id),
    ),
  );

  const topCardWidth = $derived.by(() => {
    const desired =
      viewportWidth <= 620
        ? clamp(viewportWidth * 0.58, MIN_CARD_WIDTH, 300)
        : clamp(viewportWidth * 0.48, 240, MAX_CARD_WIDTH);
    if (viewportWidth <= 900) {
      if (viewportWidth <= 620 || viewportHeight <= 500) return desired;
      const stageHeight = viewportHeight - COMPACT_STRIP_HEIGHT;
      const optionsHeight = Math.min(
        viewportHeight * COMPACT_OPTIONS_HEIGHT_RATIO,
        COMPACT_OPTIONS_HEIGHT_MAX,
      );
      const freeHeight =
        stageHeight -
        COMPACT_STAGE_TOP_PAD -
        optionsHeight -
        COMPACT_STAGE_TOOLBAR_PAD;
      return Math.min(desired, Math.max(MIN_CARD_WIDTH, freeHeight * (4 / 3)));
    }
    const corridor = Math.max(240, viewportWidth - DESKTOP_PANEL_CORRIDOR);
    return Math.min(desired, corridor);
  });
  const fanTargetWidth = $derived(
    Math.max(topCardWidth, Math.max(stageWidth, 1) - FAN_EDGE_INSET * 2),
  );
  const availableSpreadPerSide = $derived(
    Math.max(0, (fanTargetWidth - topCardWidth) / 2),
  );
  const peekRevealTarget = $derived(
    clamp(
      topCardWidth * DESKTOP_REVEAL_RATIO,
      MIN_USABLE_REVEAL,
      MAX_COMFORT_REVEAL,
    ),
  );
  const visiblePeekCount = $derived.by(() => {
    const available = Math.max(0, total - 1);
    if (available === 0) return 0;
    if (availableSpreadPerSide < MIN_USABLE_REVEAL) return 1;
    const perSideCapacity = Math.max(
      1,
      Math.floor(availableSpreadPerSide / peekRevealTarget),
    );
    return Math.min(available, perSideCapacity * 2);
  });
  const visibleCards = $derived(ordered.slice(0, 1 + visiblePeekCount));
  const hiddenCount = $derived(Math.max(0, total - visibleCards.length));

  function peekScale(sideRank: number): number {
    return Math.max(MIN_PEEK_SCALE, 1 - sideRank * 0.035);
  }

  function rotatedHalfWidth(scale: number, rotation: number): number {
    const radians = (Math.abs(rotation) * Math.PI) / 180;
    const halfWidth = topCardWidth / 2;
    const halfHeight = (topCardWidth * 0.75) / 2;
    return (
      scale * (halfWidth * Math.cos(radians) + halfHeight * Math.sin(radians))
    );
  }

  const cardSlots = $derived.by(() => {
    const peekCount = Math.max(0, visibleCards.length - 1);
    const leftCount = Math.ceil(peekCount / 2);
    const rightCount = Math.floor(peekCount / 2);
    const fanHalfWidth = fanTargetWidth / 2;

    return visibleCards.map((item, index): CardSlot => {
      if (index === 0) {
        return {
          item,
          depth: 0,
          x: 0,
          y: 0,
          rotation: 0,
          scale: 1,
          opacity: 1,
        };
      }

      if (peekCount === 1) {
        return {
          item,
          depth: index,
          x: 0,
          y: 22,
          rotation: -1.8,
          scale: 0.96,
          opacity: 0.88,
        };
      }

      const side = index % 2 === 1 ? -1 : 1;
      const sideRank = side === -1 ? Math.ceil(index / 2) : index / 2;
      const sideCount = side === -1 ? leftCount : rightCount;
      const scale = peekScale(sideRank);
      const rotation = side * (2.35 + sideRank * 0.72);
      const farScale = peekScale(sideCount);
      const farRotation = 2.35 + sideCount * 0.72;
      const farCenter = Math.max(
        MIN_USABLE_REVEAL,
        fanHalfWidth - rotatedHalfWidth(farScale, farRotation),
      );
      const x = side * farCenter * (sideRank / Math.max(1, sideCount));

      return {
        item,
        depth: index,
        x,
        y: 12 + sideRank * 13 + index * 0.75,
        rotation,
        scale,
        opacity: Math.max(0.58, 1 - sideRank * 0.065 - index * 0.012),
      };
    });
  });
  const renderSlots = $derived.by(() => {
    const order = new Map(items.map((item, index) => [item.id, index]));
    return [...cardSlots].sort(
      (a, b) => (order.get(a.item.id) ?? 0) - (order.get(b.item.id) ?? 0),
    );
  });
  const shimmerIds = new SvelteSet<string>();
  $effect(() => {
    const current = activeIds;
    const timers: ReturnType<typeof setTimeout>[] = [];
    // Drop shimmer for anything no longer active.
    for (const id of [...shimmerIds]) {
      if (!current.has(id)) shimmerIds.delete(id);
    }
    // Arm a delayed shimmer for newly-active cards (500ms no-flicker rule).
    for (const id of current) {
      if (shimmerIds.has(id)) continue;
      timers.push(
        setTimeout(() => {
          if (activeIds.has(id)) shimmerIds.add(id);
        }, 500),
      );
    }
    return () => timers.forEach(clearTimeout);
  });

  // Geometry: slot each visible card from the measured stage width. The top
  // card stays fixed at centre; peeks split across both sides and each side's
  // far card lands on the same outer extent, even when one side has an extra
  // card. Depth index 1 = closest behind, larger = deeper.
  function cardTransform(slot: CardSlot): string {
    return `translate(-50%, -50%) translate(${slot.x}px, ${slot.y}px) rotate(${
      slot.rotation
    }deg) scale(${slot.scale})`;
  }

  // ── Top-card before/after divider ──────────────────────────────────────────
  // A REAL draggable split on the top card (the white line used to look like a
  // before/after slider but was inert). `splitPct` is the divider's horizontal
  // position as a 0–100% of the card; the before-half is clipped to its left,
  // the after-half to its right. Pointer-drag on the handle updates it (clamped
  // 4–96% so a sliver of each side always shows); ←/→ arrows nudge it when the
  // handle is focused. Lightweight — no zoom coupling, unlike the two-up.
  const SPLIT_MIN = 4;
  const SPLIT_MAX = 96;
  let splitPct = $state(50);
  let splitCardEl = $state<HTMLElement>();

  // Reset the divider to centre whenever the top card changes, so a new anchor
  // never inherits the previous card's drag position.
  let lastSplitTopId = '';
  $effect(() => {
    const id = topItem?.id ?? '';
    if (id !== lastSplitTopId) {
      lastSplitTopId = id;
      splitPct = 50;
    }
  });

  function clampSplit(value: number): number {
    return Math.min(SPLIT_MAX, Math.max(SPLIT_MIN, value));
  }

  function splitFromClientX(clientX: number): void {
    const el = splitCardEl;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0) return;
    splitPct = clampSplit(((clientX - rect.left) / rect.width) * 100);
  }

  // Track the active drag by pointer id (not by hasPointerCapture) so a move
  // still updates the split even if capture was never granted; capture is a
  // best-effort convenience (keeps the pointer targeting the handle off-card).
  let draggingPointerId: number | null = null;

  function onDividerPointerdown(event: PointerEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    draggingPointerId = event.pointerId;
    const handle = event.currentTarget as HTMLElement;
    try {
      handle.setPointerCapture(event.pointerId);
    } catch {
      // Capture is optional — the id-tracked drag below works regardless.
    }
    splitFromClientX(event.clientX);
  }
  function onDividerPointermove(event: PointerEvent): void {
    if (draggingPointerId !== event.pointerId) return;
    event.preventDefault();
    splitFromClientX(event.clientX);
  }
  function onDividerPointerup(event: PointerEvent): void {
    if (draggingPointerId !== event.pointerId) return;
    draggingPointerId = null;
    const handle = event.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(event.pointerId)) {
      handle.releasePointerCapture(event.pointerId);
    }
  }
  function onDividerKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      event.stopPropagation();
      splitPct = clampSplit(splitPct - (event.shiftKey ? 10 : 2));
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      event.stopPropagation();
      splitPct = clampSplit(splitPct + (event.shiftKey ? 10 : 2));
    } else if (event.key === 'Home') {
      event.preventDefault();
      splitPct = SPLIT_MIN;
    } else if (event.key === 'End') {
      event.preventDefault();
      splitPct = SPLIT_MAX;
    }
  }

  function selectTop(): void {
    if (!topItem) return;
    bulkStore.select(topItem.id);
  }

  function bringToTop(id: string): void {
    const index = ordered.findIndex((item) => item.id === id);
    if (index <= 0) return;
    frontOffset = (frontOffset + index) % Math.max(1, total);
  }

  function cycle(direction: 1 | -1): void {
    if (total < 2) return;
    frontOffset = (frontOffset + direction + total) % total;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (total < 2) return;
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      cycle(-1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      cycle(1);
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if topItem}
  <div
    class="stack-stage"
    role="group"
    aria-label="Batch stack"
    bind:clientWidth={stageWidth}
    style:--stack-motion-duration={`${STACK_MOTION_MS}ms`}
  >
    <div
      class="stack"
      style:--card-count={total}
      style:--stack-zoom={zoom}
      style:--stack-card-width={`${topCardWidth}px`}
    >
      <!-- Cards keep stable DOM order; z-index handles paint order. That lets a
           keyed image travel to its new slot via transform instead of being
           replaced or reordered under the browser. -->
      {#each renderSlots as slot (slot.item.id)}
        {@const item = slot.item}
        {@const isTop = slot.depth === 0}
        {@const isDeepest = slot.depth === visiblePeekCount && hiddenCount > 0}
        {@const peekSource = isTop
          ? undefined
          : bulkStore.sourceUrlFor(item.id)}
        <div
          class="card"
          class:top={isTop}
          class:peek={!isTop}
          class:shimmer={shimmerIds.has(item.id)}
          style:transform={cardTransform(slot)}
          style:opacity={slot.opacity}
          style:--split={`${splitPct}%`}
          style:z-index={isTop ? 120 : 100 - slot.depth}
        >
          {#if isTop}
            <!-- Top card: the anchor, shown as a BEFORE / AFTER split. Clicking
                 it opens the real focus view for that image. -->
            <button
              type="button"
              class="top-hit"
              title={`Open ${item.fileName}`}
              aria-label={`Open ${item.fileName}`}
              onclick={selectTop}
            >
              <div class="split" bind:this={splitCardEl}>
                <!-- LEFT (original) half: full-quality source object URL,
                     clipped to the divider position. The right half keeps the
                     real output URL. -->
                <div class="half side-before">
                  {#if topSourceUrl}
                    <img
                      src={topSourceUrl}
                      alt=""
                      draggable="false"
                      class:pixelated
                    />
                  {:else if topThumb}
                    <img
                      src={topThumb}
                      alt=""
                      draggable="false"
                      class:pixelated
                    />
                  {:else}
                    <span class="placeholder" aria-hidden="true"></span>
                  {/if}
                </div>
                <div class="half side-after">
                  {#if topDownload?.url}
                    <img
                      src={topDownload.url}
                      alt=""
                      draggable="false"
                      class:pixelated
                    />
                  {:else if topThumb}
                    <img
                      src={topThumb}
                      alt=""
                      draggable="false"
                      class="dim"
                      class:pixelated
                    />
                  {:else}
                    <span class="placeholder" aria-hidden="true"></span>
                  {/if}
                </div>

                <span class="chip left">Original</span>
                <span class="chip right">
                  WebP
                  {#if topHasOutput}
                    <DeltaPill
                      percent={topItem.percentChange!}
                      variant="bare"
                    />
                  {/if}
                </span>
              </div>

              {#if shimmerIds.has(item.id)}
                <span class="shimmer-veil" aria-hidden="true"></span>
              {/if}
            </button>

            <!-- REAL before/after divider: a draggable handle (pointer +
                 keyboard), clamped, with a production-style scrubber affordance
                 like the two-up's. Sits above the top-hit button so its
                 gestures don't open the image. -->
            <div
              class="divider"
              role="slider"
              tabindex="0"
              aria-label="Before / after divider"
              aria-valuemin={SPLIT_MIN}
              aria-valuemax={SPLIT_MAX}
              aria-valuenow={Math.round(splitPct)}
              aria-orientation="horizontal"
              onpointerdown={onDividerPointerdown}
              onpointermove={onDividerPointermove}
              onpointerup={onDividerPointerup}
              onpointercancel={onDividerPointerup}
              onkeydown={onDividerKeydown}
            >
              <span class="divider-line" aria-hidden="true"></span>
              <span class="divider-scrubber" aria-hidden="true">
                <svg viewBox="0 0 27 20" aria-hidden="true">
                  <path class="arrow-left" d="M9.6 0L0 9.6l9.6 9.6z" />
                  <path class="arrow-right" d="M17 19.2l9.5-9.6L16.9 0z" />
                </svg>
              </span>
            </div>

            {#if item.hasOverrides}
              <span class="override-dot top-dot" aria-label="Custom settings"
              ></span>
            {/if}
          {:else}
            <button
              type="button"
              class="peek-hit"
              title={`Bring ${item.fileName} to front`}
              aria-label={`Bring ${item.fileName} to front`}
              onclick={() => bringToTop(item.id)}
            >
              {#if peekSource}
                <img
                  src={peekSource}
                  alt=""
                  draggable="false"
                  class:pixelated
                />
              {:else}
                <span class="placeholder" aria-hidden="true"></span>
              {/if}
              {#if item.hasOverrides}
                <span class="override-dot" aria-label="Custom settings"></span>
              {/if}
              {#if isDeepest}
                <span class="more-chip">+{hiddenCount}</span>
              {/if}
              {#if shimmerIds.has(item.id)}
                <span class="shimmer-veil" aria-hidden="true"></span>
              {/if}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}

<style>
  .stack-stage {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 24px;
    box-sizing: border-box;
    /* Let the strip / panels above/below stay reachable; the fan itself is the
       only pointer surface. */
    pointer-events: none;
    --stack-ease: cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* The fan lives in a fixed-height positioning frame so the absolutely-placed
     cards have a stable centre to orbit. The top card's width is supplied by
     JS so the fan can span the stage while the divider remains reachable. */
  .stack {
    position: relative;
    width: var(--stack-card-width, 640px);
    height: calc(var(--stack-card-width, 640px) * 0.75);
    transform: scale(var(--stack-zoom, 1));
    transition: transform var(--stack-motion-duration) var(--stack-ease);
    pointer-events: none;
  }

  .card {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    aspect-ratio: 4 / 3;
    margin: 0;
    padding: 0;
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.16));
    border-radius: 16px;
    background: var(--surface-solid, #16161c);
    overflow: hidden;
    pointer-events: auto;
    box-shadow: 0 30px 60px -24px rgba(0, 0, 0, 0.7);
    will-change: transform, opacity;
    transition:
      transform var(--stack-motion-duration) var(--stack-ease),
      opacity var(--stack-motion-duration) var(--stack-ease);
  }

  .card img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .card img.dim {
    opacity: 0.5;
  }
  .card img.pixelated {
    image-rendering: crisp-edges;
    image-rendering: pixelated;
  }

  .placeholder {
    position: absolute;
    inset: 0;
    background: linear-gradient(
      135deg,
      var(--surface-raise, rgba(255, 255, 255, 0.06)),
      transparent
    );
  }

  /* ── Peeking cards ─────────────────────────────────────────────────────── */
  .peek {
    cursor: pointer;
    /* A darkening scrim keeps the peeks reading as "behind", so the top card
       stays the clear focus. */
    filter: brightness(0.72) saturate(0.9);
  }
  .peek::after {
    content: '';
    position: absolute;
    inset: 0;
    background: rgba(6, 6, 9, 0.28);
    pointer-events: none;
  }
  .peek:hover {
    filter: brightness(0.92) saturate(0.95);
    border-color: var(--accent-2, #53b2ff);
  }
  .peek-hit {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }
  .peek-hit:focus-visible {
    outline: 2px solid var(--accent-2, #53b2ff);
    outline-offset: 2px;
    border-radius: 16px;
  }

  .more-chip {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 2;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(12, 12, 15, 0.72);
    border: 1px solid var(--border-strong, rgba(255, 255, 255, 0.18));
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: var(--text-1, #f5f5f7);
    font-size: 1.05rem;
    font-weight: 750;
    font-variant-numeric: tabular-nums;
  }

  /* ── Top card + before/after split ─────────────────────────────────────── */
  .top {
    box-shadow: 0 40px 80px -28px rgba(0, 0, 0, 0.8);
  }
  .top-hit {
    position: absolute;
    inset: 0;
    display: block;
    width: 100%;
    height: 100%;
    margin: 0;
    padding: 0;
    border: none;
    background: transparent;
    cursor: pointer;
    color: inherit;
    font: inherit;
  }
  .top:hover {
    border-color: var(--accent-2, #53b2ff);
  }
  .top-hit:focus-visible {
    outline: 2px solid var(--accent-2, #53b2ff);
    outline-offset: 2px;
    border-radius: 16px;
  }

  .split {
    position: absolute;
    inset: 0;
  }
  /* Both halves fill the WHOLE card box and are clipped at the divider (--split,
     default 50%), the same technique the production two-up uses: each <img>
     covers the full frame, so the split reads as one continuous image cut down
     the middle wherever the divider sits. NB: the halves are `side-before` /
     `side-after`, NOT `original` / `output` — a class literally named `output`
     would be captured by the focus view's `:global(...) .output` rule (meant for
     the production Output component) and collapse the half. */
  .half {
    position: absolute;
    inset: 0;
    overflow: hidden;
  }
  .half img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .half.side-before {
    clip-path: inset(0 calc(100% - var(--split, 50%)) 0 0);
  }
  .half.side-after {
    clip-path: inset(0 0 0 var(--split, 50%));
  }

  /* ── Real draggable before/after divider ─────────────────────────────────── */
  .divider {
    position: absolute;
    top: 0;
    bottom: 0;
    left: var(--split, 50%);
    width: 30px;
    transform: translateX(-50%);
    z-index: 3;
    /* Sits above the top-hit button so its drag gestures win, and carries its
       own pointer surface. */
    touch-action: none;
    cursor: ew-resize;
    outline: none;
  }
  .divider-line {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 2px;
    transform: translateX(-50%);
    background: linear-gradient(
      to bottom,
      rgba(255, 255, 255, 0.15),
      rgba(255, 255, 255, 0.9),
      rgba(255, 255, 255, 0.15)
    );
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    pointer-events: none;
  }
  /* Glass scrubber thumb, matching the two-up's affordance (accent arrows on a
     dark blurred pill) so the divider reads as the same draggable control. */
  .divider-scrubber {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: grid;
    place-items: center;
    width: 40px;
    height: 40px;
    box-sizing: border-box;
    padding: 0 9px;
    border-radius: 999px;
    background: rgba(14, 14, 18, 0.85);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.5);
    pointer-events: none;
    transition: transform 150ms ease;
  }
  .divider:hover .divider-scrubber {
    transform: translate(-50%, -50%) scale(1.08);
  }
  .divider-scrubber svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .divider-scrubber .arrow-left {
    fill: var(--accent-1, #ff8a5e);
  }
  .divider-scrubber .arrow-right {
    fill: var(--accent-2, #53b2ff);
  }
  .divider:focus-visible .divider-scrubber {
    outline: 2px solid var(--accent-2, #53b2ff);
    outline-offset: 2px;
  }

  .chip {
    position: absolute;
    bottom: 10px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 999px;
    background: rgba(6, 6, 9, 0.62);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    color: var(--text-1, #f5f5f7);
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.01em;
    pointer-events: none;
  }
  .chip.left {
    left: 10px;
    color: var(--text-2, rgba(235, 235, 245, 0.72));
  }
  .chip.right {
    right: 10px;
  }
  .chip.right :global(.delta.bare) {
    font-size: 0.76rem;
  }

  /* ── Override dot ──────────────────────────────────────────────────────── */
  .override-dot {
    position: absolute;
    z-index: 3;
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent-2, #53b2ff);
    box-shadow: 0 0 0 2px var(--surface-solid, #16161c);
  }
  .peek .override-dot {
    top: 8px;
    right: 8px;
  }
  .top-dot {
    top: 10px;
    left: 10px;
  }

  /* ── Working shimmer (500ms-delayed by the parent) ─────────────────────── */
  .shimmer-veil {
    position: absolute;
    inset: 0;
    z-index: 4;
    pointer-events: none;
    background: linear-gradient(
      100deg,
      transparent 20%,
      rgba(255, 255, 255, 0.14) 50%,
      transparent 80%
    );
    background-size: 220% 100%;
    animation: shimmer 1.15s linear infinite;
  }
  .card.shimmer {
    border-color: color-mix(in srgb, var(--accent-1, #ff8a5e) 40%, transparent);
  }

  @keyframes shimmer {
    to {
      background-position: -120% 0;
    }
  }

  /* ── Compact (≤900px): the two settings panels dock as bottom SHEETS ─────────
     They occupy the bottom ~var(--mobile-options-height) of the stage region, so
     centre the fan in the free space ABOVE them (add matching bottom padding)
     rather than behind them. The card also shrinks so it clears full-width. */
  @media (max-width: 900px) {
    .stack-stage {
      /* This band is CRAMPED: the two settings panels dock as tall bottom sheets
         (--mobile-options-height = min(44dvh,360px)) and the bulk controls pill
         sits at the very top, so the fan lives in a shallow corridor between them.
         Reserve both — top for the controls pill, bottom for the panels + the
         picker/toolbar lane above them — and keep the fan centred in what's left. */
      /* Top padding clears the controls pill; bottom padding reserves the
         docked panels + the toolbar/picker lane above them. The fan centres in
         that shallow corridor. */
      padding-top: 72px;
      padding-bottom: calc(var(--mobile-options-height, 360px) + 44px);
    }
    .stack {
      flex: none;
    }
  }
  @media (max-width: 620px), (max-height: 500px) {
    /* Phone: the panels become on-demand bottom sheets (hidden by default), so
       the stage is free again — drop the reserved bottom padding and re-centre. */
    .stack-stage {
      padding-bottom: 24px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .stack {
      transition: none;
    }
    .card {
      transition: none;
      will-change: auto;
    }
    .shimmer-veil {
      animation: none;
      background: rgba(255, 255, 255, 0.06);
    }
  }
</style>
