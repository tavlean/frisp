# Svelte and SvelteKit docs review, 2026-11-10

Last updated: 2026-11-10.
Status: review only. Nothing here is implemented yet, apart from the doc
corrections listed under "Corrected in this pass".

The maintainer asked for the whole Svelte and SvelteKit documentation to be
read against the codebase after the SvelteKit 3 migration, with extra weight
on new and experimental features and on adjacent features Frisp does not use
yet. The question: what could be simpler, what could be deleted, and what
should be done a different way?

How it was made: 11 readers (Opus 5.5) each read one group of doc sections
through the Svelte MCP server, 150 sections in all, and compared them with the
code. 10 checkers (Opus 5.5) then tried to refute each reader's findings
against the repo, the docs and the installed packages. That gave 74 findings:
40 confirmed, 33 partly right, 1 refuted. The driver (Fable 5.2) read all 74
with the checkers' corrections, ranked them, and re-checked every item marked
**verified** below against the code, the build output, or the Svelte runtime
source. The agents were read-only and ran nothing, so an item not marked
verified is a reading of docs and code, not an observed behavior.

Versions reviewed: Svelte 5.57.3, SvelteKit 3.1.1, Vite 8.3.7, at commit
`b249289b`.

## The short version

- The code is already idiomatic Svelte 5: no legacy syntax, no stores, no
  actions. Most findings are small.
- The read turned up eight defects, none severe. They come first.
- There is dead weight to delete, including a 44 kB font file that every
  install precaches and nothing uses.
- No experimental feature is worth turning on today. Section 5 says why for
  each one.
- Moving the aliases to `package.json` subpath imports is real work: about
  560 import specifiers in about 130 files, and the docs require explicit
  file extensions on them.

A suggested order is in section 7.

## 1. Defects

### 1.1 Unknown nested URLs load a blank page, and every unknown URL answers 200

**Verified** in the build output; the host's behavior is inferred.

`build/index.html` boots with relative paths (`import("./_app/...")`), and
[wrangler.jsonc](../../../wrangler.jsonc) serves it for every unknown path
(`not_found_handling: "single-page-application"`). At `frisp.app/a/b` the
browser asks for `/a/_app/...`, which does not exist, so the app never starts.
One-segment paths such as `/foo` work by luck. `build/200.html`, the one file
with absolute paths, ships unused. Every unknown URL also returns status 200
with the home page's canonical tag.

Fix: set the adapter's `fallback` to `404.html`, set `not_found_handling` to
`"404-page"`, and add a root `+error.svelte` (4.1). Unknown URLs then get the
app shell with a real 404 status and a not-found page with a way home. A
smaller alternative is `paths: { relative: false }`, which fixes the blank
page but keeps the 200.

Touches [vite.config.ts](../../../vite.config.ts), `wrangler.jsonc`,
[scripts/audit-static-output.mjs](../../../scripts/audit-static-output.mjs)
(it asserts `200.html`), [gotchas.md](../../gotchas.md) and
[build-and-runtime.md](../../build-and-runtime.md). `vite preview` cannot show
the status codes; check them on a Cloudflare preview deploy.

### 1.2 The `slide` reveal on option rows never plays

**Verified** in Svelte's runtime source.

[ToggleRow.svelte](../../../src/lib/editor/options/ToggleRow.svelte) and
[OptionRow.svelte](../../../src/lib/editor/options/OptionRow.svelte) put the
transition inside their own `{#if animate}` block. Svelte plays a local
transition only when its own block already existed before the change
(`transitions.js`: `run = !block || (block.f & REACTION_RAN) !== 0`). Here
that block is created together with the row, so the intro is skipped. Six
call sites pass `slide` (five in MozjpegOptions, one in WebpOptions) and get
no animation. The hardening plan's Wave 6 note that the slide reveals were
browser-verified most likely saw the panel-level slides.

Fix: render one element with a transition function that returns
`{ duration: 0 }` when `slide` is off. The element then belongs to the
caller's `{#if}`. Two files, no caller changes. Rows will start sliding, so
check the MozJPEG panel by eye.

### 1.3 The snackbar slides in only when it replaces another one

Same rule as 1.2, read from the same source.
[Snackbar.svelte](../../../src/lib/editor/Snackbar.svelte) has
`{#if snack}{#key snack.id}<div transition:fly>`. The transition belongs to
the key block, so the first show and the dismiss both skip it. Fix:
`transition:fly|global`. One site.

