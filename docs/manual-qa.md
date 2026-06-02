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

## Format Spot Checks

At minimum before launch:

- WebP encode/download.
- AVIF encode/download.
- JPEG XL encode/download if browser/runtime permits the preview.
- MozJPEG and OxiPNG encode/download.
- QOI encode/download.
- Browser JPEG/PNG feature detection and encode.

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

The repo does not currently ship a Playwright dependency. On 2026-05-31 the
local browser smoke used the Codex Playwright CLI wrapper against the production
preview on `127.0.0.1:5189`.

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

Prefer a real photo for release QA; `static/logo.webp` is only a lightweight
smoke asset.

## Bulk

Bulk UI is roadmap work and is not part of migration closeout. When bulk work
starts, add QA for multi-file import, queue progress, per-image status,
overrides, retry/cancel, export-all, and object URL cleanup.
