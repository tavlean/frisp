// A tiny toast/snackbar store, the Svelte 5 equivalent of Squoosh's
// <snack-bar> custom element (shared/custom-els/snack-bar). Squoosh's
// showSnackbar(message, { actions, timeout }) returns a promise that resolves
// with the chosen action ('undo' | 'dismiss' | 'timeout' | …); callers use that
// to implement Undo. This reproduces that contract with a rune-backed store and
// a single <Snackbar/> component rendered once in the editor.

interface Snack {
  id: number;
  message: string;
  actions: string[];
}

let current = $state<Snack | null>(null);
let resolver: ((action: string) => void) | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
let counter = 0;

function settle(action: string) {
  clearTimeout(timer);
  timer = undefined;
  const resolve = resolver;
  resolver = null;
  current = null;
  resolve?.(action);
}

export const snackbar = {
  /** The snack currently on screen, or null. Read in the <Snackbar/> view. */
  get current() {
    return current;
  },

  /**
   * Show a message. Resolves with the action the user picked, or 'timeout' if
   * it auto-dismissed, or 'dismiss' if superseded by another snack.
   * Default timeout: 5s when there are actions, 4s otherwise. Pass
   * `timeout: null` for a persistent snack that stays until acted on or
   * superseded (e.g. the "new version available" prompt).
   */
  show(
    message: string,
    options: { actions?: string[]; timeout?: number | null } = {},
  ): Promise<string> {
    // Resolve any in-flight snack as 'dismiss' before replacing it.
    if (resolver) settle('dismiss');

    const actions = options.actions ?? [];
    current = { id: ++counter, message, actions };

    return new Promise<string>((resolve) => {
      resolver = resolve;
      const timeout =
        options.timeout === undefined
          ? actions.length
            ? 5000
            : 4000
          : options.timeout;
      if (timeout !== null) {
        timer = setTimeout(() => settle('timeout'), timeout);
      }
    });
  },

  /** Invoked by the view when an action button (or the dismiss ×) is clicked. */
  act(action: string) {
    settle(action);
  },
};
