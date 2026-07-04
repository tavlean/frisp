# Spec: Bulk Phase 2 — promote the lab to production

Last updated: 2026-07-03.
Status: done (executed 2026-07-03, commits `678bb5f7`–`55c0da46` + the
e2e/docs sweep; all 10 acceptance criteria verified).
Decision record: [bulk-ui-design-options.md](../bulk-ui-design-options.md)
(design phase complete 2026-07-02 — every open question is decided there).
Engine reference: [bulk-image-architecture.md](../bulk-image-architecture.md).

This spec is written to be executed by a model with no access to the design
conversation. Every judgment call is resolved here; where the spec says
"decide X", it means X **is** the decision — do not re-open it.

## Objective

Ship bulk image optimization as a production mode of the main route. Dropping
or picking **2+ images** (or a folder) lands in the batch editor proven in the
dev-only `/lab/bulk` prototype: rich strip (S/M/L), Stack resting stage,
scope-switched right panel (coral global / azure image), multi-select with
sparse per-image overrides and dot signaling, hero batch stats, and **Save all
as ZIP** with a keep-original-when-larger guard. **1 file keeps today's
single-image editor byte-for-byte untouched.** The lab code moves (git mv) to
`src/lib/bulk/`, dev-only artifacts are removed, folder import is added at the
boundary, remove-from-batch gains Undo, and the lab route is deleted.

## Non-goals

Do NOT build any of these, even if they seem adjacent:

- **No changes to the single-image editor's behavior** — same intro, same
  in-place replace on 1-file drop, same undo/redo, same panels. (The
  `orientationOverride` prop on `Output.svelte` already exists and stays; do
  NOT flip the single-image editor to divider-follows-image — that is a
  separate future decision. Bulk focus view uses it, as the lab already does.)
- No save-back-to-folder / File System Access write paths (deferred — see
  design doc §11). ZIP download only.
- No per-image format override *UI polish* beyond what the lab has (Phase 3).
- No AVIF-as-second-bulk-format, presets, naming templates, CSV report,
  density toggle (Phase 4).
- No crop, no renditions (Phase 5 / later track).
- No PWA manifest, share target, or `file_handlers` (none exist today).
- No MIME sniffing at the entry boundary (`createImageJobsWithMimeSniffing`
  stays unwired; the sync `isSupportedBulkImage` filter is the v1 gate).
- No paste-to-add while in bulk mode (paste remains an intro-only, single-file
  affordance).
- No codec-options-model refactor (independent track).
- No `EditorSession` changes beyond what this spec names. The A1→A3
  convergence rules (design doc §10) forbid new features entering
  `EditorSession`.

## Assumptions — re-verify before starting

The executor must confirm these still hold (a later session may have moved
things); if any fails, stop and report rather than improvising:

1. `src/routes/lab/bulk/` (+page.svelte ~889 lines, +page.ts guard) and
   `src/lib/lab/bulk/` (17 files, ~6.5k lines) exist as of commit `68f2dfbb`.
2. The engine barrel `src/client/lazy-app/bulk/index.ts` exports the reducers
   named in this spec (`removeJobs`, `addBulkImportToSession`,
   `createBulkExportPlan`, `requeueJob`, `normalizeBulkSessionCounters`, …).
3. `src/routes/+page.svelte` funnels ALL file entry through a local
   `pickFiles` wrapper (~line 61) used by the app-root `fileDrop` attachment
   (~line 111) and `<Intro onFiles={pickFiles}>` (~line 113).
4. `EditorSession.pickFiles` reduces to `list?.[0]`
   (`src/lib/editor/editor-session.svelte.ts` ~line 713).
5. The Intro file input (`src/lib/editor/intro/Intro.svelte` ~line 98) has no
   `multiple` attribute.
6. `src/lib/editor/file-drop.ts` reads only `event.dataTransfer.files` — no
   `items` / `webkitGetAsEntry()` walk.
7. The production snackbar (`src/lib/editor/snackbar-store.svelte.ts`)
   supports `show(message, { actions, timeout })` returning a promise that
   resolves `'Undo' | 'timeout' | 'dismiss'` etc.
8. `package.json` has no zip dependency; everything lives in
   `devDependencies` (Vite bundles; there is no runtime `dependencies` block).
9. Unit tests live in `tests/unit/*.test.ts` (Vitest, `npm run test:unit`)
   with shared factories in `tests/unit/fixtures.ts`; e2e in `tests/e2e/`
   (Playwright vs the production preview on port 4317, chromium + webkit).
10. `npm run check` = format check + sync + svelte-check + build +
    static-output audit, and is green on `main` before you start.

Also read, before writing any code: `docs/STATUS.md`, `docs/README.md`
(registry), `docs/bulk-ui-design-options.md` (the header + §3–§6 minimum),
and `AGENTS.md`. AGENTS.md line ~28 gates production bulk UI on
"maintainer/design discussion" — that gate is **satisfied** by the 2026-07-02
design record in bulk-ui-design-options.md; update that AGENTS.md line in the
final docs stage rather than treating it as a blocker.

## Stage plan

Work top of `main`, directly (no feature branch — standing maintainer rule —
unless a stage turns out riskier than described; then stop and ask). One
commit per stage minimum; suggested messages given. After EVERY stage:
`npm run check` green + the Svelte MCP autofixer on every edited/created
`.svelte`/`.svelte.ts` file. Stages A–D are strictly ordered; E, F, G are
independent of each other (any order); H is last.

---

### Stage A — engine additions (pure TS + unit tests, no UI)

Three small, independent commits in `src/client/lazy-app/bulk/` + tests.
These are pure-reducer changes; they must not import Svelte or DOM APIs.

**A1. `restoreJob` (for remove-Undo) — `session.ts`**

Next to the existing `removeJobs`:

```ts
/** Re-insert a previously removed job at (clamped) index. Undo for removal. */
export function restoreJob(
  session: BulkSession,
  job: ImageJob,
  index: number,
): BulkSession {
  if (session.jobs.some((existing) => existing.id === job.id)) return session;
  const jobs = [...session.jobs];
  jobs.splice(Math.max(0, Math.min(index, jobs.length)), 0, job);
  return normalizeBulkSessionCounters({ ...session, jobs });
}
```

Place it in `session.ts` beside `removeJobs` (~line 234);
`normalizeBulkSessionCounters` is defined in the same file (~line 217), and
the barrel `index.ts` is `export *` so no barrel edit is needed. Mirror
exactly what `removeJobs` does on the way out, including `selectedJobId`
handling: restoreJob must NOT change `selectedJobId`. Unit tests (`tests/unit/session.test.ts` or a new
`restore.test.ts`): restores at original index; clamps out-of-range index;
no-op (same reference) when the id already exists; counters
(queued/active/completed) are recomputed; a restored job with `output` intact
counts as completed/encoded per existing counter rules.

**A2. Keep-original-when-larger export option — `export.ts`**

Extend the existing export planning (do not fork it):

```ts
export interface BulkExportOptions {
  /** When an output is strictly larger than its source, ship the source
   *  instead. Default false (existing behavior). */
  keepOriginalWhenLarger?: boolean;
}

export interface BulkExportEntry {
  job: ImageJob;
  fileName: string;
  downloadUrl: string;
  size: number;
  /** True when the guard replaced the output with the untouched source. */
  keptOriginal: boolean;
}
```

- `getBulkExportEntries(session, jobIds?, options?)` and
  `createBulkExportPlan(session, jobIds?, options?)` accept the options bag.
- Guard condition is **strictly greater**: `job.output!.size >
  job.originalSize`. Equal size is NOT "larger" — an equal-size format
  conversion is still wanted output.
- For a kept-original entry: `fileName` = duplicate-safe **source** name
  (`job.sourceFile.name` through the existing `createDuplicateSafeName`, same
  shared `knownNames` set as the other entries, in entry order), `size` =
  `job.originalSize`, `downloadUrl` unchanged (still the output URL — the ZIP
  builder reads blobs from the job, not from this URL), `keptOriginal: true`.
- All existing entries get `keptOriginal: false`. Existing callers pass no
  options → behavior identical (existing export tests must pass unmodified).
- Do NOT change `getBulkExportSummary` — it describes encode results, not
  archive contents.

Unit tests (`tests/unit/export.test.ts`): option off → identical entries with
`keptOriginal: false`; option on + larger output → source name/size/flag;
option on + equal-size output → NOT kept; name collision between a kept
original (`photo.jpg`) and another job's output (`photo.jpg`) → second gets
`photo-2.jpg` via the shared dedupe set.

**A3. Relative paths at import — `import.ts` + `session.ts`**

For folder import (Stage F) and future naming templates (design doc §11:
"keep each file's relative path"). v1 stores it; nothing reads it yet.

- `ImageJob` gains `relativePath?: string` (never the empty string — omit).
- `createImageJob(id, file)` gains optional `relativePath?: string` param.
- `createImageJobs(files, getRelativePath?)` and
  `createImageJobsWithMimeSniffing(files, sniffMimeType, getRelativePath?)`
  gain an optional `getRelativePath?: (file: File) => string | undefined`;
  default reads `file.webkitRelativePath || undefined` (typed in the current
  TS lib.dom — no cast needed; picker files carry it natively; `''` means
  "none" → undefined).
- Check `snapshot.ts`: if it enumerates job fields explicitly, round-trip
  `relativePath`; if it spreads, confirm it survives parse/restore either way
  and add a test.

Unit tests (`tests/unit/import.test.ts`): default sniffer of
`webkitRelativePath`; explicit `getRelativePath` wins; `''` → field absent;
snapshot round-trip keeps it.

Commits: `feat(bulk-engine): restoreJob — pure undo for remove-from-batch`,
`feat(bulk-engine): keep-original-when-larger export option`,
`feat(bulk-engine): carry relative paths through import`. Run
`npm run test:unit` + `npm run check` after each.

---

### Stage B — mechanical move: `src/lib/lab/bulk` → `src/lib/bulk`

No behavior change. The lab route keeps working (its imports are updated) so
the app is verifiable at every commit; the route dies in Stage D.

1. `git mv src/lib/lab/bulk src/lib/bulk` (preserves history), then
   `rmdir src/lib/lab` if empty. `git rm src/lib/bulk/samples.ts` (dev-only
   synthetic sample generator — production never ships it; the lab route's
   "Load samples" button dies with the route in Stage D, so for THIS stage
   remove the button + `loadSamples()` + the `makeSampleFiles` import from
   `src/routes/lab/bulk/+page.svelte` now).
2. Rename the `Lab` prefix to `Bulk` everywhere in the moved files and their
   importers — exact map:
   - `LabBulk` → `BulkStore`; the singleton `labBulk` → `bulkStore`
   - `LabRuntime` → `BulkRuntime`; `LabRunnerHost` → `BulkRunnerHost`
   - `LabOutputCache` → `BulkOutputCache`; `LabOutputCacheOptions` →
     `BulkOutputCacheOptions`
   - `LabThumb` → `BulkThumb`; `LabOverridablePath` → `BulkOverridablePath`
   - CSS classes / vars keep their names EXCEPT `--lab-topbar-h` →
     `--bulk-topbar-h` (retuned in Stage D). Leave `.lab-*` class names in the
     route file alone (deleted in Stage D).
   Let the TypeScript compiler (`npm run check`) find every miss — do not
   grep-and-pray.