### 1.4 Svelte transitions ignore reduced motion

There are 18 `transition:slide={{ duration: 300 }}` sites in 8 files, plus the
snackbar's fly. Svelte transitions run on the Web Animations API, so the CSS
media-query rules do not reach them. Bulk mode and the intro already honor the
setting.

Fix: one `reveal` helper in `src/lib/editor` that reads `prefersReducedMotion`
from `svelte/motion` (since 5.7). It replaces the 18 sites and the repeated
300 ms. ProcessingBadge can use the same export in place of its hand-made
`MediaQuery`. Decide once whether reduced motion means no motion or shorter
motion; ProcessingBadge's comment says shorter.

### 1.5 A failed cache write fails the request in the service worker

**Verified** by reading
[src/service-worker.ts](../../../src/service-worker.ts). `fetchAndCache`
awaits `cache.put` before it returns the response. If the write rejects (a
full quota is the likely case, with several megabytes of codecs), the asset
request fails even though the network answered. The pattern in the SvelteKit
docs caches in the background and only status 200.

Fix: move the write into `event.waitUntil` with a catch, and return the
response at once. One function; the offline e2e test covers it.

### 1.6 `/diagnostics` is stubbed in production but still prerendered and precached

**Verified.** Commit `1de9e651` made the page dev-only, but
`build/diagnostics.html` still ships: a "Not found." stub with the full SEO
head and a canonical to the home page. Every install precaches it, the static
audit asserts that it is precached, and `static/robots.txt` and
[seo.md](../../seo.md) still describe it as a reachable maintenance page.

Fix: add `src/routes/diagnostics/+page.ts` with `export const prerender =
false`, point the audit's canary at the root page, and correct the robots
comment and `seo.md`.

### 1.7 The service worker is registered as a classic script, but SvelteKit 3 builds it as a module

This works today because the bundle has no imports. A later import (a dynamic
env value, a split chunk) would break registration in the field while every
gate stays green.

Fix: one assertion in `audit-static-output.mjs` that
`build/service-worker.js` has no top-level `import` or `export`. Switching to
`type: 'module'` is the other option, but it drops browsers without module
service workers.

### 1.8 A trap, not a defect: `{@const}` is now legacy and its replacement cannot be formatted

The docs call `{@const}` legacy syntax and point to `{const x = $derived(y)}`
(declaration tags, stable since 5.56). The compiler and svelte-check accept
the new form, but prettier-plugin-svelte 4.0.1 cannot print it. StackStage's
four `{@const}` tags are the only ones in `src`. Add a note to
`docs/gotchas.md` so nobody adopts the new tag before the Prettier plugin
supports it.

## Corrected in this pass

- `build-and-runtime.md` said `version.pollInterval: 0` stops SvelteKit from
  fetching `_app/version.json`. It only stops the hourly timer; SvelteKit
  still fetches the file on every tab focus and visibility change
  (**verified** in the installed client).
- `gotchas.md` and `build-and-runtime.md` said the service-worker file list
  omits every worker chunk. With SvelteKit 3.1.1 and Vite 8.3.7 the codec
  worker and the SVG optimizer worker are listed (**verified** in
  `build/service-worker.js`); only the OxiPNG thread helper is missing. The
  precache plugin and its audit stay as the guard.

## 2. Delete

1. **The italic Satoshi font. Verified.** Nothing in `src` renders italic
   text: a search for `italic`, `<em>` and `<i>` finds only the `@font-face`
   rule itself. The comment in
   [+layout.svelte](../../../src/routes/+layout.svelte) about the intro
   headline is out of date. The 43.8 kB file is in every install's precache.
   Delete the rule and `static/fonts/Satoshi-VariableItalic.woff2`.
2. **`vitePreprocess()`.** No `<style lang>`, no PostCSS config, and script
   preprocessing is off by default. Delete the import and the option, then
   compare the emitted CSS before and after.
3. **Adapter options `pages`, `assets` and `strict`.** The first two are the
   defaults and `strict` is unreachable while a fallback is set.
4. **`svelte-kit sync` in `test:unit`.** Vitest never reads its output. Run it
   from `prepare` instead, as the CLI docs describe, so a fresh install has
   `$app/tsconfig` for editors.
5. **Intro's own drop target.**
   [Intro.svelte](../../../src/lib/editor/intro/Intro.svelte) re-implements
   [file-drop.ts](../../../src/lib/editor/file-drop.ts) almost line for line,
   about 45 lines. Give `fileDrop` two options (stop propagation, an
   active-state callback) and use it.
