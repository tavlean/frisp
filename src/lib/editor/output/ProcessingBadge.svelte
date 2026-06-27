<script lang="ts">
  // The per-side in-progress badge. Phase machine: hidden → working → success →
  // hidden. While a side encodes it shows a spinner + "Optimizing…"; the instant
  // the encode finishes successfully the spinner MORPHS in place into a small green
  // dot, the text crossfades "Optimizing… → Optimized", the badge background shifts
  // green and resizes to fit, holds briefly, then fades out. Driven off the
  // 500ms-delayed `working` flag, so sub-500ms encodes never show it at all.
  import { fade } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import { onDestroy, untrack } from 'svelte';

  interface Props {
    /** 500ms-gated "this side is encoding" flag (the editor's `showSpinner`). */
    working: boolean;
    /** True when the side's status is `done` — gates the green success beat (so an
     *  error or an abort just fades, no green). */
    done: boolean;
    /** Whether a result already existed when this pass started — picks the
     *  "Optimizing"/"Optimized" vs "Re-optimizing"/"Re-optimized" wording. */
    hasResult: boolean;
    /** What this pass is doing. 'resize' overrides the wording to
     *  "Resizing…"/"Resized"; 'optimize' uses the (Re-)optimizing wording. */
    activity: 'optimize' | 'resize';
    side: 'left' | 'right';
    orientation: 'horizontal' | 'vertical';
  }
  let { working, done, hasResult, activity, side, orientation }: Props =
    $props();

  // How long the green "Optimized" beat holds before it fades away.
  const SUCCESS_HOLD = 850;

  let phase = $state<'hidden' | 'working' | 'success'>('hidden');
  let wasReencode = $state(false);
  let wasResize = $state(false);
  // Plain (non-reactive) edge tracker + hide timer.
  let prevWorking = false;
  let hideTimer: ReturnType<typeof setTimeout> | undefined;

  // Run the phase machine off the WORKING edge only. `done`/`hasResult` are read
  // UNtracked — they're sampled at the edge and must not re-trigger the effect.
  $effect(() => {
    const w = working;
    if (w === prevWorking) return;
    prevWorking = w;
    clearTimeout(hideTimer);
    if (w) {
      // a (visible) encode started — sample the wording inputs at this edge
      wasReencode = untrack(() => hasResult);
      wasResize = untrack(() => activity === 'resize');
      phase = 'working';
    } else if (untrack(() => done)) {
      // it finished successfully → green beat, then fade
      phase = 'success';
      hideTimer = setTimeout(() => {
        phase = 'hidden';
      }, SUCCESS_HOLD);
    } else {
      // error / aborted → no green, just go away
      phase = 'hidden';
    }
  });

  onDestroy(() => clearTimeout(hideTimer));

  // Both texts are rendered, stacked, and crossfaded — each working/success pair
  // shares a prefix ("Optimiz…" / "Resiz…"), so left-aligning them keeps the
  // prefix pixel-stable and only the differing suffix visibly changes. The wording
  // is picked once per pass via `wasResize` / `wasReencode` (sampled at the edge).
  const workingText = $derived(
    wasResize ? 'Resizing…' : wasReencode ? 'Re-optimizing…' : 'Optimizing…',
  );
  const successText = $derived(
    wasResize ? 'Resized' : wasReencode ? 'Re-optimized' : 'Optimized',
  );

  // Reduced motion: we SHORTEN durations rather than snap to none. An abrupt swap
  // is the opposite of calm, and `prefers-reduced-motion` is about spatial
  // movement (sliding, parallax, big zooms) — this badge only transforms in
  // place (opacity, colour, a tiny scale), so a quick smooth transition stays
  // comfortable AND serves the people who flip the toggle because animations feel
  // laggy. The CSS transitions are shortened via the media query below; the
  // JS-driven fades read the same preference here. (The continuous spin is left
  // at its normal pace — speeding a rotation up would be MORE motion, not less.)
  let reduceMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = mq.matches;
    const onChange = (e: MediaQueryListEvent) => (reduceMotion = e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  });
  const fadeIn = $derived({
    duration: reduceMotion ? 90 : 200,
    easing: cubicOut,
  });
  const fadeOut = $derived({
    duration: reduceMotion ? 120 : 300,
    easing: cubicOut,
  });

  // The badge resizes to fit the ACTIVE text so there's no dead space on the right
  // once it shrinks ("Optimizing…" → "Optimized"). CSS can't animate to a content
  // width, so we measure the two text widths (the labels are nowrap + absolute, so
  // offsetWidth is their intrinsic width) plus the badge's fixed chrome, and
  // transition the badge's explicit width. A translateX keeps the LEFT edge
  // anchored while the width changes, so only the right edge moves in.
  let badgeEl = $state<HTMLDivElement>();
  let indicatorEl = $state<HTMLSpanElement>();
  let workingEl = $state<HTMLSpanElement>();
  let successEl = $state<HTMLSpanElement>();
  let workingW = $state(0);
  let successW = $state(0);
  let chrome = $state(0); // indicator + gap + horizontal padding
  $effect(() => {
    workingText; // re-measure when the wording changes (Optimizing vs Re-optimizing)
    successText;
    if (workingEl) workingW = workingEl.offsetWidth;
    if (successEl) successW = successEl.offsetWidth;
    if (badgeEl && indicatorEl) {
      const cs = getComputedStyle(badgeEl);
      chrome =
        indicatorEl.offsetWidth +
        parseFloat(cs.paddingLeft) +
        parseFloat(cs.paddingRight) +
        parseFloat(cs.columnGap || cs.gap || '0');
    }
  });
  const activeTextW = $derived(phase === 'success' ? successW : workingW);
  const badgeWidth = $derived(chrome && activeTextW ? chrome + activeTextW : 0);
  // Negative shift in success cancels the centred-shrink, pinning the left edge.
  const anchorShift = $derived((activeTextW - workingW) / 2);
