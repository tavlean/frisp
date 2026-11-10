// Types the hand-written custom elements for svelte-check, which otherwise
// accepts any attribute on an unknown tag. Both elements dispatch a plain
// Event named `change` / `splitchange`, not a form event, so `onchange` is
// replaced rather than inherited.
import type { HTMLAttributes } from 'svelte/elements';
import type PinchZoom from '$lib/editor/output/pinch-zoom';
import type TwoUp from '$lib/editor/output/two-up';

declare module 'svelte/elements' {
  export interface SvelteHTMLElements {
    'two-up': HTMLAttributes<TwoUp> & {
      orientation?: TwoUp['orientation'];
      'legacy-clip-compat'?: boolean;
      onsplitchange?: (event: Event) => void;
    };
    'pinch-zoom': Omit<HTMLAttributes<PinchZoom>, 'onchange'> & {
      onchange?: (event: Event) => void;
    };
  }
}

export {};
