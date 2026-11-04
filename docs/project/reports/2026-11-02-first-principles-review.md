# First-principles review, 2026-11-02

Last updated: 2026-11-04.
Status: trust fixes, low-risk cuts, and changes A and B executed 2026-11-04
(see Execution); change C is done except the supported batch size; D to F and
auto-quality open.

The maintainer asked for the app to be questioned from scratch: if we built
Frisp today, what would we remove, change, and add? This is the second such
review. The first, [2026-07-07-first-principles-review.md](2026-07-07-first-principles-review.md),
mostly landed; this one does not repeat what it closed.

How it was made: a driver pass (Opus 5.5) that read the core and used the app
in the browser at desktop and phone widths; four read-only layer audits
(single editor, bulk, codec/worker/build, lab/docs/process); an independent
top-down verdict from the `judge` role (Fable 5.1); and two independent
council opinions (GPT-6.1 Sol and GPT-6 Astra), each written without seeing
the others. The driver re-checked every claim marked verified against the
code. Line counts are `.ts`/`.svelte`/`.css` lines from `git ls-files`.

## Execution (2026-11-04)

The maintainer's answers to the decisions at the end: trust fixes first; keep
the lab skins for now (the UI gets revisited soon); jpegli is the one JPEG;
keep the desktop app on the roadmap; proceed with everything else. Each bug
below was reproduced before its fix (browser e2e where the behavior is
observable, unit tests for pure logic), and each fix has its own commit.

| Item | Outcome | Commit |
|---|---|---|
| T1 stale Save | Reproduced in Chromium (WebP bytes saved as `.avif`). Fixed: `SideRuntime.exportable` gates Save and Share. | `42c0bf8d` |
| T2 bulk rotate | Reproduced (export stayed 1024x683). Rotate hidden in bulk until the recipe carries rotation (change A). | `3b6fe559` |
| T3 SVG batch | Reproduced, but preview and export agree (both WebP). Deferred to change A, which adds a vector lane to the one recipe. | none yet |
| T4 keep originals | Reproduced at unit level. The original stands in only for a pure re-encode. | `f387de6c` |
| T5 multi-tab update | Confirmed in code; fix verified with two real Chromium tabs. | `fe183e14` |
| T6 offline | Worse than reviewed: with the network truly off, no first encode worked at all, raster or SVG, because no worker chunk was precached. Fixed with a build-time worker list. | `5b608581` |
| T7 stale bulk jobs | Reproduced 3 of 3 with a 12 MP photo; the remove-mid-encode stall reproduced 1 of 3 in WebKit. Both fixed in the runtime. | `3b6fe559` |
| SVG Auto fallback | Keeps the original when nothing passes the gate. | `4b4d878b` |
| jpegli tooltip, one JPEG | jpegli is "JPEG"; MozJPEG saves migrate; MozJPEG no longer precached. | `bf7da4dd`, `579f7bee` |
| WebP default | Back to method 4. | `555def1c` |
| Dead code | `compressFile` and the WebP-era bulk store API, 267 lines. | `76140ac3` |
| Side slots | Copy/save/import buttons gone from production; session methods stay for the labs. | `d49552d0` |
| `/diagnostics` | Stripped from production with its probe workers. | `1de9e651` |