3. Replace the lab toast with the production snackbar:
   - Delete `src/lib/bulk/Toast.svelte`.
   - In the moved files, replace `toast(msg)` calls with
     `snackbar.show(msg)` (`import { snackbar } from
     '$lib/editor/snackbar-store.svelte'`). Fire-and-forget call sites ignore
     the returned promise (`void snackbar.show(...)`).
   - The lab route renders `<Toast/>`; remove that render (the production
     page already renders `<Snackbar/>`; while the lab route still exists
     this stage, add `<Snackbar/>` to it so its messages stay visible).
4. Update every import path `$lib/lab/bulk/…` → `$lib/bulk/…` (route file +
   intra-module imports).

Commit: `refactor(bulk): promote lab modules to src/lib/bulk`. Gate:
`npm run check` green; `npm run dev` → `/lab/bulk` still fully works
(import, select, override, stack).

---

### Stage C — production entry: BulkMode + boundary routing

The heart of the promotion. Read `src/routes/lab/bulk/+page.svelte` in full
first — most of its logic moves here.

**C1. New `src/lib/bulk/BulkMode.svelte`** — the production bulk surface.

Extract from the lab route's `+page.svelte` everything that is NOT dev
chrome, in particular:

- the dedicated `focusSession = new EditorSession()` (bulk must NOT reuse the
  page's single-image session — that session's `file` drives the
  intro/editor branch) and its disposal on unmount;
- the entire focus↔bulk hydration machinery (`seedFocusFromSelected`,
  `hydrateFocusFromBulkOutput`, `buildOverrideFromFocus`, and the effects
  that bridge selected-job settings into the real editor and apply edits back
  as sparse overrides). Keep the inert `pickFiles(..., () => {})` history
  callback — bulk owns its own route state; note explaining this stays;
- the `<Home {focusSession} … />` render (FocusView + RichStrip).

Do NOT bring over: the `{#if dev}` guard, the `.lab-controls` pill, the
Stack|Blank toggle markup, the dropzone/empty-state (`.dropzone`), the
`.lab::after` drop overlay, `<svelte:head>` title, the theme.css import (the
main page already loads it — verify, and keep exactly one import).

Add minimal production chrome, styled with the existing glass-button
patterns from the single-image editor (copy its Back button classes/markup as
the reference):

