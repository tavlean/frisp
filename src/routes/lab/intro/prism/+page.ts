// Dev-only lab route. The root layout prerenders; this subtree must NEVER be
// emitted into a production build, so we opt it out of prerender/SSR and keep
// it a pure client-rendered island. The +page.svelte additionally guards on
// `dev` and renders a plain "Not found" when built for production.
export const prerender = false;
export const ssr = false;
export const csr = true;
