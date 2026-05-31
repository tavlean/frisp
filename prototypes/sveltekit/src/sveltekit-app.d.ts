// Type shim for the SvelteKit `$app/*` virtual modules we use.
//
// These modules resolve fine at runtime (the SvelteKit Vite plugin provides
// them), but this prototype's generated `.svelte-kit/tsconfig.json` only maps
// `$app/types` — not `$app/navigation` / `$app/state` — so `svelte-check` can't
// find them. kit 2.61 doesn't ship a `declare module '$app/navigation'` for the
// type-checker to pick up here, so we declare the small surface we use. When the
// prototype's tsconfig is reconciled with a standard SvelteKit setup, delete
// this file.

declare module '$app/navigation' {
  export function pushState(url: string | URL, state: App.PageState): void;
  export function replaceState(url: string | URL, state: App.PageState): void;
}

declare module '$app/state' {
  export const page: {
    readonly url: URL;
    readonly state: App.PageState;
  };
}

declare module '$app/paths' {
  export const base: string;
  export const assets: string;
  export function resolve(path: string): string;
}
