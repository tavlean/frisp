# Manual QA Checklist

Use this before releases and after changes touching build tooling, workers,
codecs, service workers, image processing, or editor behavior.

> **Much of the per-format encode smoke is now automated** — `npm run test:e2e`
> (Playwright, `tests/e2e/`) loads an image and encodes through every codec
> asserting valid output bytes, checks cross-origin isolation, and tests offline
> reload, all against the production preview. Run it first; this manual checklist
> is for what automation can't judge: **visual quality**, real-photo results,
> **Safari/Firefox**, and mobile layout.

## Setup

```sh
npm run check
npm run preview -- --host 127.0.0.1 --port 5189 --strictPort
```

Open `http://127.0.0.1:5189` in a fresh browser context when possible.

## App Shell

- Logo renders on the intro screen.
- File picker is available.
- Drag/drop overlay appears when dragging an image.
- `/diagnostics` loads.
- Browser console has no unexpected errors.

## Single-Image Workflow

- Open a JPEG or PNG.
- Open a large photo and confirm fit, pan, zoom, and download still work.
- Open an SVG and confirm it encodes/downloads through the selected output
  format.
- Open WebP if a sample is available.
- Change the output encoder.
- Change encoder options.
- Enable resize and change dimensions.
- Enable quantize where available.
- Rotate the input.
- Download the generated output and verify the extension/bytes are plausible.
- Use the back button and confirm the app returns to the import screen.

## Undo / Redo & Instant Revisit

- Make several distinct changes (format, quality, resize, rotate). Confirm **Undo**
  is greyed before the first change and **Redo** is greyed at the newest state.
- Step back/forward with the buttons _and_ with `⌘/Ctrl+Z` / `⇧⌘Z` (or `Ctrl+Y`).
  Confirm the controls **and** the image both revert each step.
- Confirm returning to a prior recipe is **instant** — no "Optimizing…" pill, no
  wait (it replays a kept result). Toggle **Lossless** off then on and watch the
  on-result come back immediately.
- Make both sides identical (or use "Copy settings to other side"); confirm the
  second side lands on the result instantly (the cache is shared across sides).
- Focus a number field (e.g. Quality) and press `⌘/Ctrl+Z`; confirm it does the
  field's own text-undo, not an app undo (typeable fields are excluded).
- Drag a slider continuously, release, then Undo once; confirm it jumps back past
  the whole drag (coalesced into one step), not value-by-value.
- Load or replace the image; confirm Undo resets (history is per-image).

## Format Spot Checks

At minimum before launch:

- WebP encode/download.
- AVIF encode/download.
- JPEG XL encode/download if browser/runtime permits the preview.
- MozJPEG and OxiPNG encode/download.

## Saved Settings

- Change both side formats/options.
- Refresh the app.
- Reopen an image.
- Confirm saved settings are restored.
- Clear site data.
- Reopen the app and confirm missing settings do not break startup.

## Mobile Layout

Check at roughly `390 x 844`:

- intro text and buttons fit;
- editor has no horizontal overflow;
- output controls remain reachable;
- bottom option panels are usable;
- text does not overlap controls.

## Offline

Use a production preview.

1. Load the app online.
2. Open an image and perform one encode.
3. Confirm the service worker controls the page.
4. Switch the browser context offline.
5. Reload `/`.
6. Confirm the app shell loads and a cached codec path still works.

## Playwright Smoke Shape

The repo ships a Playwright suite. Use `npm run test:e2e` for automated browser regression; use this checklist for visual quality, release, and cross-browser manual checks. The browser smoke runs against the production preview.

Current smoke coverage:

- PNG to WebP download links;
- JPEG, SVG, and WebP inputs to WebP download links;
- desktop editor load;
- `390 x 844` mobile viewport with no horizontal overflow;
- service-worker-controlled offline reload;
- no unexpected console or page errors.

Suggested future smoke:

1. Start preview on `127.0.0.1:5189`.
2. Upload a local PNG or JPEG.
3. Wait for the editor title to include the file name.
4. Switch one side to WebP.
5. Wait until the title is no longer in a working state.
6. Assert an `a[download]` or blob URL exists for the output.
7. Check console errors.

Prefer a real photo for release QA; `tests/fixtures/photo.jpg` (or
`photo-large.jpg`) is a good lightweight smoke asset. The static brand SVGs
(`logo.svg`, `wordmark.svg`, `favicon.svg`) are design assets, not photo test
inputs.

## Bulk

Bulk UI is roadmap work and is not part of migration closeout. When bulk work
starts, add QA for multi-file import, queue progress, per-image status,
overrides, retry/cancel, export-all, and object URL cleanup.
