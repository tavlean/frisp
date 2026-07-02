# Bulk UI — design options & feature roadmap

Last updated: 2026-07-02.
Status: options written for maintainer shortlist (design session 2026-07-02).
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
| A1 | **Mode of the same route**: dropping/picking N files at the app boundary routes to bulk; 1 file keeps today's editor untouched | **Recommended.** Protects the single-image workflow (roadmap principle #1), no URL churn, matches the existing "detect at boundary" note |
| A2 | Separate `/bulk` route sharing the core | Same work + navigation seams; only wins if bulk needs its own shareable URL — it doesn't (nothing is shareable in a local-first app) |
| A3 | First-principles unification: *everything is a batch, single image = batch of 1* | Elegant end-state, but as a first step it rebuilds the proven single-image editor. Design the bulk mode so the mental model *converges* on this later instead |

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

**If B1 vs B2 can't be settled by reading → lab.** Both variants share ~all
wiring (engine, pool, import, export); the lab delta is genuinely just the
batch-home component, so a 2-variant lab is cheap and honest.

## 4. Decision C — what the left side becomes

Today each side is an encode slot; left defaults to "Original" (`identity`)
and most sessions never change it. Its real value is A/B-ing two codecs.

**In bulk (recommended):** the left panel as a format chooser disappears.
Focus-mode comparison is fixed: original | effective result. The left slot
gets a real job instead:

- **Grid view:** left side hosts the **batch panel** — global settings, totals,
  progress, Save All.
- **Focus view:** left slot shrinks to a slim **batch card** (progress, totals,
  "← All images"), right panel edits *this image*. LEFT = the whole batch,
  RIGHT = this one image — the scope question answered by geography.

**In single-image mode (optional, later):** collapse the left panel to a chip
("Original · 2.4 MB") whenever it's set to Original, with a "Compare…" action
that expands the full second encode side. Default UX gets simpler; the codec
A/B power feature stays one click away. (Removing the second side entirely and
leaning on the future Multi-Format Compare was considered and rejected for
now — live two-slider comparison is genuinely used, and MFC isn't built.)

## 5. Override signaling & reset (applies to any layout)

- **Card/strip badge:** one small ● dot = "has custom settings" (the
  maintainer asked for a clean signal, not a detailed diff). Tooltip lists the
  deviated fields via `getSettingsOverridePaths`.
- **Per-control:** a dot next to each overridden control in the focus panel +
  per-control reset; "Reset all to global" in the panel header
  (`applyClearJobOverrides`).
- **Global changes** requeue only non-overridden stale jobs — engine already
  guarantees this (`applyGlobalSettings` → `requeueStaleJobs`).
- Per-image **format** override is allowed (engine supports it) — e.g. one
  logo stays PNG while the batch goes WebP.

## 6. Export — revising one old decision

The old plan said "individual downloads first, ZIP later". **Recommend ZIP in
v1**: N programmatic downloads trip browser multi-download blocking (bad first
impression), upstream demand is explicitly for ZIP (Squoosh #1428), and the
memory argument is weak — outputs are already-compressed blobs held in memory
either way; `client-zip` (~2.4 kB, streaming, STORE mode — no recompression)
adds almost nothing. Per-image download buttons stay. Later: File System
Access API "save to folder" (Chromium progressive enhancement), naming
templates, folder-structure preservation.

Also in v1, the **size-increase guardrail** (upstream #984): amber card when
output ≥ original + a "keep original when larger" export toggle (default on) —
"never ship a bigger file" is a promise worth making.

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
| **1 — Layout decision** | Maintainer shortlists B1/B2 (+ left-side treatment §4). If reading doesn't settle it → **lab**: two variants behind a dev-only route, shared engine wiring, pick by feel | Maintainer eyes |
| **2 — Minimum Useful Bulk** | Multi-file entry (input `multiple` + boundary routing), reactive bulk store wrapping the engine, worker-bridge pool (2, per-side-bridge pattern), batch home per decision, global WebP panel (reuse existing panels), statuses/sizes/cancel/retry, totals bar, **Save All (ZIP)**, size-increase guard; bulk e2e smoke | Phase 1 decision |
| **3 — Overrides & focus** | Focus mode reusing two-up + mini-strip nav, per-image scope panel, per-control override dots, card deviation badge, reset (control/image), per-image format override, shallow-routing back-button | Phase 2 |
| **4 — Scale & polish** | Lazy thumbnails + decode LRU, mixed-size resize UX, AVIF as second bulk format, folder import, naming templates, presets, report, save-to-folder, density toggle | Phase 3 + usage feedback |

Priority note: maintainer decision 2026-07-02 — **bulk now outranks
Multi-Format Compare** in the product order (road-map.md updated accordingly).

## 9. What to answer to close Phase 1

1. Batch home: **grid (B1)** or **filmstrip (B2)** — or lab both?
2. Left side in bulk: batch panel / batch card as in §4? (Recommended yes.)
3. Single-image left panel collapse-to-chip: do it, lab it, or leave for later?
4. ZIP in v1: confirm the revision in §6. (Recommended yes.)
5. Global resize default for mixed batches: percentage or fit-within box?
