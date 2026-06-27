# Codec Surface Cleanup — Plan

Last updated: 2026-06-27. Status: **DONE** — three removals recorded here: WebP 2
and the dead `codecs/png` dir (2026-06-02, branch `codec-cleanup-and-threading`),
then the browser canvas encoders + QOI-as-output (2026-06-27, branch
`chore/trim-encoder-surface`). Kept as the record of what was removed and why.

Read [codec-provenance.md](codec-provenance.md) before touching `codecs/`, and
follow its build / generated-metadata / service-worker / browser verification
rules. Evidence behind both removals is in
[codec-upgrade-audit.md](codec-upgrade-audit.md).

## 1. Remove WebP 2 (wp2) — DONE

**Decision: remove it.** WebP 2 is a permanently-experimental Google "playground"
format — no browser or OS can open the files, the bitstream is deliberately
non-final (today's `.wp2` files can become undecodable later), and the build
predates years of fuzzer fixes. There is no "more stable version" to move to.
This reverses the migration-era "keep for parity" stance now that parity is
closed and we have the evidence.

**Removed end to end in commit `962bdd0f`** (encoder *and* decoder — no
mainstream browser ever shipped `.wp2`, and the only real-world producer was this
app's own encoder, so full removal was the chosen path rather than the staged
hide-then-delete originally sketched here). What went:

- `codecs/wp2/` (the entire committed WASM/JS/source tree).
- `src/features/encoders/wp2/`, `src/features/decoders/wp2/`,
  `src/lib/editor/options/Wp2Options.svelte`.
- `docs/user-guide/formats/webp2.md` and all user-guide wp2/WebP2 rows + links.
- All wp2 wiring in the data-driven layer: `scripts/sync-sveltekit-app.mjs`
  (encoder names, ready-worker methods, codec-asset records, patched-wrapper
  paths, the generated features-worker template, orchestration),
  `scripts/audit-static-output.mjs` (globs/finds/expected records/asserts),
  `src/shared/codec-assets.ts` (the `CodecAssetCodec` union), `src/lib/compress.ts`
  (`OUTPUT_FORMATS`), `src/client/lazy-app/image-pipeline*.ts`, `image-decode.ts`
  (the `image/webp2` magic-byte branch), `bulk/import.ts` (`.wp2` extension),
  `sveltekit-worker-bridge.ts`, `OptionsPanel.svelte`, `src/sw/cache-plan.ts`
  (dead wp2 fields + the `Omit` alias + dead
  `buildAdditionalProcessorCacheUrls`), and an `AdvancedSection.svelte` comment.

**Verified:** `npm run check` passes (format:check, sync, svelte-kit sync,
svelte-check 0/0, vite build, audit:static-output). The regenerated
`.svelte-kit/sqush-generated/**` contains no wp2 references.

## 2. Delete the dead `codecs/png/` directory — DONE

`codecs/png/` was a Rust `image-png` wrapper (`squoosh-png`, `png 0.16.7`) that
was **never imported by the web app**. It was a vestigial CLI/Node
encoder/decoder carried from the Squoosh monorepo, deleted in the codec-cleanup
pass (commit `7bd03980`, alongside the dead `codecs/visdif/` butteraugli utility
and the orphaned `src/client/lazy-app/storage.ts` localStorage helper). Docs
(`codec-provenance.md`, `user-guide/reference/engine-and-codecs.md`) were updated
in the same commit to mark png/visdif deleted.

The PNG path is fully covered without it:
- **encode / optimize** → OxiPNG (the canvas `browserPNG` encoder that originally
  also covered plain encode was itself removed in §3),
- **decode** → native browser (that's why `src/features/decoders/` has no `png`).

No generated codec-asset record referenced it; `npm run check` stayed green after
deletion.

## 3. Remove the browser canvas encoders + drop QOI from the picker — DONE (2026-06-27)

**Decision: a compression tool should offer one best-in-class encoder per output
format, not redundant worse ones.** The three canvas (`canvas.toBlob`) encoders
each duplicated a format already covered by a stronger WASM codec — browserJPEG
vs MozJPEG, browserPNG vs OxiPNG — while browserGIF was almost never even
feature-detectable (`canvas.toBlob('image/gif')` is unsupported in nearly every
browser). They produced larger files for the tool's whole reason to exist, so
they were removed end to end. **QOI was dropped from the output picker only** —
it's a fast lossless format with effectively no support outside specialised
tools, so it isn't a useful compression target; **its decoder stays**, so
importing `.qoi` files still works.

Three commits on `chore/trim-encoder-surface`:

- **QOI, hide only (`7002520b`):** removed just the `qoi` row from
  `src/lib/compress.ts` `OUTPUT_FORMATS`. Everything else QOI — encoder feature
  dir, worker-bridge `qoiEncode`, codec assets, SW precache, the `/diagnostics`
  pipeline probe, and the whole decoder path — is deliberately untouched. (A full
  encoder rip-out is possible but low-ROI: the decoder shares the worker bridge,
  codec-asset records, and `cache-plan.ts`, and the probe round-trips
  `qoiEncode`.)
- **Browser encoders, UI layer (`78c00415`):** their three `OUTPUT_FORMATS` rows
  plus the now-dead runtime feature detection that existed solely to gate them
  (`BROWSER_ENCODER_MIME`, `BROWSER_ENCODER_IDS`, `canvasSupportsMime`,
  `getSupportedFormatIds` in `compress.ts`); the `supportedFormatIds` /
  `loadSupportedFormats` machinery in `editor-session.svelte.ts` (`availableFormats`
  is now static); the `onMount` probe call in `src/routes/+page.svelte`; and the
  `browserJPEG` branch + import in `OptionsPanel.svelte`.
- **Browser encoders, engine layer (`915187c1`):** the three names in
  `scripts/sync-sveltekit-app.mjs` `appEncoderNames` (so the generated
  `encoderMap`/`EncoderState` drop them); the three dispatch cases in
  `src/client/lazy-app/image-pipeline.ts`; the feature dirs
  `src/features/encoders/browser{GIF,JPEG,PNG}`; and
  `src/lib/editor/options/BrowserJpegOptions.svelte`. These were canvas-only (no
  WASM assets, no decoder twins), so no codec-asset record or `cache-plan.ts`
  entry referenced them.

**Verified:** `npm run check` passes (format:check, sync, svelte-kit sync,
svelte-check 0/0, vite build, audit:static-output), and a dev-server smoke test
confirms both format pickers now list exactly Original / WebP / AVIF / JPEG XL /
MozJPEG / OxiPNG, with a clean WebP encode and no console errors.

**Docs still to reconcile:** the end-user guide still documents the browser
encoders and QOI-as-output across ~8 files (`choosing-a-format.md`,
`formats/simple-formats.md`, `engine-and-codecs.md`, `recommended-settings.md`,
`index.md`, and the `reference/` inventory). That's a separate authorial pass —
see the user-guide registry row in `docs/README.md`.

## Out of scope here

- QOI (spec frozen — bump the pinned SHA only if rebuilding for another reason),
  `hqx` (already latest, upstream abandoned). Tracked in
  [codec-upgrade-audit.md](codec-upgrade-audit.md) as skip/opportunistic.
- Other codec visibility/grouping decisions — product call, see
  [road-map.md](road-map.md).
