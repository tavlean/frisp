<script lang="ts">
  // Dev-only LAB experiment: the "frame" take on the landing/intro screen.
  // The whole viewport IS the drop zone — a permanent viewfinder frame (one
  // dashed rounded rect, inset from the edges) declares the entire page a
  // target, and the header/footer chrome lives only as HUD micro-copy pinned
  // to the frame's inner corners. Drops/picks are REAL via IntroDropDemo; only
  // the editor handoff is stubbed. Guarded on `dev`; +page.ts opts the subtree
  // out of prerender/SSR.
  import { onMount } from 'svelte';
  import { dev } from '$app/environment';
  import { APP_NAME } from 'shared/brand';
  import { IntroDropDemo } from '$lib/lab/intro/drop-demo.svelte';
  import Brand from '$lib/lab/intro/Brand.svelte';
  import Icon from '$lib/lab/intro/Icon.svelte';
  import ThemeToggle, {
    type ThemeMode,
  } from '$lib/lab/intro/ThemeToggle.svelte';
  import '$lib/lab/intro/intro-lab.css';

  const demo = new IntroDropDemo();

  // Lab-only forced color scheme; default System (no class), light-dark() does
  // the rest once force-light/force-dark lands on the root.
  let theme = $state<ThemeMode>('system');
  let fileInput = $state<HTMLInputElement>();

  // Entrance reveal + a "reduce" gate the CSS media query can't reach (the
  // success-beat is state-driven, so it must be suppressed in JS too).
  let entered = $state(false);
  let reduceMotion = $state(false);
  // Brief green frame flash the moment files land — a quiet success beat.
  let justAccepted = $state(false);

  onMount(() => {
    reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    // Next frame so the entrance transition actually plays from the start state.
    requestAnimationFrame(() => (entered = true));
  });

  // Fire the success beat only on the empty→filled edge, never under reduce.
  let hadFiles = false;
  $effect(() => {
    const has = demo.hasFiles;
    if (has && !hadFiles && !reduceMotion) {
      justAccepted = true;
      setTimeout(() => (justAccepted = false), 600);
    }
    hadFiles = has;
  });

  const shownFiles = $derived(demo.files.slice(0, 4));
</script>

