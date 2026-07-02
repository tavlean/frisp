// The Bulk UI lab is a DEV-ONLY sandbox route. It must never ship in the static
// production build: `prerender = false` keeps the static adapter from emitting
// it (the root +layout sets prerender = true; this overrides it for this
// subtree), and the +page.svelte guards on `dev` so a production bundle renders
// a "not found" notice instead of the lab. `ssr = false` matches the app (the
// engine + workers are browser-only).
export const prerender = false;
export const ssr = false;
export const csr = true;