Change A landed the same day per
[../specs/2026-11-04-one-recipe-per-image.md](../specs/2026-11-04-one-recipe-per-image.md),
and change B per
[../specs/2026-11-04-worker-side-pipeline.md](../specs/2026-11-04-worker-side-pipeline.md)
(commits `0233c3a2` to `e86298cb`). Change B's measured outcome: zero
full-frame structured clones on the encode path (enforced by
`tests/e2e/worker-pipeline.spec.ts`), 1,857 lines deleted against the
review's estimate of 600 to 800 (the rest was the `/diagnostics` pipeline
probe and the engine-level bulk runner, which only that chain served), bench
sizes byte-identical, and bench times flat (the bench runs no processor
steps, and its measured side now decodes the source in its own worker instead
of reusing the main thread's decode).

Corrections to this review, found while executing: the AVIF and WebP WASM
decoders were already skipped from precache on browsers with native decode,
and the QOI encoder was already excluded, so the precache row below
overstated the waste; and hqx is a selectable resize method ("hqx (pixel
art)"), not an unused processor, so it stays.

## Verdict

**Keep the architecture. Fix trust, then cut, then build the one engine
function everything else needs.**

The engine is right and would be built the same way today: from-source WASM
codecs with provenance, one codec worker, multi-threading with a
single-thread fallback, the pure bulk reducer engine, one signature module for
cache keys, and the static-output audit plus a real e2e suite.

What is wrong, in order of cost:

1. **The saved file can disagree with what the user asked for.** Six
   paths confirmed in code, plus one likely, export the wrong bytes, the
   wrong name, or an untouched original, or lose work. An optimizer whose export cannot be trusted has no product, so
   this comes before any structural or cosmetic work.
2. **Two editing models for one job.** The single editor is a two-sided
   Squoosh compare; bulk is one recipe per image; bulk mounts a real
   `EditorSession` and translates between them. Several of the correctness
   bugs are this seam leaking (rotation, SVG, stale results).
3. **Undecided work outweighs shipped work.** 17.3k of 43.3k source lines are
   lab experiments, docs are 19.6k lines against about 26k of production code,
   and the roadmap carries a dozen open decisions. The repo has been idle since
   2026-08-17 (commits per month: May 482, June 176, July 282, August 26,
   September 0, October 0).
4. **The brain is missing.** Auto-quality, the thing that would make Frisp
   different from Squoosh, has a finished spec and no code.

## 1. Trust: the export contract (fix first)

Each item was found by a council reviewer and confirmed by the driver in code.
None was reproduced in a browser yet; each needs a regression test that fails
before the fix.

| # | What goes wrong | Evidence |
|---|---|---|
| T1 | Switch format and press Save within 500 ms, or Save after a failed encode: the download carries the *previous* bytes under the *new* extension (WebP bytes named `.avif`). | Save is disabled on `!result \|\| working` (`OptionsPanel.svelte:286`), but `working` is `showSpinner`, which only turns on after a 500 ms delay (`editor-session.svelte.ts:197`). `downloadName` follows the selected format (`:1178`). The error path sets `status = 'error'` and never clears `result` (`:534`). |
| T2 | Rotate in bulk's focus view changes the preview but not the exported file. | `FocusView.svelte:308` rotates the focus `EditorSession`; `BulkImageSettings` (`client/lazy-app/bulk/settings.ts:15`) has no rotation field. |
| T3 | One SVG gets vector optimization; two SVGs get rasterized to WebP. | Bulk defaults to WebP (`store.svelte.ts:173`) and `bulk/processor.ts` has no SVG path. |
| T4 | "Keep originals when larger" (on by default) can replace an explicit format conversion, resize, or grain edit with the untouched source in the ZIP. | The guard compares bytes only (`client/lazy-app/bulk/export.ts:230`). |
| T5 | Accepting "Refresh" in one tab reloads every other Frisp tab, discarding unfinished work there. | Every controlled tab reloads unconditionally on `controllerchange` (`client/lazy-app/sw-bridge/runtime.ts:29`). |
| T6 | Offline after first load is not true for SVG: the first SVG optimized offline has no worker. | The SVG optimizer worker is deliberately excluded from precache (`service-worker.ts:27`) and cached on first use; the e2e offline test optimizes an SVG online first. |
| T7 | Changing settings during a slow first encode can leave that job finished with stale settings and nothing requeued; removing an active job may drop the restart. Export then silently omits it. | Plausible from `store.svelte.ts:758` and the abort-ends-loop condition in `bulk/runtime.ts:95`; needs a delayed-encode test to confirm. |

**Fix shape.** One result contract: each result carries the source identity,
the recipe signature, the actual format, and its filename, and Save, Share,
and ZIP export accept only a result whose recipe matches the current one.
Bulk completions carry a recipe revision and are requeued on mismatch. Keep
the original only when it satisfies everything the user asked for. Precache
the SVG worker (the audit assertion protecting the exclusion changes with
it). Hold a waiting service worker while any tab has unsaved work.

Two smaller honesty fixes belong here too. The jpegli tooltip says "around
30% better compression"; the landed measurement is about 7 percent at
defaults (`compress.ts:83`). SVG Auto returns a candidate that failed its own
visual gate when nothing passes (`svg/auto-search.ts:162`); it should return
the original and leave visual changes to Manual.

## 2. Where things stand (verified)

| Area | Fact |
|---|---|
| Size | 43.3k source lines: 26.0k production, 17.3k lab. Docs 19.6k lines in 93 files. |
| Build | 19 MB, of which 17.6 MB is WASM in 20 files; the AVIF and JXL encoders are about 13 MB. |
| Precache | 15 codec records precached, including the AVIF and WebP decoders (fallback-only on evergreen browsers), both QOI codecs (QOI is hidden from the picker), MozJPEG, and hqx. |
| Encode path | About 11 code layers from slider to pixels. Every enabled processor is its own worker round trip with a structured-clone copy each way, and the output is decoded back on the main thread for the preview. July's P2(b) composite op and P2(c) worker decode are still open. |
| Single editor | Two full sides. The left side defaults to an "identity encode" of the original. Per-side Save/Import settings slots and "Copy to other side" exist. |
| Bulk | The focus view runs a second `EditorSession`, hand-seeded from the store (`BulkMode.svelte` about 150 to 400). Selection lives in two places. Dropping several files onto an open single image abandons that image (`+page.svelte:117`). Every import starts a full-resolution thumbnail decode at once (`store.svelte.ts:416`); historical outputs have no byte cap; the ZIP is built as one Blob. |
| Dead code | No callers: `compressFile` (`compress.ts:319`) and the WebP-era bulk store API (`updateGlobal`, `overrideSelected`, `resetOverridePath`, `effectiveOptionsFor`, `isPathOverridden`, `applySelectedOverrides`, `BulkOverridablePath`; about 150 lines). |
| UI leaks | Bulk's Global scope still offers "Copy settings to other side", "Save side settings", and "Import saved side settings". On phones, "View options" and "Open settings" share the same sliders glyph. |
| Production | `/diagnostics` is live on frisp.app, precached, and required by `audit-static-output.mjs:597`. Only its landing link is dev-gated. |
| Defaults | WebP ships at method 6 despite the recorded transparency case (2,880 ms against 57 ms at method 4, slightly larger output; `issue-list.md`). JPEG appears twice in the picker; MozJPEG is still "JPEG". |
| Browsers | Playwright runs Chromium and WebKit only; `browser-support.md` promises Firefox 115 ESR. |
| Node codecs | 21 `*_node_*` artifacts (11.8 MB) are committed and unused by the app. They are the planned CLI's codecs, with mixed freshness: JXL and jpegli rebuilt 2026-08, AVIF last built 2024-01. |
| Roadmap | "Now" (SVG S8) has sat since 2026-07-12 with only the Frisp run and write-up left. Every "Next" item has been idle since July. Two specs have said "in progress" since 2026-07-07. |

## 3. The product, questioned

**The job.** "Make this image, or this folder, as small as its destination
allows without visible damage, locally, and tell me what happened." Squoosh
gives knobs for one image and is no longer developed. ImageOptim keeps the
format and only does lossless. TinyPNG uploads. Figma export is fixed quality.
`cwebp`, `avifenc`, and `sharp` give agents knobs. None takes an outcome as
the contract. That is the wedge: **state the intent, get a verified result,
nothing leaves your machine.** Privacy alone is not a wedge; Squoosh had it.

**Humans want outcomes too.** The 2026-08-08 thesis splits the doors as
"agents state targets, humans choose format and quality". All three outside
reviewers disagree. A person wants "small enough for this upload" or "smaller
without obvious damage" as much as an agent does. The default human flow
should be: recommended output, maximum dimensions, a named quality, compare,
Save. Format, encoder, effort, grain, and palette stay available under
Advanced.

**Where the reviewers split, and the call.** The judge wanted the engine,
auto-quality, then a published CLI and MCP adapter ahead of the UI tracks.
Both council models pushed back: the CLI is a placeholder, nothing in the repo
shows a recurring headless workflow, and a library, CLI, MCP adapter, and
Raycast extension are four maintenance surfaces for one person. The driver's
call: build the engine boundary because the UI needs it anyway (performance,
memory, one result contract), prove one complete Node operation inside that
work because it costs little and keeps the boundary honest, and do not ship
CLI, MCP, or Raycast distribution until a real recurring workflow asks for
it. The 2026-08-08 rule that agent work is "never deferred" should become
"never designed out".

**Who it is for is a guess.** There is no usage signal, so "does anyone use
the two-sided compare" cannot be answered. Consider a cookieless page counter
(Cloudflare Web Analytics fits the privacy stance) and a small manual
acceptance set: import-to-save time, first useful result, and one large batch
on a desktop and a phone.

## 4. Remove

Ranked by what it removes over what it risks. Everything touching codecs,
workers, or the service worker needs the full gate including `test:e2e`.

1. **Dead code** (verified, low risk). `compressFile` and the WebP-era bulk
   store API, about 170 lines. Re-grep with quoted globs first: in zsh an
   unquoted `--include=*.svelte` matches nothing and looks like proof.
2. **The two-sided editor's Squoosh-isms.** Per-side Save/Import slots and
   "Copy to other side" (about 120 lines, low risk; autosave untouched), and
   the original rendered directly instead of as an identity encode on side 0
   (about 80 lines). This also removes the leak into bulk's Global panel.
3. **The lab, after one decision.** Decide the re-style in one bounded
   session: hybrid, or keep production. Then freeze the losers: tag them
   (`lab-archive-2026-11`) and remove them from the tree, which drops about
   13k lines and three extra consumers of `EditorSession`. Keep the crop tool
   separate from that decision; it is wanted either way. The lab is already
   stripped from production, so this is a maintenance and attention win, not
   a download win. `docs/lab.md` forbids deleting "ongoing" lab code, so the
   maintainer retires the entries first.
4. **One JPEG in the picker.** Make jpegli the JPEG and move the encoder
   choice under Advanced; map stored `mozJPEG` choices on read; bench before
   retiring MozJPEG (276 KB precache).
5. **QOI encode, hqx, and fallback decoders out of the precache.** Remove QOI
   encode and hqx (pixel-art upscaling, no visible user); move the AVIF and
   WebP WASM decoders (1.4 MB) to on-demand caching. WASM import names make
   this e2e territory.
6. **`/diagnostics` from production** (about 1.1k lines with its probes).
   Strip it like `/lab` and update the audit assertion.
7. **Docs in the working set, not docs in history.** Move concluded design
   records (bulk UI options, parity audit, threading enablement, the intro
   record, the svelte hardening plan once its open items are checked) into
   `docs/history/`. Keep the engineering evidence; this is a move, not a
   purge. Cap the 1,063-line worklog. Link the 2.5k-line user guide from the
   app or cut it to one page; nothing links to it today.
8. **Open decisions.** Cut the roadmap to three items. Move keyboard control,
   bulk Phase 3 polish, Raycast, and Electron to Later. Close the SVG S8
   benchmark with what it has (the spec already records the baselines and the
   blocked legs) instead of leaving it in Now.

Not removed: the 21 Node codec artifacts. The codec audit called them dead;
they are the CLI's codecs. The better fix is to build each codec once for
both web and Node so there is no stale twin.

## 5. Change

In dependency order. Sizes are estimates for one person.

**A. One recipe and one result owner per image** (2 to 3 weeks). This is the
smallest version of the "one model" idea, and the one that fixes T1 to T4 and
T7 at the root. Define one typed recipe that covers rotation, processors, and
output kind (raster codec, SVG optimize, or JPEG transcode), and one
source-aware `optimize(source, recipe)` operation that dispatches all three.
Bulk schedules recipes; the focused editor previews the same result; nothing
casts one model into the other. Keep the existing views during the
migration. Do not merge the two controllers into one universal session yet.

The `app:settings:v3` freeze does not block this. `settings-storage.ts:16`
freezes the key *names* so they never follow a rebrand, and line 56 already
extends the payload in place. The new recipe reads today's two-side payload
(side 1 becomes the recipe) under the same key.

**B. Move `optimize()` into the worker** (1 to 2 weeks). One op keeps the
decoded source hot, runs every step inside the worker, and returns the bytes
plus a transferable `ImageBitmap`. Zero full-frame structured clones; the
per-codec client passthroughs, the seven-case `compressImage` switch, and the
main-thread canvas decode go (an estimated 600 to 800 lines). This is July's
P2(b) and P2(c). It is also where one Node operation gets proven: the same
function in a `worker_thread` with the Node artifacts. Bench before and after.

**C. A bulk resource budget** (about 1 week, alongside B). Bound thumbnail
decodes and prioritize visible images; close bitmaps right after drawing; cap
historical outputs by total bytes; budget codec threads against concurrent
jobs (each OxiPNG worker asks for every core, `codec-worker.ts:238`). Measure
and publish a supported batch size before adding any format race.

**D. Auto-quality on one codec, then the default flow** (about 2 weeks).
Before building it everywhere, prove it on one codec and fix two gaps in the
spec: it ignores alpha (line 105), and it allows up to eight full encodes per
search (line 302), which needs a latency budget and an honest "target not
met" result. Then make named targets the primary control and move knobs under
Advanced. An optional byte target ("under 200 kB") belongs here too.

**E. Extract `src/engine/`** (3 to 5 days, after B). The July P10 rename:
`client/lazy-app`, `features`, `shared/codec-*`, `worker`, `worker-shared`,
and `sw` become one package with no Svelte imports, and seven path aliases
become one. Do it after B so files move once.

**F. Then, and only if usage asks: the unified document.** With one recipe
and one result owner in place, "a document of 1 to N images" and "compare as
a view" become small steps rather than a rewrite: A/B between two encodings
by pinning the current result, and dropping more images onto an open one
grows the document. Overrides can then become "an image follows the shared
recipe or owns a full copy", about 300 to 400 lines simpler than today's
sparse per-leaf paths. The options-model refactor shrinks to a registry for
whatever stays under Advanced.

## 6. Add

- **The export contract and its tests** (section 1).
- **Outcome-first defaults** in the UI, then targets and an explicit "Find
  smaller" action with time and memory limits. Not an automatic five-format
  race on every import.
- **Visible metadata control**: keep or strip EXIF and ICC as an explicit
  choice. Verify what survives today before designing it.
- **A Firefox e2e project**, or soften the support claim.
- **Save to folder** for bulk (File System Access API) and manifest
  `file_handlers`, ahead of any Electron shell, which this review recommends
  dropping from the roadmap.
- **A usage signal** and the manual acceptance set (section 3).

## 7. Keep

- The codec layer end to end: from-source builds, `codec-provenance.md`, the
  single asset manifest, MT with ST fallback, the static-output audit, e2e on
  the real build. No browser API replaces the AVIF, JXL, OxiPNG, or
  imagequant encoders.
- The pure bulk reducers, warm per-slot bridges, decoded-source reuse,
  `encode-signature.ts` as the only key logic, `ResultCache`, undo and redo,
  and comparison against the real encoded output.
- SvelteKit static with Svelte 5 runes and `ssr = false`.
- The privacy line: the tool moves to the images, never the reverse.
- Brand confinement in `src/shared/brand.ts`, signed commits, ff-only merges,
  the "comments are contracts" exemplars.

## 8. Order, for one maintainer

1. **Trust fixes** (about 1 week). T1 to T7 with failing tests first, the
   tooltip, SVG Auto's fallback, and a remeasured WebP default.
2. **Decision day** (1 to 2 days). Re-style yes or no; jpegli is the JPEG;
   Electron off; roadmap cut to three; SVG S8 closed. Then the low-risk cuts
   in section 4. Full gate including e2e.
3. **A**, one recipe and one result owner.
4. **B and C**, the worker-side `optimize()` with one Node operation, and the
   bulk budget. Bench before and after.
5. **D**, auto-quality on one codec, then outcome-first defaults.
6. **E**, the engine package.
7. **F** and any CLI distribution, when usage or a real workflow asks.

## Where the reviewers disagreed

- **CLI timing.** The judge put a published CLI and MCP adapter fourth; both
  council models said defer until a workflow demands it. Resolved above:
  prove the Node path inside B, ship distribution later.
- **How far to unify.** The judge and the bulk audit proposed one document
  model; Astra warned against a universal session and asked only for one
  shared operation; Sol asked for one recipe and one result owner per image.
  Resolved: Sol's version first (A), the full document later (F).
- **Node artifacts.** The codec audit called them dead; the others keep them.
- **The settings freeze.** The editor audit treated it as a blocker; the
  judge proposed a `v4` key. The source settles it: the freeze covers key
  names, and payload extension under the same key is already the practice.
- **Docs.** The judge and the lab audit proposed cutting hard; both council
  models warned against a purge. Resolved: move concluded records into
  `docs/history/`, delete nothing.

## Decisions for the maintainer

1. Trust fixes first, ahead of every other track?
2. Re-style: hybrid, or keep production? Either answer retires the lab skins.
3. jpegli as the one JPEG, with the encoder choice under Advanced?
4. Outcome-first defaults for humans (named quality and max size up front,
   knobs under Advanced)?
5. Agent work: "never deferred" becomes "never designed out", with CLI
   distribution waiting for a real workflow?
6. Drop Electron from the roadmap?
7. Add a cookieless usage counter?
