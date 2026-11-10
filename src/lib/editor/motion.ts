// The editor's shared JS transitions. Svelte runs these on the Web Animations
// API, so the CSS `prefers-reduced-motion` rules elsewhere cannot reach them;
// each one reads the preference itself. Policy (same as ProcessingBadge):
// reduced motion removes spatial movement. The reveal is all movement, so it
// becomes instant; the snackbar keeps its fade.
import { prefersReducedMotion } from 'svelte/motion';
import { fly, slide } from 'svelte/transition';

/** The 300ms height reveal for rows and sections behind a toggle. With
 *  `enabled: false` the zero-length transition behaves like no transition. */
export function reveal(node: Element, { enabled = true } = {}) {
  return slide(node, {
    duration: enabled && !prefersReducedMotion.current ? 300 : 0,
  });
}

/** The snackbar's rise from below; under reduced motion only its fade is left. */
export function toast(node: Element) {
  return fly(node, { y: prefersReducedMotion.current ? 0 : 60, duration: 200 });
}
