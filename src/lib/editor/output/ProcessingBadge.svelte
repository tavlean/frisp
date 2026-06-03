<script lang="ts">
  // The per-side in-progress badge. Phase machine: hidden → working → success →
  // hidden. While a side encodes it shows a spinner + "Optimising…"; the instant
  // the encode finishes successfully it morphs in place into a green glowing dot +
  // "Optimised" (the badge background shifts green), holds briefly, then fades out.
  // Driven off the 500ms-delayed `working` flag, so sub-500ms encodes never show
  // it at all (and so never flash a success beat either).
  import { fade } from 'svelte/transition';
  import { onDestroy, untrack } from 'svelte';

  interface Props {
    /** 500ms-gated "this side is encoding" flag (the editor's `showSpinner`). */
    working: boolean;
    /** True when the side's status is `done` — gates the green success beat (so an
     *  error or an abort just fades, no green). */
    done: boolean;
    /** Whether a result already existed when this pass started — picks the
     *  "Optimising"/"Optimised" vs "Re-optimising"/"Re-optimised" wording. */
    hasResult: boolean;
    side: 'left' | 'right';
    orientation: 'horizontal' | 'vertical';
  }
  let { working, done, hasResult, side, orientation }: Props = $props();

  // How long the green "Optimised" beat holds before it fades away.
  const SUCCESS_HOLD = 850;

  let phase = $state<'hidden' | 'working' | 'success'>('hidden');
  let wasReencode = $state(false);
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
      // a (visible) encode started
      wasReencode = untrack(() => hasResult);
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

  const label = $derived(
    phase === 'success'
      ? wasReencode
        ? 'Re-optimised'
        : 'Optimised'
      : wasReencode
        ? 'Re-optimising…'
        : 'Optimising…',
  );
</script>

{#if phase !== 'hidden'}
  <div
    class="badge {side}"
    class:vertical={orientation === 'vertical'}
    class:success={phase === 'success'}
    role="status"
    aria-live="polite"
    in:fade={{ duration: 200 }}
    out:fade={{ duration: 450 }}
  >
    <span class="indicator" aria-hidden="true">
      {#if phase === 'success'}
        <span class="dot"></span>
      {:else}
        <span class="spinner"></span>
      {/if}
    </span>
    <span>{label}</span>
  </div>
{/if}

<style>
  .badge {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 16px 9px 11px;
    background: rgba(0, 0, 0, 0.72);
    color: #fff;
    border-radius: 999px;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    z-index: 9;
    pointer-events: none;
    backdrop-filter: blur(3px);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.35);
    white-space: nowrap;
    /* The working → success colour shift is what sells the in-place "morph". */
    transition:
      background-color 300ms ease,
      box-shadow 300ms ease;
  }

  .badge.success {
    background: rgba(18, 53, 38, 0.92);
    box-shadow:
      0 2px 12px rgba(0, 0, 0, 0.35),
      0 0 0 1px rgba(52, 211, 153, 0.25);
  }

  /* Centre each badge in its side's VISIBLE region — i.e. between the two
     option-panel insets (`--fit-inset-*`: 300px each on desktop, 0 on mobile,
     set on .compress). Without this the right badge sits at 75% of the full
     width and tucks behind the right options panel. Inherited custom props
     resolve here even though the component's other styles are scoped. */
  .left {
    left: calc(25% + var(--fit-inset-left, 0px) / 2);
  }
  .right {
    left: calc(75% - var(--fit-inset-right, 0px) / 2);
  }
  /* Stacked (mobile): panels are at the bottom, insets are 0 — just centre
     horizontally and offset vertically. */
  .left.vertical {
    left: 50%;
    top: 25%;
  }
  .right.vertical {
    left: 50%;
    top: 75%;
  }

  /* Fixed slot so the spinner and the success dot share the same footprint
     (no layout shift when one swaps for the other). */
  .indicator {
    display: grid;
    place-items: center;
    width: 18px;
    height: 18px;
  }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2.5px solid rgba(255, 255, 255, 0.3);
    border-top-color: #fff;
    border-radius: 50%;
    /* Slightly faster than a typical spinner — reads as "working quickly". */
    animation: spin 0.6s linear infinite;
  }

  .dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #34d399;
    box-shadow: 0 0 8px 2px rgba(52, 211, 153, 0.55);
    animation: dot-in 360ms cubic-bezier(0.2, 0.85, 0.3, 1.2) both;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  /* Pop the dot in with a little overshoot + a glow that blooms on. */
  @keyframes dot-in {
    0% {
      transform: scale(0.3);
      opacity: 0;
      box-shadow: 0 0 0 0 rgba(52, 211, 153, 0);
    }
    60% {
      transform: scale(1.18);
      opacity: 1;
    }
    100% {
      transform: scale(1);
      opacity: 1;
      box-shadow: 0 0 8px 2px rgba(52, 211, 153, 0.55);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation-duration: 1.2s;
    }
    .dot {
      animation: none;
    }
  }
</style>
