// Dev-only lab routes: in production the app-strip-dev-only-routes plugin
// (vite.config.ts) stubs their pages, so nothing here is worth prerendering.
// Child pages inherit this; ssr = false already comes from the root layout.
export const prerender = false;
