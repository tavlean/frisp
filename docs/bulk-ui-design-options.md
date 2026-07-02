# Bulk UI — design options & feature roadmap

Last updated: 2026-07-02.
Status: in design → lab. Round 1: options written. Round 2 (same day):
maintainer confirmed **no separate `/bulk` route (A2 out)**, **ZIP in v1**,
and the **size-increase guardrail in v1**; concept images generated to
`~/Downloads/sqush-ui-concepts/`; §10–§12 added (A1↔A3 horizons, save
destination + settings panel, crop + export renditions). Round 3 (same day,
after reviewing the images): **layout goes to a two-variant lab** (grid home
vs focus-first home — §3); **left side becomes a dynamic contextual panel
with image info by default** (§4, rewritten); **override signaling decided**
(§5: dots; ring = selection only; no count badges); **A1 now → A3 later
confirmed** (§10); **save-back-to-source deferred** but kept on the list;
**folder import promoted into Phase 2** (§11). Round 4 (same day): the lab from
the layout section is BUILT and live at `/lab/bulk` (dev-only); pick L1 or L2
there.
This is the "Design First" step required by [road-map.md](road-map.md) before
any production bulk UI. Engine reference: [bulk-image-architecture.md](bulk-image-architecture.md).

---

## 1. Where we actually stand (surprising headline)

**The bulk engine is already built.** `src/client/lazy-app/bulk/` holds ~15
pure, framework-neutral modules — session/jobs, global-settings + sparse
per-image overrides (`getEffectiveSettings`, `getSettingsOverridePaths`),
scheduler with bounded concurrency, headless per-job processor, multi-file
import with MIME sniffing, stale-gated export planning with duplicate-safe
names, metadata-only snapshots, and ready-made view-models for a strip/detail/
summary UI. It is proven end-to-end (the diagnostics probe runs
`processBulkImageJob` through a real encode).

The maintainer's desired model — *global settings apply to all; touching a
control while an image is selected overrides just that field for just that
image; untouched fields keep following the global; badge + reset; Save All* —
**is exactly the model the engine already implements.** No engine redesign is
needed; this document is purely about the UI and the wiring.

What does **not** exist:

| Gap | Detail |
|---|---|
| All UI | No bulk route/mode, strip/grid, override panel, export controls |
| Multi-file entry | `<input>` lacks `multiple`; `EditorSession.pickFiles` keeps only `list[0]` (drop layer already passes the full `FileList`) |
| Worker pool | `runner.ts` accepts `workerBridges[]` but nothing instantiates a pool (editor has 2 per-side bridges — the proven pattern to copy) |
| Reactive wrapper | No `.svelte.ts` store wrapping the pure reducers |
| Thumbnails / memory | `thumbnailUrl`/`previewUrl` fields exist, nothing fills them; no decode-on-demand cache |
| ZIP | No archive lib in `package.json` |
| Tests | 0 coverage of ~2,000 LOC; [test-plan.md](test-plan.md) §4 has the ready plan (~73 cases, top-8 first) |

---

## 2. Decision A — where bulk lives

| | Option | Verdict |
|---|---|---|
| A1 | **Mode of the same route**: dropping/picking N files at the app boundary routes to bulk; 1 file keeps today's editor untouched | **Chosen path** — but as the *starting point* of a declared A1→A3 convergence, not a permanent split. See §10 |
| A2 | Separate `/bulk` route sharing the core | **Rejected by maintainer (2026-07-02).** |
| A3 | First-principles unification: *everything is a batch, single image = batch of 1* | The right *end-state* (every planned feature — crop, renditions, save-to-folder — is batch-shaped). Wrong as a *first step*: it rebuilds the proven editor before shipping any bulk value. Reached via the convergence rules in §10 |

## 3. Decision B — the main layout (the real choice)

Both serious options need the same focus/inspect surface (the existing two-up).
They differ only in what the **batch home** looks like.

### Option B1 — Grid dashboard + focus mode  ← recommended

- Dropping N images lands on a **grid of cards**: thumbnail, filename,
  `1.2 MB → 340 kB`, `▼72%` chip (amber `▲` if larger), status ring while
  encoding, a small **● deviation dot** when the image has custom settings.
- One **global settings panel** docked at the side; in grid view it always
  edits globals. A totals bar: "12 images · 14.2 MB → 4.1 MB · ▼71%" + **Save
  All**.