- top-left cluster: **Back** button (calls an `onExit()` prop) and an **Add
  images** button that clicks a hidden `<input type="file" accept="image/*"
  multiple>` whose change handler forwards to `bulkStore` import (same code
  path as the page router's add-to-batch branch).
- Props: `{ onExit: () => void }`.
- Token scoping: the editor theme tokens are scoped to `.presk-editor`
  (`theme.css`), and `FocusView`'s root already carries that class — but the
  Back/Add cluster sits outside it. Put the cluster inside a
  `.presk-editor`-classed wrapper (or give BulkMode's root that class) so
  `var(--…)` tokens resolve without the lab's hardcoded fallbacks.

**C2. Rewire `src/routes/+page.svelte`** — the boundary router.

```ts
import { bulkStore } from '$lib/bulk/store.svelte';
import { isSupportedBulkImage } from 'client/lazy-app/bulk';

function routeFiles(list: FileList | File[] | null | undefined): void {
  const files = Array.from(list ?? []).filter(isSupportedBulkImage);
  if (files.length === 0) {
    void snackbar.show('No supported images found.');
    return;
  }
  if (bulkStore.hasJobs) {
    bulkStore.importFiles(files); // add to the running batch (dupes allowed)
    return;
  }
  if (files.length > 1) {
    bulkStore.importFiles(files);
    pushState('', { editor: true }); // same key as the single editor
    return;
  }
  pickFiles(files); // the existing single-file wrapper, unchanged
}
```

- The existing local `pickFiles` wrapper stays for the single path; adapt it
  to accept `File[]` (`session.pickFiles` takes `FileList | …` — either relax
  its param type to `ArrayLike<File>` or synthesize a `FileList` via
  `DataTransfer` as `Intro.deliver` already does; prefer relaxing the type,
  it's the smaller diff and `list?.[0]` works on arrays).
- `fileDrop((files) => routeFiles(files))` on the app root; `<Intro
  onFiles={routeFiles} …>`.
- Three-way branch:

```svelte
{#if bulkStore.hasJobs}
  <BulkMode onExit={exitBulk} />
{:else if session.file}
  <!-- existing editor markup, untouched -->
{:else}
  <Intro … />
{/if}
<Snackbar />  <!-- moved OUTSIDE the branches; render exactly once -->
```

- `exitBulk()` = `bulkStore.reset()` (the moved `resetLab` — rename to
  `reset`) + `bulkStore.runtime.disposeBridges()` + `history.back()` when
  `page.state.editor` is set. Also handle browser-back: extend the existing
  route-state effect so that when `page.state.editor` becomes falsy while
  `bulkStore.hasJobs`, the store is reset + bridges disposed (mirror of
  `session.syncRouteState`). Removing the last image (hasJobs → false) simply
  falls through to Intro; the same effect must then clean up route state
  (call `history.back()` if `page.state.editor` is still set).

**C3. `src/lib/editor/intro/Intro.svelte`** — add `multiple` to the existing
file input. `onFileChange` already forwards the whole `FileList`; no other
change. Keep `accept="image/*"`.

**C4. Store polish for production** (in `src/lib/bulk/store.svelte.ts`):

- `importFiles` must accept `File[]` (it already does in the lab) and keep
  using the sync `createImageJobs`; pass no `getRelativePath` here — Stage F
  threads paths through.
- Rename `resetLab()` → `reset()`; keep `dispose()` as-is.

Commit: `feat(bulk): production bulk mode — 2+ files route to the batch
editor`. Gate: `npm run check`; `npm run dev` manual smoke — drop 3 images →
bulk; drop 1 → single editor unchanged; back button exits bulk to intro; drop
2 more while in bulk → 5 thumbs; existing e2e still green
(`npm run test:e2e`).

---

### Stage D — cleanup: Stack is the only resting stage; lab route dies

1. Delete `src/routes/lab/` entirely (`git rm -r`).
2. Remove the Blank resting stage (maintainer verdict 2026-07-02: STACK WINS):
   - `store.svelte.ts`: delete `StageMode` type, `stageMode` state,
     `setStageMode()`.
   - `FocusView.svelte`: delete the `.blank-stage` `{:else}` branch and its
     CSS; the stage renders focus Output (1 selected) or StackStage
     (everything else). Keep the `.stage-backdrop` click-to-deselect.
3. Retune the phone layout offset: `--bulk-topbar-h` was sized for the lab's
   fixed dev pill (56px). Production has only the floating Back/Add cluster.
   Set the variable from the actual production chrome height and verify at
   375×812 and 900×500 (see Verification): the sticky phone summary bar, FAB,
   and sheets must not overlap the top cluster.
4. Grep for leftovers: `lab`, `Lab`, `samples`, `stageMode`, `blank` across
   `src/` — the only legitimate survivors are unrelated words (e.g. CSS
   `label`). `rg -i '\blab\b|stageMode|makeSampleFiles' src` must return
   nothing in `src/lib/bulk` or `src/routes`.

Commit: `feat(bulk): stack is the resting stage — remove Blank + the dev lab
route`. Gate: `npm run check` (the build must emit no `lab*` route);
`ls build | grep -i lab` empty after the check's build step.

---

### Stage E — Save all: ZIP export + the size guard

**E1. Dependency.** `npm install -D client-zip` (v2.5.x at spec time —
streaming ZIP writer, ~2.6 kB gzipped, STORE-only by design: no recompression
of already-compressed image bytes; `downloadZip(files)` returns a `Response`;
entries are `{ name, lastModified, input }` where `input` accepts `File`/
`Blob` directly). It does NOT dedupe names — the engine's
`createDuplicateSafeName` already guarantees uniqueness. Requires ES2020 +
BigInt — fine for this app's browser floor.

**E2. New `src/lib/bulk/zip.ts`:**

```ts
import { downloadZip } from 'client-zip';
import {
  createBulkExportPlan,
  type BulkExportPlan,
  type BulkSession,
} from 'client/lazy-app/bulk';

export async function buildZipBlob(plan: BulkExportPlan): Promise<Blob> {
  const files = plan.entries.map((entry) => ({
    name: entry.fileName,
    lastModified: entry.keptOriginal
      ? entry.job.sourceFile.lastModified
      : entry.job.output!.file.lastModified,
    input: entry.keptOriginal ? entry.job.sourceFile : entry.job.output!.file,
  }));
  return await downloadZip(files).blob();
}

export function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  // Revoke on a timeout, not synchronously — Safari needs the tick.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
```

**E3. Store** (`store.svelte.ts`):

- New state: `keepOriginalWhenLarger = $state(true)` (design §6 — default
  ON), `exporting = $state(false)`.
- Replace `saveAllStub()` with:

```ts
async saveAll(): Promise<void> {
  if (this.exporting) return;
  const plan = createBulkExportPlan(this.session, undefined, {
    keepOriginalWhenLarger: this.keepOriginalWhenLarger,
  });
  if (plan.entries.length === 0) return;
  this.exporting = true;
  try {
    const blob = await buildZipBlob(plan);
    triggerBlobDownload(blob, `${plan.archiveName}.zip`);
    this.session = markBulkExportPlanExported(this.session, plan);
    void snackbar.show(`Saved ${plan.entries.length} images as ZIP.`);
  } catch (err) {
    void snackbar.show('ZIP export failed.');
    throw err;
  } finally {
    this.exporting = false;
  }
}
```

- Enablement rule (a `$derived` the UI consumes, name it `canSaveAll`):
  `canExportBulkSession(this.session) && !this.processing && !this.exporting`
  — `canExportBulkSession` is the engine's existing ready-check (export.ts);
  do not invent a parallel one. No partial ZIPs while encodes are still
  running — the button waits for the batch.

**E4. UI** (`BatchInfoPanel.svelte` + the phone summary in
`FocusView.svelte`): wire both "Save all" call sites from the stub to
`bulkStore.saveAll()`; disable + dim when `!canSaveAll`; while `exporting`
show "Saving…" label. Under the Save all button in BatchInfoPanel's footer,
add one quiet checkbox row: label **"Keep originals when larger"**, bound to
`bulkStore.keepOriginalWhenLarger`, styled to match the footer's caption
text. Amber signaling for size-increase already exists (`DeltaPill` shows the
amber up-arrow when percent > 0) — verify, don't rebuild.

Commit: `feat(bulk): Save all — ZIP export with the keep-original-when-larger
guard`.

---

### Stage F — folder import (picker + dropped folders)

**F1. New `src/lib/bulk/import-sources.ts`** — one shape for every source:

```ts
export interface ImportedFile {
  file: File;
  relativePath?: string; // 'trip/day1/img.jpg' — never '' (omit instead)
}

/** Picker files: webkitRelativePath is set for webkitdirectory picks. */
export function fromFileList(list: FileList | File[]): ImportedFile[];

/** Drop: walks directory entries recursively; plain files pass through.
 *  Skips dot-files/dirs (.DS_Store etc.). */
export async function fromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<ImportedFile[]>;
```

`fromDataTransfer` rules (this is the subtle part — implement exactly):

- If `dataTransfer.items` is unavailable or yields no entries, fall back to
  `dataTransfer.files` (current behavior).
- Snapshot the items list **synchronously before any await** — `DataTransfer`
  contents are neutered after the drop event handler yields. Collect
  `item.webkitGetAsEntry()` for every item of kind `'file'` FIRST, then
  resolve async.
- File entry → `entry.file()` (promisify); directory entry → recurse via
  `entry.createReader()`; **call `readEntries` in a loop until it returns an
  empty batch** — Chromium returns at most 100 entries per call; a single
  call silently drops the rest.
- `relativePath` = the entry's `fullPath` with the leading `/` stripped;
  top-level plain files get no relativePath.
- Skip any entry whose name starts with `.`.
- `webkitGetAsEntry()` is the cross-browser baseline (Chrome/Edge/Firefox/
  Safari all ship it); do NOT use `getAsFileSystemHandle()` (Chromium-only,
  needed only for the deferred save-back feature).

**F2. `src/lib/editor/file-drop.ts`** — the callback becomes
`onFiles(files: ImportedFile[])`; the drop handler calls
`fromDataTransfer(event.dataTransfer)` (async) and invokes `onFiles` with the
result when non-empty. Update the JSDoc. Both callers (`+page.svelte` app
root — the only one after Stage D) adapt: `routeFiles` now takes
`ImportedFile[]`, filters on `isSupportedBulkImage(imported.file)`, and the
single-file branch unwraps `.file`.

**F3. Store threads paths:** `importFiles(imported: ImportedFile[])` builds a
`Map<File, string>` and passes `(file) => map.get(file)` as `getRelativePath`
to `createImageJobs`. This changes `importFiles`' parameter type — update
EVERY caller in the same commit: the page router (Stage C), BulkMode's Add
input, and any remaining internal call. From this stage on, `Intro`'s
`onFiles` contract is `ImportedFile[]` too: `onFileChange` wraps via
`fromFileList`, the paste path wraps its single file as
`[{ file }]`, and the folder input (F4) uses `fromFileList`. The router then
handles exactly one shape everywhere.

**F4. Intro affordance** (`Intro.svelte`): a second hidden input
`<input type="file" webkitdirectory>` (no `accept` — directory mode ignores
it; do NOT put `webkitdirectory` on the existing input, it would force
folder-only picking) + a **"Choose folder"** button rendered beside the
existing "Paste image" button, same secondary-button styling. Wire through
`fromFileList` → `onFiles`. TypeScript: the current DOM lib types both
`HTMLInputElement.webkitdirectory: boolean` and
`File.webkitRelativePath: string`, so no ambient declarations should be
needed; if Svelte's template checker still rejects the attribute, fall back
to an `{...{ webkitdirectory: true }}` spread.

Folder → count rule is unchanged: a picked/dropped folder containing exactly
1 supported image opens the single-image editor (consistent boundary rule; no
special-casing).

Commit: `feat(bulk): folder import — picker + dropped-folder traversal`.

---### Stage G — Undo for remove-from-batch

Engine support landed in A1. Store changes (`store.svelte.ts`):

- `#removeJobIds` currently revokes the removed jobs' object URLs
  immediately. Change: removal captures `{ job, index }` for each removed job
  (index = position in `session.jobs` BEFORE removal, ascending), applies the
  engine removal as today, but **defers URL revocation** into a
  `#pendingRemoval` holder (`{ items: Array<{job, index}> }`). Only ONE
  pending removal exists at a time: a new removal finalizes (revokes) the
  previous one first. `reset()`/`dispose()` finalize too.
- After removing, replace the current toast with:

```ts
const label = items.length === 1 ? `Removed ${items[0].job.sourceFile.name}` : `Removed ${items.length} images`;
const action = await snackbar.show(label, { actions: ['Undo'] });
if (action === 'Undo') this.#restorePendingRemoval();
else this.#finalizePendingRemoval(); // 'timeout' | 'dismiss' → revoke URLs
```

  Guard the resolution: if `#pendingRemoval` no longer holds these items
  (superseded), do nothing — the superseding call already finalized them.
- `#restorePendingRemoval()`: re-insert in **ascending index order** via the
  engine's `restoreJob`, reassign `this.session` once per insert (or fold
  into one pass), re-register thumbs/source URLs (they were never revoked),
  re-pin outputs (`#pinCurrentOutputs`), and requeue any restored job whose
  output is missing or stale (`resetJobForQueue` + `runtime.run(this)` —
  mirror what `#restoreCachedOrQueueStale` does). Selection stays empty.
- Keyboard Cmd+Z does NOT trigger removal-undo (it belongs to the focus
  session's history) — snackbar button only. Note this in a comment.
- When a pending removal finalizes as NOT undone and the store has no jobs
  left (the batch was emptied), also dispose the runtime bridges — nothing
  will use them, and the page has already fallen back to the intro.

Unit-test the pure parts you can (restoreJob already covered in A1); the
deferred-revocation flow is store logic verified by the e2e case below.

Commit: `feat(bulk): undo for remove-from-batch`.

---

### Stage H — e2e coverage + docs sweep

**H1. New `tests/e2e/bulk.spec.ts`** — follow the house style (self-contained
spec, fixtures via `fileURLToPath(new URL('../fixtures/…', import.meta.url))`,
poll-based waits, no shared helpers). Playwright's `setInputFiles` accepts an
array of paths once the input has `multiple`. Cases (each its own `test`):

1. **Multi-file entry**: goto `/`, `setInputFiles('input[type=file]',
   [photo.jpg, gradient.png, screenshot.png])` → the bulk UI appears (assert
   the strip renders 3 cells); wait until every cell shows a delta pill /
   loses its spinner (poll DOM, generous timeout — 3 encodes at concurrency
   2); the hero footer shows a total.
2. **Single-file regression**: goto `/`, set ONE file → the classic two-up
   editor appears (assert `.options-2` panel and NO strip). This is the
   guard-rail test for the untouched single path.
3. **Override signaling**: in a 3-image batch, click cell 2, change Quality in
   the right panel, assert the cell gains the override dot (class or
   data-attr) and the panel scope tab reads "This image".
4. **ZIP export**: batch of 3, wait ready, click "Save all"; capture the
   `download` event; read the file bytes; assert the name ends `.zip`, bytes
   start `PK\x03\x04`, and the byte sequence `PK\x01\x02` (central directory
   file header) occurs exactly 3 times.
5. **Keep-original guard**: build a batch containing `noise-synthetic.png`
   (WebP output larger than the tiny PNG source is likely — VERIFY while
   writing the test; if no fixture reliably inflates, add a tiny 1-color PNG
   fixture via `tests/fixtures/generate.mjs` instead of hand-committing
   bytes); with the toggle ON export and assert the ZIP contains the
   `.png` name; toggle OFF → `.webp` name. (Parse names from the central
   directory or just assert on the filename bytes present in the archive.)
6. **Remove + Undo**: batch of 3, hover cell → click remove (or select +
   Delete key), assert 2 cells + snackbar with Undo; click Undo, assert 3
   cells again and no re-encode spinner on the restored cell (its output
   survived).
7. **Folder drop** (chromium only — Playwright can't synthesize directory
   drops in webkit): skip if too awkward; the folder PICKER path is covered
   by unit tests + manual QA instead. Do not burn more than an hour here;
   drop the case if flaky and note it in the spec's checklist.

Register nothing new in CI — `test:e2e` picks the file up automatically.

**H2. Docs sweep** (separate commits: code docs vs stale-doc fixes; never
auto-format `.md`):

| Doc | Change |
|---|---|
| `docs/STATUS.md` | New Current State entry: bulk Phase 2 landed (what shipped, commits); update the bulk design-phase entry's "Save-all ZIP remains stubbed" line. |
| `docs/README.md` | Priority table: bulk row → Phase 2 ✅ done / next phase pointer. (This spec's registry row already exists — update its wording to "done".) |
| `docs/bulk-ui-design-options.md` | Header: promotion executed, date, pointer here; roadmap table Phase 2 → done. |
| `docs/road-map.md` | Bulk milestone status update. |
| `docs/parity-audit.md` | New §A entry: bulk mode is a deliberate addition; within bulk, the two-up divider follows the image (`orientationOverride`), single-image editor unchanged. |
| `docs/test-plan.md` | §4: note the new engine tests (restoreJob, export option, relativePath) + the bulk e2e smoke list. |
| `AGENTS.md` | The "do not implement production bulk UI without discussion" line → rewritten to reflect that bulk IS production now, pointing at the design record. |
| `docs/user-guide/` | New page `bulk-optimization.md` (import N files/folder; global vs per-image settings + dots; multi-select; strip sizes; stack; Save all ZIP + keep-originals toggle; remove/undo) + link it from `index.md` + add the feature to `reference/features.md`. Follow the existing user-guide voice (plain, user-facing, no dev jargon). |
| `.claude/PROJECT_BRIEF.md` | Current-state + priorities refresh (bulk shipped; next = Phase 3 overrides polish / 2b left panel). |

Also append the journey notes ONLY if something notably hard happened
(journey-and-article-notes.md is for article material, not a changelog).

---

## Interfaces & data shapes (single source of truth)

- `ImageJob` gains `relativePath?: string` (A3). `ImageOutput` unchanged.
- `BulkExportEntry` gains `keptOriginal: boolean`; plan/entry functions gain
  `options?: BulkExportOptions` (A2).
- `restoreJob(session, job, index): BulkSession` (A1).
- `ImportedFile { file: File; relativePath?: string }` — the one shape every
  entry source produces (F1).
- `fileDrop(onFiles: (files: ImportedFile[]) => void)` after F2 (before F2 it
  still passes `FileList` — Stage C consumes `Array.from`).
- Store surface renames: `labBulk→bulkStore`, `LabBulk→BulkStore`,
  `resetLab()→reset()`, `saveAllStub()→saveAll()`; new: `keepOriginalWhenLarger:
  boolean`, `exporting: boolean`, `canSaveAll` (derived).
- `BulkMode.svelte` props: `{ onExit: () => void }`.
- ZIP archive name: `${plan.archiveName}.zip` (engine already yields
  `<session>-optimized`); entries flat (no folders) in v1 even when
  `relativePath` is known.
- Snackbar Undo contract: `snackbar.show(msg, { actions: ['Undo'] })` →
  `'Undo' | 'timeout' | 'dismiss'`; supersession auto-resolves `'dismiss'`.

## Framework references (verified 2026-07-02 — code to THESE, not memory)

- `<input webkitdirectory>` is Baseline 2025, cross-browser (Chrome 30+,
  Edge 14+, Safari 11.1+, Firefox 50+, iOS Safari 18.4+): MDN
  `HTMLInputElement.webkitdirectory`; caniuse "Directory selection from file
  input". Files arrive as a flat `FileList` with `webkitRelativePath`.
- `DataTransferItem.webkitGetAsEntry()` is the cross-browser folder-drop
  baseline (implemented under that name in Firefox/Safari too);
  `getAsFileSystemHandle()` remains limited-availability Chromium — do not
  use it here. MDN pages for both methods.
- `FileSystemDirectoryReader.readEntries()` batches (Chromium: 100/call) —
  loop until an empty array returns. MDN readEntries browser-compat note.
- `DataTransfer` contents are protected outside the `drop` handler's own
  tick — snapshot items/entries synchronously before any `await`. MDN
  `DataTransfer.files` protected-mode note.
- `client-zip@2.5.0`: `downloadZip(entries) → Response` (`.blob()` it);
  STORE-only (no compression); caller dedupes names; ES2020+BigInt.
  github.com/Touffy/client-zip README.
- Svelte 5: a class with `$state`/`$state.raw` fields in a `.svelte.ts`
  module is the documented pattern for shared reactive stores (the existing
  store already follows it). In `onchange` handlers read
  `event.currentTarget.files` — the handler fires before `bind:files`
  updates. Svelte docs: `.svelte.js/.svelte.ts`, `$state` Classes, bind:.

## Edge cases (input → required behavior)

| Input | Required behavior |
|---|---|
| Drop/pick 1 supported file, intro or single-editor showing | Existing single-image path, unchanged (in-place replace keeps encoder recipe). |
| Drop/pick 2+ supported files from intro or single editor | Fresh bulk session with exactly those files; a previously open single image is abandoned (NOT added to the batch). |
| Drop/pick any files while bulk is active | Append to the batch (duplicates ALLOWED — sanctioned interim multi-format pattern). 1 file also appends, never opens the single editor. |
| Mixed drop (2 images + 1 .txt) | .txt filtered out pre-count; 2 images → bulk; no snackbar for partial rejects unless zero survive. |
| Drop where 0 supported files survive | Snackbar "No supported images found."; UI state unchanged. |
| Folder (picker or drop) resolving to exactly 1 supported image | Single-image editor (count rule, no folder special case). |
| Dot-files / dot-dirs inside a dropped folder | Skipped during traversal. |
| Directory with >100 entries | Fully imported (readEntries loop). |
| Remove last remaining image | Bulk exits to intro; route state cleaned up; pending-removal snackbar still offers Undo — undoing restores the job AND re-enters bulk (hasJobs derives it; verify the store re-run of the runtime). If that proves unstable, finalize the removal instead when it empties the batch and document it in the code — but try the restore path first. |
| Output.size > originalSize, toggle ON | ZIP carries the source file under its original (deduped) name; per-image download button still yields the encoded output; amber delta stays. |
| Output.size === originalSize | Output ships (NOT kept-original); neutral/amber per existing DeltaPill rule (>0 only). |
| Save all clicked while encodes run | Impossible — button disabled until `ready>0 && !processing && !exporting`. |
| Duplicate output names (two `img.jpg` → `img.webp`) | Engine dedupe: `img.webp`, `img-2.webp` (already implemented; keep covered by tests). |
| Back button (browser or UI) in bulk | Store reset + bridges disposed + intro; pending removal finalized. |
| Reload mid-batch | Batch is gone (no persistence in v1 — snapshots are a later phase; this matches the single editor, which also loses its image). |
| Paste while in bulk | No-op (Intro unmounted; documented non-goal). |

## Test plan

- **Unit (Vitest, `tests/unit/`)**: the Stage A cases listed inline —
  restoreJob (5 cases), export option (4), relativePath (4) — using the
  existing `fixtures.ts` factories; plus `import-sources` traversal helpers
  if extracted pure (name-filtering, path normalization).
- **E2E (Playwright)**: the 6–7 cases in H1, both projects (chromium +
  webkit) except the folder-drop case (chromium-only or dropped).
- **Existing suites must stay green untouched**: the single-image e2e specs
  are the regression net for the "1 file unchanged" promise; existing unit
  tests for export must pass WITHOUT modification (A2 is additive).

## Acceptance criteria (mechanically checkable)

1. `npm run check` exits 0.
2. `npm run test:unit` exits 0 with ≥ 13 new cases vs `main`'s count at spec
   time.
3. `npm run test:e2e` exits 0 in chromium AND webkit, including the new
   `bulk.spec.ts`.
4. `src/routes/lab/` does not exist; `rg -il 'makeSampleFiles|stageMode|labBulk|LabBulk' src` outputs nothing, and `src/lib/bulk/Toast.svelte` does not exist.
5. The production build (`build/`) contains no `lab*` HTML/asset route.
6. `rg 'saveAllStub|ZIP export lands' src` outputs nothing.
7. `rg "keepOriginalWhenLarger" src/client/lazy-app/bulk/export.ts src/lib/bulk` finds both the engine option and the store state.
8. `package.json` devDependencies include `client-zip`; `package-lock.json`
   updated by npm (never hand-edited).
9. Every doc row in the H2 table shows a 2026 "Last updated" bump in the same
   PR-window of commits, and `docs/specs/2026-07-02-bulk-phase-2-promotion.md`
   has `Status: done`.
10. Commit series matches the stage plan (≥ 8 commits; code and docs
    separated).

## Verification (run these, in order)

```sh
npm run test:unit           # Stage A onward — all green
npm run check               # after every stage — exit 0
npm run test:e2e            # Stage C onward — all green, both browsers
ls build | grep -i lab      # after Stage D — no output
npm run dev                 # manual smoke, then in the browser:
```

Manual smoke (dev server, desktop viewport): drop 3 images → strip + stack
appear, encodes finish (delta pills); click an image → two-up focus; change
Quality → azure dot on cell + control; Esc → global scope; select-all via
drag → "3 images" tab; Save all → a .zip lands in Downloads and opens with 3
files; remove one image → snackbar Undo restores it instantly (no spinner).
Mobile smoke at 375×812 (devtools): summary bar, FAB, settings sheet open/
close, no overlap with Back/Add cluster. Single-image smoke: drop 1 image →
editor unchanged, undo/redo still instant.

Also run the Svelte MCP autofixer over every `.svelte`/`.svelte.ts` file
created or edited, per AGENTS.md — treat remaining intentional-side-effect
suggestions as pass, hard issues as fail.

## Guardrails

- Do NOT touch `codecs/**`, `src/features/**` codec meta, the service worker,
  `scripts/sync-sveltekit-app.mjs`, or `vite.config.ts` (the
  `presk-raw-threaded-codec-workers` plugin must stay).
- Do NOT modify `EditorSession` beyond (optionally) relaxing `pickFiles`'
  param type to `ArrayLike<File>`. Its `list[0]` reduction stays.
- Do NOT add runtime `dependencies` — `client-zip` goes in `devDependencies`
  like every other package here.
- Do NOT rename CSS custom properties or classes beyond the map in Stage B.
- Do NOT auto-format or reflow any `.md` file; Markdown is hand-formatted and
  excluded from Prettier by design.
- Do NOT persist blobs or object URLs to localStorage/IndexedDB (standing
  rule; nothing in this spec needs storage).
- Do NOT introduce `showDirectoryPicker`, File System Access writes, MIME
  sniffing at the boundary, or a PWA manifest.
- Commit directly on `main`, one commit per coherent stage-step; never push
  unless the maintainer asks; never `gh pr merge --rebase` anywhere.
- If the lab's hydration machinery (seed/override sync) fights the
  three-way page branch in a way not covered here — e.g. the focus session's
  route-state sync interferes with bulk's — STOP and report with the exact
  symptom instead of restructuring `EditorSession`.

## Anticipated mistakes (inherit this paranoia)

1. **Reusing the page's `session` for bulk focus.** Setting its `file` flips
   the page to the single-editor branch and destroys bulk. BulkMode owns a
   separate `EditorSession`. The three-way `{#if}` must check
   `bulkStore.hasJobs` FIRST.
2. **Counting raw files instead of supported files** at the boundary → a
   2-file drop with 1 junk file lands in bulk-of-1. Filter with
   `isSupportedBulkImage` BEFORE the count.
3. **Revoking object URLs on removal** (the pre-G behavior) and then trying
   to Undo → dead thumbnails/outputs. Stage G's whole point is deferring
   revocation until the snackbar settles as not-Undo.
4. **Single readEntries call** in the folder walk → silently truncated
   imports at 100 entries. Loop until an empty batch returns.
5. **Awaiting before snapshotting DataTransfer items** → empty imports in
   real browsers (the event's transfer neuters after the handler yields).
   Collect entries synchronously, then go async.
6. **Putting `webkitdirectory` on the existing input** → folder-ONLY picking,
   file picking broken. Two separate hidden inputs.
7. **Treating `''` webkitRelativePath as a real path** → junk in job state.
   Empty string means "none" — omit the field.
8. **Kept-original condition `>=`** → equal-size format conversions silently
   revert to the old format. It is STRICTLY `>`.
9. **Forgetting both Save-all call sites** — BatchInfoPanel (desktop footer)
   AND the phone summary bar in FocusView call the store; wiring only one
   leaves a dead button on mobile.
10. **Leaving `<Snackbar/>` inside the editor branch** → bulk's toasts render
    nowhere. It must sit once, outside the mode branches.
11. **Editing files under `src/lib/lab/` after Stage B** (stale checkout or
    muscle memory) — the move happened; check `git status` paths before
    committing.
12. **Skipping `npm run sync`/generated files confusion** — if imports from
    `.svelte-kit/presk-generated` fail, run `npm run check` (it syncs);
    never hand-edit generated files.
13. **Playwright: `setInputFiles` with an array fails** if Stage C's
    `multiple` attribute regressed — that's the test doing its job; fix the
    input, not the test.
14. **The phone layout floats under the old 56px top-bar assumption** —
    retune `--bulk-topbar-h` in Stage D and actually look at 375×812.
15. **Over-engineering**: no virtualized strip, no IndexedDB session
    persistence, no worker-pool resizing, no new abstractions over the
    engine. The lab code is the design; promotion is surgery, not rewrite.
16. **Two file shapes reaching the router after Stage F** (a `FileList` from
    Intro but `ImportedFile[]` from drop) → type gymnastics or silent
    `.file`-less objects. Normalize at every SOURCE (F3): after Stage F, all
    entry paths hand the router `ImportedFile[]` — never both shapes.

## If things break

| Symptom | Likely cause | Look first |
|---|---|---|
| Bulk encodes never start / hang at "queued" | Runtime drain loop not re-triggered after import; or bridges disposed by a stale exit effect | `store.importFiles` → `runtime.run(this)`; the exit/route-state effect from C2 |
| Encodes 50× slower in dev only | The raw-threaded-worker dev plugin was touched | `vite.config.ts` (`presk-raw-threaded-codec-workers`) — restore it |
| Thumbnails blank after Undo | URLs were revoked before the snackbar settled | Stage G deferred-revocation holder |
| Focus view re-encodes on every click | The hydrate-from-batch-output path broke in the move | `hydrateFocusFromBulkOutput` in BulkMode; design rule: never re-encode on inspect |
| `npm run check` fails on `webkitdirectory`/`webkitRelativePath` types | Nonstandard attr/prop typing | F4 note — attribute spread or a `.d.ts` addition |
| ZIP opens empty / corrupt | Passed `downloadUrl` strings instead of File blobs to client-zip | `zip.ts` — inputs must be the `File` objects |
| Two snackbars or none | `<Snackbar/>` rendered in a branch or twice | The single render outside the `{#if}` in `+page.svelte` |
| Back button leaves a ghost history entry / intro flashes into editor | Route-state effect ordering vs `bulkStore.reset()` | C2's `exitBulk` + syncRouteState mirror |
| e2e green locally, red in CI | CI runs the FULL Playwright suite on every push (both browsers) | Run `npm run test:e2e` completely before pushing anything |
| Build emits a lab route | Stage D deletion incomplete or a stale `.svelte-kit` | `git rm -r src/routes/lab`, then `npm run check` |

---

## TLDR

Move the finished `/lab/bulk` prototype into production: `git mv` the lab
module to `src/lib/bulk` (renames + snackbar consolidation), add a boundary
router on the main route (2+ supported files → bulk, 1 → untouched single
editor), delete the Blank stage + lab route, wire real ZIP export
(client-zip) with the keep-original-when-larger guard, add folder
import (picker + recursive drop traversal), give remove-from-batch a
snackbar Undo, then land a bulk e2e spec and the full docs sweep. Engine
gets three small pure additions first (restoreJob, export option,
relativePath), each unit-tested. Eight-plus commits, `npm run check` green
after every stage.