</script>

{#if phase !== 'hidden'}
  <div
    class="badge {side}"
    class:vertical={orientation === 'vertical'}
    class:success={phase === 'success'}
    class:measured={badgeWidth > 0}
    bind:this={badgeEl}
    role="status"
    aria-live="polite"
    style:width={badgeWidth ? `${badgeWidth}px` : null}
    style:transform={`translate(-50%, -50%) translateX(${anchorShift}px)`}
    in:fade={fadeIn}
    out:fade={fadeOut}
  >
    <span class="indicator" bind:this={indicatorEl} aria-hidden="true">
      <!-- One element: a spinning ring in `working` that collapses + greens into
           a small dot in `success`. Rotation lives on the inner .ring so it never
           fights the .morph scale transform. -->
      <span class="morph"><span class="ring"></span></span>
    </span>
    <!-- Stacked labels (both absolutely positioned, left-aligned): the shared
         "Optimiz…" prefix overlaps and stays put while the suffix crossfades. The
         label fills the badge (flex) and clips its right edge as the badge resizes. -->
    <span class="label">
      <span
        class="l l-working"
        bind:this={workingEl}
        aria-hidden={phase === 'success'}>{workingText}</span
      >
      <span
        class="l l-success"
        bind:this={successEl}
        aria-hidden={phase !== 'success'}>{successText}</span
      >
    </span>
  </div>
{/if}

<style>
  .badge {
    position: absolute;
    top: 50%;
    box-sizing: border-box;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 15px 8px 10px;
    background-color: rgba(0, 0, 0, 0.72);
    color: #fff;
    border-radius: 999px;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1; /* glyph box = cap height, so it centres on the dot */
    z-index: 9;
    pointer-events: none;
    backdrop-filter: blur(3px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
    white-space: nowrap;
    /* width + transform animate the resize (right edge in, left edge pinned);
       background/shadow green as a unit with the dot. All one on-screen morph. */
    transition:
      width 260ms cubic-bezier(0.645, 0.045, 0.355, 1),
      transform 260ms cubic-bezier(0.645, 0.045, 0.355, 1),
      background-color 260ms cubic-bezier(0.645, 0.045, 0.355, 1),
      box-shadow 260ms cubic-bezier(0.645, 0.045, 0.355, 1);
  }

  .badge.success {
    background-color: rgba(18, 53, 38, 0.92);
    box-shadow:
      0 2px 12px rgba(0, 0, 0, 0.35),
      0 0 0 1px rgba(52, 211, 153, 0.22);
  }

  /* Centre each badge in its side's VISIBLE region — between the two option-panel
     insets (`--fit-inset-*`: 300px each on desktop, 0 on mobile, set on .compress)
     — so the right badge isn't tucked behind the right options panel. */
  .left {
    left: calc(25% + var(--fit-inset-left, 0px) / 2);
  }
  .right {
    left: calc(75% - var(--fit-inset-right, 0px) / 2);
  }
  /* Stacked (mobile): panels are at the bottom, insets are 0 — just centre
     horizontally and offset vertically. */
  .left.vertical {
    top: 25%;
    left: 50%;
  }
  .right.vertical {
    top: 75%;
    left: 50%;
  }

  /* Fixed slot so the spinner→dot change never shifts where the text starts. */
  .indicator {
    display: grid;
    place-items: center;
    width: 16px;
    height: 16px;
  }

  .morph {
    position: relative;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background-color: transparent;
    transform: scale(1);
    transition:
      transform 260ms cubic-bezier(0.645, 0.045, 0.355, 1),
      background-color 260ms cubic-bezier(0.645, 0.045, 0.355, 1),
      box-shadow 260ms cubic-bezier(0.645, 0.045, 0.355, 1);
  }

  .ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.28);
    border-top-color: #fff;
    /* Slightly faster than a typical spinner — reads as "working quickly". */
    animation: spin 0.6s linear infinite;
    transition: opacity 160ms ease;
  }

  /* Success: the ring fades while the morph collapses + greens into a ~7px dot
     (monotonic scale-down, no overshoot). */
  .success .morph {
    transform: scale(0.5);
    background-color: #34d399;
    box-shadow: 0 0 16px 4px rgba(52, 211, 153, 0.5);
  }
  .success .ring {
    opacity: 0;
  }

  /* The label fills the badge's text column (flex) once measured, so the badge's
     animated width drives it; clip-path clips the wider text on the RIGHT as it
     shrinks, but expands top/bottom so glyph descenders (g, p) are never cut.
     Before measuring it sizes to the working text naturally (no collapse). */
  .label {
    position: relative;
    height: 1em;
    min-width: 0;
    clip-path: inset(-50% 0 -50% 0);
  }
  .badge.measured .label {
    flex: 1 1 0;
  }
  .label > .l {
    position: absolute;
    left: 0;
    top: 0;
    text-align: left;
    white-space: nowrap;
    transition: opacity 170ms ease;
  }
  .l-success {
    opacity: 0;
  }
  .success .l-working {
    opacity: 0;
  }
  .success .l-success {
    opacity: 1;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Reduced motion = keep it smooth, just QUICK (not abrupt). We only transform
     in place — opacity, colour, a tiny scale, an in-place resize — never move
     across the screen, so a short transition stays calm. The spin keeps its normal
     pace (a faster rotation would be more motion, not less). Note in the script. */
  @media (prefers-reduced-motion: reduce) {
    .badge,
    .morph {
      transition-duration: 120ms;
    }
    .ring,
    .label > .l {
      transition-duration: 90ms;
    }
  }
</style>