{#if dev}
  <main
    class="intro-lab-root il-frame-root"
    class:force-light={theme === 'light'}
    class:force-dark={theme === 'dark'}
    class:dragging={demo.dragActive}
    {@attach demo.dropTarget()}
  >
    <!-- The viewfinder: one dashed rounded rect that resizes with the viewport.
         Geometry lives in CSS (percentages) so the SVG needs no viewBox. -->
    <svg
      class="frame-svg"
      aria-hidden="true"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect
        class="frame-rect"
        class:dragging={demo.dragActive}
        class:good={justAccepted && !demo.dragActive}
        class:entered
        fill="none"
        stroke-width="1.5"
        stroke-dasharray="7 9"
        vector-effect="non-scaling-stroke"
      />
    </svg>
    <!-- Soft inner glow — its own layer so the blur never touches the stroke. -->
    <div class="frame-glow" aria-hidden="true"></div>

    <!-- HUD corners: the chrome, pinned just inside the frame. -->
    <div class="hud hud-tl">
      <Brand size={16} />
    </div>
    <div class="hud hud-tr">
      <ThemeToggle value={theme} onchange={(mode) => (theme = mode)} />
    </div>
    <div class="hud hud-bl">
      <span class="hud-line">WebP · AVIF · JPEG XL · JPEG · PNG</span>
    </div>
    <div class="hud hud-br">
      <span class="hud-line">offline · open source · private</span>
      <span class="hud-line">{APP_NAME} — images never leave your device</span>
    </div>

    <!-- Center column: the whole invitation, swapped in place (min-height
         reserved) so neither the drag nor the accept state shifts the layout. -->
    <div class="center" class:entered>
      {#if demo.hasFiles}
        <div class="accepted">
          <p class="summary">{demo.summary}</p>
          <ul class="filelist">
            {#each shownFiles as item (item.file.name)}
              <li>{item.file.name}</li>
            {/each}
          </ul>
          <button type="button" class="pill" onclick={() => demo.reset()}>
            Start over
          </button>
          <p class="stub">Lab stub — production opens the editor here.</p>
        </div>
      {:else}
        <div class="idle">
          <span class="tray" class:nudge={demo.dragActive}>
            <Icon name="drop-tray" size={56} />
          </span>

          <h1 class="headline">
            {#if demo.dragActive}
              Release to <span class="accent">add.</span>
            {:else}
              Drop images anywhere.
            {/if}
          </h1>

          <p class="subline">
            Free, open-source image compression that runs entirely in your
            browser. Nothing ever uploads.
          </p>

          <button
            type="button"
            class="pill browse"
            onclick={() => fileInput?.click()}
          >
            Browse files
          </button>
          <input
            bind:this={fileInput}
            class="visually-hidden"
            type="file"
            accept="image/*"
            multiple
            tabindex="-1"
            aria-hidden="true"
            onchange={demo.onPick}
          />
        </div>
      {/if}
    </div>
  </main>
{:else}
  <p>Not found.</p>
{/if}

<style>
  .il-frame-root {
    position: relative;
    height: 100dvh;
    box-sizing: border-box;
    overflow: hidden;
    background: var(--il-page);
    /* One knob feeds both the frame inset and the HUD-corner padding. */
    --frame-inset: clamp(12px, 2vw, 26px);
    --hud-pad: 30px;
    --frame-radius: 24px;
    transition: background-color 200ms ease;
  }
  /* A whisper of accent tint fills the page while a drag hovers (≤4%). */
  .il-frame-root.dragging {
    background: color-mix(in srgb, var(--il-accent) 4%, var(--il-page));
  }

  /* ── The viewfinder frame ──────────────────────────────────────────── */
  .frame-svg {
    /* SVG is a replaced element, so `inset` alone leaves it at its intrinsic
       300×150 — it needs an explicit box for the rect's % geometry to resolve
       against the viewport. */
    position: absolute;
    top: var(--frame-inset);
    left: var(--frame-inset);
    width: calc(100% - 2 * var(--frame-inset));
    height: calc(100% - 2 * var(--frame-inset));
    overflow: visible;
    pointer-events: none;
  }
  .frame-rect {
    /* Geometry via CSS percentages — inset 0.75px so the 1.5px stroke sits
       fully inside the SVG box on every side. */
    x: 0.75px;
    y: 0.75px;
    width: calc(100% - 1.5px);
    height: calc(100% - 1.5px);
    rx: var(--frame-radius);
    stroke: var(--il-border-strong);
    /* Entrance start state; .entered releases it. */
    opacity: 0;
    stroke-dashoffset: 40;
    transition:
      stroke 200ms ease,
      opacity 500ms ease,
      stroke-dashoffset 500ms ease;
  }
  .frame-rect.entered {
    opacity: 1;
    stroke-dashoffset: 0;
  }
  .frame-rect.good {
    stroke: var(--il-good);
  }
  .frame-rect.dragging {
    stroke: var(--il-accent);
    /* Marching dashes: one full dash+gap (7+9) per loop for a seamless cycle. */
    animation: march 700ms linear infinite;
  }
  @keyframes march {
    to {
      stroke-dashoffset: -16;
    }
  }

  .frame-glow {
    position: absolute;
    inset: var(--frame-inset);
    border-radius: var(--frame-radius);
    pointer-events: none;
    opacity: 0;
    box-shadow: inset 0 0 60px
      color-mix(in srgb, var(--il-accent) 10%, transparent);
    transition: opacity 200ms ease;
  }
  .il-frame-root.dragging .frame-glow {
    opacity: 1;
  }
  @supports (corner-shape: squircle) {
    .frame-rect {
      rx: 30px;
    }
    .frame-glow {
      corner-shape: squircle;
      border-radius: 34px;
    }
  }

  /* ── HUD corners ───────────────────────────────────────────────────── */
  .hud {
    position: absolute;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 2;
  }
  .hud-tl {
    top: calc(var(--frame-inset) + 22px);
    left: calc(var(--frame-inset) + var(--hud-pad));
  }
  .hud-tr {
    top: calc(var(--frame-inset) + 18px);
    right: calc(var(--frame-inset) + var(--hud-pad));
  }
  .hud-bl {
    bottom: calc(var(--frame-inset) + var(--hud-pad));
    left: calc(var(--frame-inset) + var(--hud-pad));
  }
  .hud-br {
    bottom: calc(var(--frame-inset) + var(--hud-pad));
    right: calc(var(--frame-inset) + var(--hud-pad));
    align-items: flex-end;
    text-align: right;
  }
  .hud-line {
    font-size: 11.5px;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--il-text-3);
  }

  /* ── Center column ─────────────────────────────────────────────────── */
  .center {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    /* Reserve the tallest state so idle→drag→accepted never jump. */
    min-height: 340px;
    padding: 0 24px;
    z-index: 1;
  }
  .center.entered {
    /* Center fades up once on mount. */
    animation: rise 500ms ease both;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translate(-50%, calc(-50% + 8px));
    }
    to {
      opacity: 1;
      transform: translate(-50%, -50%);
    }
  }

  .idle,
  .accepted {
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .idle {
    gap: 18px;
  }

  .tray {
    display: inline-grid;
    color: var(--il-text-2);
    transition: transform 200ms ease;
  }
  .tray.nudge {
    transform: translateY(4px);
  }

  .headline {
    margin: 0;
    font-size: clamp(36px, 6vw, 76px);
    font-weight: 900;
    letter-spacing: -0.03em;
    line-height: 1.02;
    color: var(--il-text-1);
    /* Reserve one display line so the drag swap doesn't reflow. */
    min-height: 1.02em;
  }
  .headline .accent {
    color: var(--il-accent);
  }

  .subline {
    margin: 0;
    max-width: 44ch;
    font-size: 16px;
    line-height: 1.5;
    color: var(--il-text-2);
  }

  /* Quiet pill button, shared by Browse + Start over. */
  .pill {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 10px 20px;
    border: 1px solid var(--il-border);
    border-radius: 12px;
    background: var(--il-surface);
    box-shadow: var(--il-shadow-control);
    color: var(--il-text-1);
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition:
      border-color 150ms ease,
      transform 150ms ease;
  }
  .pill:hover {
    border-color: var(--il-border-strong);
    transform: translateY(-1px);
  }
  .browse {
    margin-top: 4px;
  }
  @supports (corner-shape: squircle) {
    .pill {
      corner-shape: squircle;
      border-radius: 15px;
    }
  }

  /* ── Accepted state ────────────────────────────────────────────────── */
  .accepted {
    gap: 12px;
  }
  .summary {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: var(--il-text-1);
  }
  .filelist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
    max-width: 40ch;
  }
  .filelist li {
    font-size: 13px;
    color: var(--il-text-2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .stub {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--il-text-3);
  }

  .visually-hidden {
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

  @media (prefers-reduced-motion: reduce) {
    .frame-rect,
    .frame-rect.dragging {
      animation: none;
      transition:
        stroke 200ms ease,
        opacity 200ms ease;
      stroke-dashoffset: 0;
    }
    .center.entered {
      animation: none;
    }
    .tray,
    .tray.nudge,
    .pill:hover {
      transition: none;
      transform: none;
    }
  }
</style>