6. **Four identical `@keyframes spin` blocks.** One `-global-spin` in the root
   layout.
7. **`resolve.alias: appAliases`** in `vite.config.ts` repeats what the
   SvelteKit `alias` option already hands to Vite. It goes away with 3.1.
8. **Eleven identical lab `+page.ts` option files.** One
   `src/routes/lab/+layout.ts` with `prerender = false` covers them. These are
   config, not lab designs, but they sit under lab, so this needs the
   maintainer's OK.
9. Optional: `data-sveltekit-preload-data="hover"` in `app.html` does nothing
   in production, where there are no internal links. It is the template
   default and harmless.

## 3. Simplify, ranked by value for effort

### 3.1 Aliases to `package.json` subpath imports

The documented replacement for the deprecated `alias` option. All eight
aliases fit the same mechanism:

```json
"imports": {
  "#lib/*": "./src/lib/*",
  "#client/*": "./src/client/*",
  "#features/*": "./src/features/*",
  "#shared/*": "./src/shared/*",
  "#sw/*": "./src/sw/*",
  "#worker-shared/*": "./src/worker-shared/*",
  "#codecs/*": "./codecs/*",
  "#app-generated/*": "./.svelte-kit/app-generated/*"
}
```

What it deletes: `appAliases`, the SvelteKit `alias` option, `resolve.alias`,
the alias copy in `vitest.config.ts`, the gotcha about Vitest not inheriting
aliases, and the deprecation warning on every build. Node, Vite, TypeScript
and Vitest all resolve `#` imports with no config.

What it costs: about 560 specifiers in about 130 files across `src` and
`tests`, and the docs require explicit extensions (`#lib/compress.ts`,
`#lib/editor/editor-session.svelte.ts`). That is a house-style change.
`$app/tsconfig` already sets `allowImportingTsExtensions`.

Risks: 27 `codecs/` imports carry `?url` or `?worker` queries;
`tests/unit/node-pipeline.test.ts` passes `appAliases` to a nested Vite
build; and only the e2e suite proves the WASM imports still resolve. Do it as
one mechanical sweep in its own commit.

### 3.2 `pushState` to `goto('', { state, shallow: true })`

One line in
[editor-route.svelte.ts](../../../src/lib/editor/editor-route.svelte.ts). The
pending flag stays: `goto` has the same gap before `page.state` updates, and
the docs offer no synchronous form. With `goto`, navigation hooks fire; Frisp
registers none. Adding `reset: true` would switch on SvelteKit's route
announcement and focus reset for the editor opening, but the announced title
is often the busy title, so leave it for an accessibility pass.

### 3.3 Three reset-on-change effects become writable `$derived`

Deriveds can be reassigned since 5.25, and they reset when their inputs
change. That is exactly what StackStage's `frontOffset` and `splitPct` and
FocusView's `phoneSheet` do by hand with an effect and a "last value" guard.
Three effects and two guard variables go, including the ones Wave 7 of the
hardening plan could not remove. Each must depend on a primitive (a signature
string, an id, a boolean) or it resets too often.

### 3.4 One scroll-fade helper for the two strips

FilmStrip and RichStrip carry the same 25 lines: fade state, a ResizeObserver
effect, a microtask effect, a window resize listener and a scroll handler.
Four readers flagged it independently. One `scrollFades` attachment factory
with callbacks replaces both. The smallest variant is
`bind:clientWidth={null, updateScrollFades}`, which removes just the observer
effects.

### 3.5 One view-options popover

Output and FocusView each carry the same popover (trigger, light dismiss,
smoothing and background toggles, four inline SVGs) and the same CSS, about
150 lines between them. Extract a `ViewOptions` component with two bindable
props. Leave the zoom pill alone; the two differ.

### 3.6 AVIF and JXL panels: `bind:` plus `oninput={apply}`

22 controls are written as `value={x} oninput={(v) => { x = v; apply(); }}`.
The docs guarantee that event attributes fire after bindings, so these become
`bind:value={x} oninput={apply}`. The two selects that convert between string
and number use a function binding.

### 3.7 `isMac` and `isSafari` as constants

Both are `$state` written once in `onMount`, in `+page.svelte` and FocusView.
With `ssr = false` they can be module constants next to the existing
`isSafari` in `client/lazy-app/util`. FocusView has its own Safari regex that
differs from the shared one. Three state fields and one `onMount` go.