- **Click a card → focus mode**: the existing two-up editor (original |
  result) for that image, with a **mini-filmstrip** for next/prev
  (`selectNextJob`/`selectPreviousJob` already exist). Esc / back / ✕ returns
  to the grid — back-button works via SvelteKit shallow routing (`pushState`),
  the documented pattern for exactly this.
- Scope is **geographic, not modal**: grid = everyone, focus = this image.
  "How do I make a global change while an image is selected?" → you go back to
  the grid (one click). No mixed state, nothing to explain.

*Pros:* matches the maintainer's own description almost verbatim ("below each
image we see the information…"); true batch overview at a glance; scales to
dozens of images; size-increase warnings visible per card; mobile story is
clean (2-col card grid → full-screen focus).
*Cons:* most new UI of the options (grid + cards + transition), though
`strip.ts`/`summary.ts` already provide the view-models.

### Option B2 — Filmstrip + always-on stage (the old sketch in bulk-image-architecture.md)

- The editor keeps a **large two-up stage** at all times; a **bottom filmstrip**
  holds all images (thumbnail + size chip + deviation dot); the selected image
  fills the stage.
- The side panel is **scope-switched**: nothing selected → global; image
  selected → that image (needs a very explicit scope header + deselect
  affordance, because both states look alike — this is where the maintainer's
  "there should be no confusion" worry lives).

*Pros:* maximum reuse of today's layout; inspection always on screen; feels
like Lightroom.
*Cons:* weak batch overview (one image large, the rest are tiny chips);
scanning 30 results means reading a tiny strip; the global-vs-selected
ambiguity has to be solved with labels rather than geography; mobile gets
crowded (vertical two-up + strip + panel).

### Option B3 — Table/list view

Info-dense rows, pro-tool feel, but poor visual inspection — wrong identity
for a visual compare tool. **Rejected as the primary**; keep as a possible
density toggle on the grid later.

**DECIDED (maintainer, 2026-07-02, after concept images): two-variant lab.**
The pair is *not* B1-vs-B2 as originally framed — the images sharpened it:

- **Variant L1 — "Focus-first home"** (maintainer favorite,
  `bulk-focus-mode.png`): dropping N images lands directly in the focus view —
  big before/after stage of the first image, mini-filmstrip below for
  switching, batch card (totals + Save All + global entry point) top-left,
  per-image panel right.
- **Variant L2 — "Grid home"** (`bulk-grid-dashboard.png`): dropping N images
  lands on the card grid with the global panel; clicking a card opens the
  same focus view as L1.

So the two variants share the focus view itself; the lab question is **what
you land on and how navigating scope feels**. B3 (table) stays rejected as
primary; candidate for a grid density toggle later.

Reference images for the lab live in-repo at
[references/bulk-lab/](references/bulk-lab/) (`bulk-focus-mode.webp`,
`bulk-grid-dashboard.webp`, `override-signaling-dots.webp`).

## 4. Decision C — what the left side becomes

**DECIDED (maintainer, 2026-07-02): the left side is a DYNAMIC, contextual
panel.** Governing principle: **LEFT = what you're looking at + its tools;
RIGHT = compression settings for the current scope.**

**Default content — image info, always at a glance** (single-image mode and
bulk focus view alike):

- filename and **original format**;
- **pixel dimensions** and original **file size** — today you must open
  Resize just to learn the dimensions; that pain goes away;
- **inferred nearest aspect ratio** from the dimensions (1:1, 5:4, 4:3, 3:2,
  16:10, 16:9, 21:9 and portrait counterparts; label as "≈ 16:9" when not
  exact) — orients "what shape is this image" instantly;
- room for more (megapixels, has-alpha, EXIF orientation…) as needs appear.

**Dynamic tool sections take over / stack in the same slot:**

- **"Compare as…"** button — summons the second encode side on demand (the
  old always-on left format panel becomes an opt-in power feature; live
  two-slider codec A/B is preserved, just not the default);
- **Exports/renditions** (later — §12) live here when used;
- **Crop options** (aspect chips, size, reposition hints — §12) appear here
  when the crop tool is active;
- any future feature (the maintainer explicitly includes ideas as far out as
  layers) reuses this slot instead of inventing new chrome.

**Bulk grid scope:** the "thing you're looking at" is the batch itself, so
the left panel shows batch info (count, total original → optimized, savings)
+ the global settings + Save All — same principle, batch scope.

The right side stays the fixed compression panel for now; making it dynamic
too is noted as a possible future step, not part of this design.