### 3.8 Output canvases as attachments

`bind:this` into `$state`, plus an effect that draws, becomes
`{@attach (canvas) => draw(canvas, data)}`. Two canvases in Output.

### 3.9 Seed resize dimensions where results land

Five components each run an effect only to call
`session.seedResizeDimensions()`. One call at the end of `showResult` does the
same. This is the core encode path and a cache hit runs it inside the encode
effect, so the gain is small and the care needed is real.

### 3.10 Stop the global selector leak between the editor and the focus view

`+page.svelte` styles Output through `:global(.editor-root .output)`, which
also matches FocusView; FocusView then overrides it with more global rules.
Passing the offsets as CSS custom properties removes seven global selectors.
The layouts at 760 px and 420 px have no test coverage, so this needs a visual
check on both views.

### 3.11 Diagnostics page: `{#await}`

Two effects that turn a promise into a status union become two `{#await}`
blocks. Dev-only page.

### 3.12 `class:` directives to `class` objects and arrays

The docs now say to consider avoiding `class:`. The main app has 63
directives in 16 files, and three files already use the new form. The gain is
one consistent style, nothing more. The hardening plan left this out of scope
for that reason. Convert files as they are touched, or do one mechanical sweep
if a single style matters.

## 4. Adopt

1. **A root `+error.svelte`.** Today a render error or a client-side 404
   shows SvelteKit's bare default page. One file; pairs with 1.1.
2. **`<svelte:boundary>` around the editor and bulk mode** in `+page.svelte`.
   A render or effect crash inside a panel then keeps the session and offers
   Close and Reset. Close must go through `back()` or `exitBulk()` so the
   history entry unwinds. Boundaries do not catch errors in event handlers or
   async work.
3. **Run Vitest through the Svelte plugin.** `.svelte.ts` modules then compile
   in tests, which unblocks the `editor-history` test planned in
   [test-plan.md](../../test-plan.md). In the node environment modules
   compile for the server and effects do not run, so effect-driven code needs
   a browser-side test project later.
4. **`svelte-check --fail-on-warnings`.** The count is 0 today (**verified**
   in this session's check run). svelte-check 4.7.8 knows `corner-shape`, so
   the "expected noise" note in [design.md](../../design.md) is stale. One
   flag and one doc line.
5. **Use `updated.current` to trigger `registration.update()`.** SvelteKit
   already fetches the version file on every tab focus. One effect lets a
   long-lived tab see a deploy sooner through the existing update prompt.
6. **Types.** `AssetPath` from `$app/types` for the service worker's
   hand-written static file lists, so a rename fails the typecheck. An
   augmentation of `svelte/elements` for `<two-up>` and `<pinch-zoom>`.
7. **Type-check the tests.** 54 test files are never type-checked. They need
   their own tsconfig with Node types and a `tsc` step, and the first run will
   surface errors to fix.
8. **Preload the upright font.** One `<link rel="preload">` in `app.html` with
   the literal `/fonts/Satoshi-Variable.woff2` href and `crossorigin`. Helps
   the first visit only.
9. **Put the Svelte agent instructions in the repo.** `AGENTS.md` points to
   `~/.agents/svelte-mcp.md`, which exists only on the maintainer's machine,
   and the repo is public. The docs supply a block for `AGENTS.md` and a CLI
   fallback (`npx -y @sveltejs/mcp`) for agents without the MCP server.
10. Small ones: `compilerOptions.discloseVersion: false`; `version.name` set
    to the git commit so an identical rebuild does not prompt users to update
    and re-download the precache; a `gotchas.md` note on `$inspect.trace` for
    debugging the encode effects; `svelte-check --incremental` as a local
    fast script.

## 5. Experimental features

| Feature | Verdict | Why |
|---|---|---|
| `experimental.async`: `await` in components and `$derived`, `$effect.pending`, `$state.eager`, `fork` (since 5.36) | Not now | See below. |
| `experimental.remoteFunctions` | No | Needs a server. The docs say queries cannot run when the whole app is prerendered. |
| `experimental.forkPreloads` | No | Preloads the next page's async work. Frisp has one route and no load data. |
| Declaration tags `{const}` and `{let}` (stable, 5.56) | Later | Blocked by the Prettier plugin (1.8). |
| `svelte-check --tsgo` and `--incremental` | Optional | Local speed only; outcomes can differ slightly from the full check. |

Async Svelte is the one that looks tempting, because Frisp is full of async
work. Three things in the docs rule it out for now:

- State that an `await` depends on is not shown in the UI until the await
  resolves. The quality number would freeze during every encode unless each
  such value is wrapped in `$state.eager`.
- Its details are "subject to breaking changes outside of a semver major
  release", and the flag changes the order effects run in across the whole
  app.
- It works on awaits written in components. Frisp's async work lives in
  `EditorSession` and the bulk store: classes shared by both modes, with
  abort, debounce, a result cache and a framework-neutral engine underneath.

The one place it fits is the dev-only diagnostics page, where the stable
`{#await}` block does the same job (3.11). Look again when Svelte 6 turns it
on by default.

## 6. Considered and not recommended

- **Prerender the landing with SSR** (`ssr = true` on the root page only).
  It would give crawlers and first paint real HTML and let the head tags come
  from `brand.ts`. It is large: the whole `+page.svelte` graph must import on
  the server and hydrate without mismatches (theme, media queries,
  localStorage, workers). Social crawlers already get their tags from
  `app.html`. This is a design decision, not a cleanup.
- **Lazy-load the editor and bulk UI.** The route chunk is 218 kB raw and
  66 kB gzipped, but `EditorSession` and the bulk store must stay in it, and
  the service worker precaches everything anyway. Measure before considering.
- **CSP through SvelteKit's `csp` option.** A meta-tag policy does not govern
  workers or the service worker, which is where the codecs run. A real "no
  upload" guarantee would be a CSP response header in `static/_headers`. That
  is worth its own decision as a privacy feature.
- **`on()` from `svelte/events`** for the 12 add/remove listener pairs. Its
  ordering guarantee does not apply to these sites (capture phase, window,
  drag events), and it attaches pointer and wheel listeners one microtask
  later. Not simpler.
- **AVIF and JXL seed-once state as writable deriveds**, dropping
  `{#key options}`. It breaks the remembered lossy quality unless keyed on
  object identity. Fold it into the codec options model project.
- **Bulk `globalSide` as a derived.** Refuted: it drops the guard that keeps
  the panel stable after the user's own edits.
- **The `src/service-worker/` folder layout.** Editor ergonomics only, and 12
  docs name the current path.
- **A warning before closing a tab with images open** (`beforeNavigate`,
  type `leave`) and **`animate:flip` on strip cells.** Both are product
  decisions, not cleanups.
- **No fit:** ESLint with eslint-plugin-svelte, adapter-cloudflare,
  `bundleStrategy` single or inline, the hash router, snapshots, a client
  `handleError` hook, `Spring` and `Tween`, `createSubscriber`, the context
  API, enhanced-img.

## 7. Suggested order

- **Batch A, fixes and deletions.** 1.1 to 1.7, section 2 items 1 to 7, and
  section 4 items 1, 4, 6 and 8. All small. One session, with the full e2e
  suite at the end because the service worker and the build change.
- **Batch B, the alias sweep.** 3.1 with 3.2. Mechanical, its own commit, full
  e2e.
- **Batch C, component simplifications.** 3.3 to 3.8, 3.10 and 3.11, plus
  section 4 items 2 and 3 with the first rune test. These need visual checks.
- **When touched.** 3.9, 3.12, the lab option files, and section 4 items 5,
  7, 9 and 10.

## Already right

No `export let`, `on:`, slots, stores or `use:` actions anywhere; 34
`{@attach}` uses; host objects kept in `$state.raw`; `svelte/reactivity/window`
and `MediaQuery` in place of hand-written listeners; `EditorSession` disposes
every effect it creates; `$app/state` instead of stores; the service worker on
`$app/manifest`; tsconfig on `$app/tsconfig`. A walk through the SvelteKit 3
migration guide found nothing unapplied except the two known items (aliases,
`pushState`) and the classic service-worker registration (1.7).

## Coverage

Read: 150 sections. Not read: `svelte/compiler-errors` and the long
`@sveltejs/kit` type reference (optional pages, skipped for room); pages for
hosts and tools Frisp does not use (adapters for Node, Bun, Netlify and
Vercel; add-ons for auth, databases, i18n, Markdown, Storybook and Tailwind;
editor-specific AI setup); the Svelte 3 and 4 legacy syntax pages, since the
code has none; and migration guides for versions before SvelteKit 3.

Limits: the Cloudflare behavior in 1.1 is inferred from the build output and
the Workers settings, not observed on a deploy. Call-site counts come from the
checkers' greps and can be off by a few.