## 5. Override signaling & reset — DECIDED (maintainer, 2026-07-02)

Style: the **dots** concept (`override-signaling-dots.png`), with one
reassignment — the coral **ring means "currently selected", never
"overridden"**:

- **Per-control:** a small coral ● dot next to each overridden control +
  per-control reset affordance; **no slider recoloring, no row tinting**.
  "Reset all to global" stays in the panel header (`applyClearJobOverrides`).
- **Thumbnail/card:** a small corner ● dot = "has custom settings". **No
  count badges** ("2 custom" pills rejected). Tooltip may list deviated
  fields via `getSettingsOverridePaths`.
- **Selection:** coral ring/outline around the thumbnail = selected. Ring and
  dot are independent signals.
- **Global changes** requeue only non-overridden stale jobs — engine already
  guarantees this (`applyGlobalSettings` → `requeueStaleJobs`).
- Per-image **format** override is allowed (engine supports it) — e.g. one
  logo stays PNG while the batch goes WebP.

## 6. Export — revising one old decision

The old plan said "individual downloads first, ZIP later". **CONFIRMED
(maintainer, 2026-07-02): ZIP in v1.** N programmatic downloads trip browser
multi-download blocking (bad first impression), upstream demand is explicitly
for ZIP (Squoosh #1428), and the memory argument is weak — outputs are
already-compressed blobs held in memory either way; `client-zip` (~2.4 kB,
streaming, STORE mode — no recompression) adds almost nothing. Per-image
download buttons stay. Save-to-folder is now a designed follow-up, not a vague
"later" — see §11.

Also **CONFIRMED for v1**: the **size-increase guardrail** (upstream #984) —
amber card when output ≥ original + a "keep original when larger" export
toggle (default on). "Never ship a bigger file."

## 7. Open items folded in from docs/upstream (so nothing is missed)

- **Mixed-size resize rule** (flagged unresolved in the architecture doc):
  global resize must be batch-sane. Recommend two global modes — *percentage*
  and *fit within W×H box* (the common "max 1600px" case) — with exact
  per-image dimensions only as a per-image override. Decide default at build
  time; preset chips exist (`sizePresets = [0.25, 0.5, 1]`).
- **Memory ceiling:** lazy thumbnails via `createImageBitmap(file,
  {resizeWidth})`; decode full-res only for focus + active encodes;
  concurrency stays 2 (engine default); revoke object URLs on remove/replace
  (`urls.ts` helpers exist).
- **Engine unit tests first** — test-plan §4 top-8 (queue counters, stale
  requeue, snapshot parse/restore, export dedup…) locks the contract the UI
  sits on. Pure logic, zero design dependency: ideal cheap-model work.
- **codec-options-model.md** pre-pays richer override panels, but v1 bulk is
  WebP + a small option set — don't gate bulk on that refactor; run it as an
  independent track.
- **Multi-Format Compare** stays a separate feature; the bulk worker pool is
  the same substrate it needs, so bulk-first builds its foundation.
- Later ideas kept on the list: folder import (+ preserved paths), PWA share
  target ("send 20 photos to Sqush"), presets (save globals as named preset),
  batch summary/CSV report, list-density toggle, target-file-size mode.

## 8. Recommended roadmap (phases)

| Phase | Contents | Needs |
|---|---|---|
| **0 — Engine safety net** | Vitest + `npm run test:unit`; top-8 engine tests, then the rest of test-plan §4; fix the stale ":covered with tests" claim in bulk-image-architecture.md | No design decisions; cheap-model executable; **can start now** |
| **1 — Layout LAB (active)** | Two variants behind a dev-only route, shared engine wiring: **L1 focus-first home** vs **L2 grid home** (§3). Winner promoted, choice recorded | Maintainer eyes on the lab |
| **2 — Minimum Useful Bulk** | Multi-file entry (input `multiple` + boundary routing) **+ folder import** (webkitdirectory picker + dropped-folder traversal — §11), reactive bulk store wrapping the engine, worker-bridge pool (2, per-side-bridge pattern), batch home per lab winner, global WebP panel (reuse existing panels), statuses/sizes/cancel/retry, totals bar, **Save All (ZIP)**, size-increase guard; bulk e2e smoke | Phase 1 winner |
| **2b — Contextual left panel v1** | Image-info panel (name, original format, dimensions, size, inferred ≈aspect — §4) + "Compare as…" button; ships in the single-image editor independently of bulk, then reused by focus view | Independent — can land any time |
| **3 — Overrides & focus** | Focus mode reusing two-up + mini-strip nav, per-image scope panel, per-control override dots (§5: ring = selection, no count badges), corner-dot card marker, reset (control/image), per-image format override, shallow-routing back-button | Phase 2 |
| **4 — Scale & polish** | Lazy thumbnails + decode LRU, mixed-size resize UX, AVIF as second bulk format, naming templates, presets, report, density toggle; **Settings panel** (§11; save destinations only if save-back is revived) | Phase 3 + usage feedback |
| **5 — Crop** | Crop as a `ProcessorState` stage (aspect + normalized focal point — §12): single-image crop UI, bulk global crop + per-image reposition via the override machinery | Phase 3 (override UI) |
| **Later track — Renditions** | One source → N named export recipes (§12): renditions panel, *(source × rendition)* jobs, grouped grid, naming templates | Phase 5 (crop) + own design pass |
| **Later track — A3 convergence** | Focus-mode parity checklist → flip single-file entry to a 1-item batch, retire `EditorSession` (§10) | Parity checklist closed |

Priority note: maintainer decision 2026-07-02 — **bulk now outranks
Multi-Format Compare** in the product order (road-map.md updated accordingly).

## 9. Design questions — resolution state

1. ~~Batch home~~ → **LAB** (decided 2026-07-02): L1 focus-first home vs L2
   grid home (§3). The lab's winner is the last open layout question.
2. ~~Left side in bulk~~ → **decided**: dynamic contextual panel, batch scope
   in grid view (§4).
3. ~~Single-image left panel~~ → **decided**: image-info panel + "Compare
   as…" button (§4) — not a chip; renditions join later (§12).
4. ~~ZIP in v1~~ → **confirmed yes**, with the size-increase guardrail also
   confirmed for v1.
5. **STILL OPEN:** global resize default for mixed batches — percentage or
   fit-within box? Decide at Phase 2 build.
6. ~~Override signaling~~ → **decided**: dots; ring = selection only; no
   count badges (§5).

---

## 10. A1 → A3: the horizon analysis (requested 2026-07-02)

A1 and A3 are not really competing layouts — they are **the same destination
entered from different ends**. The question is what you pay, and when.

**Short term (first shipping bulk, ~weeks):**

- *A1*: zero regression risk to the live single-image editor (the product's
  core promise, covered by the whole e2e suite); every step is additive and
  committable; bulk value ships soonest. Cost: a second reactive state layer
  (bulk store beside `EditorSession`) and two parallel signature systems
  (`sideRecipe` vs `settingsHash`) to keep in your head.
- *A3*: before ANY bulk value ships, the proven editor must be rebuilt on the
  bulk engine — undo/redo, the instant result cache, settings persistence,
  the per-file reset policy, and crucially the **two-slider format A/B, which
  has no equivalent in the bulk engine** (a "side" is a second recipe for the
  same job — a new engine concept). Weeks of porting, regression risk on the
  core workflow, e2e churn.

**Medium term (months):**

- *A1*: the feature tax appears — everything both modes want (crop, settings
  panel, save-to-folder, presets) needs wiring twice. The *logic* lives once
  (framework-neutral layer), so the tax is UI/wiring — real but bounded, and
  the codec-options-model refactor shrinks it further by making option panels
  model-driven and shareable.
- *A3*: one state model; each new feature built once; overrides machinery
  works everywhere (a single image with renditions = per-rendition overrides,
  for free).

**Long term:**

- *A1 unreconciled*: permanent 2× cost per feature and a codebase with two
  editors. This is the outcome to refuse.
- *A3*: clearly correct — every feature now planned (bulk, crop with global
  aspect + per-image framing, renditions, save-to-folder) is batch-shaped,
  with "single image" as the 1-item special case.

**Choose A3 outright now only if** you're willing to freeze user-visible
progress for weeks and absorb regression risk on the core promise — or if a
lab prototype shows the unified UI is trivially simple. Otherwise:

**The staged convergence — CONFIRMED by maintainer 2026-07-02 ("A1 now, A3
later"):**

1. **No new feature enters `EditorSession`.** Anything both modes want is
   built batch-first in the framework-neutral layer, surfaced by thin UI in
   both places.
2. **Bulk focus mode chases a written parity checklist** with the single
   editor: undo/redo, instant cache restore, zoom/compare, settings
   persistence. Every parity item is a step toward retirement.
3. **When the checklist closes, flip the entry point**: one file opens a
   1-item batch; `EditorSession` retires. A3 achieved without a big-bang
   rewrite — and if priorities shift mid-way, the app is still whole at every
   intermediate commit.

## 11. Save destination & the Settings panel (feasibility, requested 2026-07-02)

**"Save back to the source folder" is impossible in general** — browsers
never reveal where a picked/dropped file came from, and nothing can be
written to disk without an explicit user grant. But the **File System Access
API** (Chromium — Chrome/Edge; not Safari/Firefox) makes two flows real:

- **Open folder → save back.** `showDirectoryPicker({mode: 'readwrite'})`
  lets the user hand Sqush a folder once; the app reads the images from it
  AND writes the optimized outputs back next to them (or into an `optimized/`
  subfolder). A *dropped folder* also yields a writable directory handle via
  `getAsFileSystemHandle()`. This is exactly the "working in a folder"
  workflow described by the maintainer.
- **Save to folder… (remembered).** At export, a directory picker whose
  handle is persisted in **IndexedDB** (handles are structured-cloneable;
  never in `localStorage` — consistent with the existing rule). Next session:
  one "allow again?" click instead of re-picking. Multiple remembered
  destinations are possible ("Downloads", "Client X assets", …).

**Not feasible:** individually picked/dropped *files* — no parent-folder
access. (Chromium can overwrite a dropped file in place, but format
conversion changes the extension, so in-place overwrite is the wrong tool and
is skipped.)

**Fallback everywhere else:** ZIP download (v1 behavior). Feature-detect;
hide what the browser can't do.

**Verdict: feasible, moderate effort, Chromium progressive enhancement** — a
save-target module + permission UX + IndexedDB handle store.
**Maintainer decision 2026-07-02: DEFERRED — not in this roadmap's phases;
keep on the consider-later list** (this section stays as the feasibility
record). The **Settings panel** idea survives independently (Phase 4) —
starting small: "keep original when larger" default, and the standing rule
that whenever two behaviors are both valid, the choice becomes a setting
here later; save destinations join it if/when save-back is picked up.

**Folder IMPORT is the opposite: PROMOTED into this roadmap (Phase 2).**
Users will expect to hand bulk a folder, and unlike save-back it is
cross-browser feasible today: an "Open folder" affordance via
`<input webkitdirectory>` (works in Chrome/Edge/Safari/Firefox) plus
`showDirectoryPicker` where available, and **dropped folders** via
`webkitGetAsEntry()` / `getAsFileSystemHandle()` traversal. Recursive walk,
filter through the engine's existing `isSupportedBulkImage`, and keep each
file's relative path (`webkitRelativePath`) so naming templates /
structure-preserving export stay possible later.

## 12. Crop & export renditions — forward architecture (requested 2026-07-02)

Neither ships in bulk v1, but both are recorded now because they *validate*
design decisions being made today.

**Crop (planned feature).** Fits the existing pipeline as a processor stage
(crop → resize → quantize → encode) and — the important part — as **part of
`ProcessorState`**, so signatures, staleness, requeue, and per-image
overrides all work with zero new engine concepts. Design rule: store crop as
**aspect + normalized focal point** (`{enabled, aspect, targetW×H?, focalX,
focalY, zoom?}`), *not* a pixel rect — a normalized focal point survives
mixed image sizes and resize changes. Then the maintainer's bulk-crop
workflow ("set 1:1 · 1024 globally, click each image, drag what stays
centered, Save All") is literally: global crop setting + per-image focal
override — the exact machinery §5 already describes. Viewer work: a
crop-frame interaction mode on the existing stage
(`bulk-crop-mode.png` concept). Sequenced as its own phase after overrides
(Phase 5).

**Export renditions (later track).** "One source → several outputs" (as-is /
square 1024 / square 256 / wide 16:9…) for asset-pipeline workflows. Model: a
**rendition = a named partial recipe** (crop + resize + format + options);
a job becomes a *(source × rendition)* pair. The bulk engine's job model
already tolerates this — multiple jobs sharing one `sourceFile` — so the
constraints on today's work are only: (a) never key caches or state by `File`
identity alone (use source ids), (b) naming templates
(`{name}-{rendition}.{ext}`) become required with export, (c) the grid UI
should be able to group jobs by source later. Single-image renditions are the
`single-left-renditions-panel.png` concept — one candidate answer to "what is
the left side for". Bulk × renditions (12 sources × 3 renditions = 36 jobs)
drops out of the same model. Own design pass when its turn comes.
