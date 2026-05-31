# Sqush project overview

Sqush is derived from Squoosh, a browser app for compressing images locally. Users drop or pick an image, the app decodes it in the browser, lets the user compare two output settings side by side, and writes the compressed output without uploading the image to a server.

The app is a static web app. There is no backend application in this repository.

## What runs where

- The browser UI is written in TypeScript and Preact.
- Heavy image work runs in Web Workers so the page does not freeze.
- Many image codecs are WebAssembly files built from C, C++, or Rust projects under `codecs/`.
- The service worker caches the app and handles PWA/share-target behavior.
- The build system is custom Rollup code in `rollup.config.js` and `lib/`.

## Main folders

- `src/static-build/`: creates static files such as `index.html`, `manifest.json`, and Netlify-style `_headers`.
- `src/client/initial-app/`: the first browser app loaded on the page. It handles routing, file drop/pick, loading the editor, analytics, and service-worker startup.
- `src/client/lazy-app/`: the editor loaded after the initial app. This is where most user-facing compression UI lives.
- `src/features/`: image features grouped as encoders, decoders, processors, and preprocessors.
- `src/features-worker/`: generated worker entry point plus worker utilities.
- `src/sw/`: service worker source.
- `src/shared/`: UI and utility code shared between the static page, initial app, and lazy editor.
- `codecs/`: codec subprojects and prebuilt `.js`/`.wasm` outputs.
- `lib/`: custom Rollup plugins and build helpers.
- `build/`: generated production output from `npm run build`.
- `.tmp/`: generated TypeScript/Rollup intermediate output.

## Important commands

- `npm install`: installs Node dependencies and installs Husky Git hooks.
- `npm run build`: builds the static app into `build/`.
- `npm run dev`: runs Rollup in watch mode and serves `build`-like output from `.tmp/build/static`.
- `npm run check`: runs formatting, build, build smoke, helper tests, and TypeScript checks.
- `npm run audit`: reports dependency vulnerabilities and fails on any vulnerability.
- `npm run preview`: serves the production `build/` output after a build.

Run `npm run build` before `npm run typecheck` on a fresh checkout so generated feature files exist. `npm run check` already runs commands in the safe order.

## How an image flows through the app

1. `src/static-build/index.tsx` builds the static HTML shell and manifest.
2. `src/client/initial-app/index.tsx` starts the browser app.
3. `src/client/initial-app/App/index.tsx` waits for a file drop, file picker selection, or PWA share target.
4. The editor component `src/client/lazy-app/Compress/index.tsx` loads the image.
5. The image is decoded using browser APIs when possible, or worker-based decoders for formats such as AVIF, WebP, WebP 2, JPEG XL, and QOI.
6. Preprocessors run once for the source image. Today this mainly means rotation.
7. Each comparison side can apply processors independently. Today this includes resize and quantize.
8. Each side can encode to a chosen output format.
9. Results are shown side by side and downloaded from browser-created object URLs.

## How features are connected

Features live under `src/features/` and follow a convention:

- `shared/meta.ts` defines the label, MIME type, file extension, option types, and default options.
- `client/` contains UI or client-side code for that feature.
- `worker/` contains code that should run in a Web Worker.

The file `lib/feature-plugin.js` scans `src/features/` during the build and generates:

- `src/client/lazy-app/feature-meta/index.ts`
- `src/client/lazy-app/feature-meta/shared.ts`
- `src/client/lazy-app/feature-meta/encoders.ts`
- `src/client/lazy-app/feature-meta/processors.ts`
- `src/client/lazy-app/feature-meta/preprocessors.ts`
- `src/client/lazy-app/worker-bridge/active-meta.ts`
- `src/client/lazy-app/worker-bridge/meta.ts`
- `src/client/lazy-app/worker-bridge/surface.ts`
- `src/features-worker/active.ts`
- `src/features-worker/index.ts`

These generated files are recreated by the build and ignored by Git unless a
file is intentionally tracked as a source seam. If you add, remove, or rename a
feature, run the build before typechecking or testing the app.

## Fork-specific changes noticed

This fork appears to add saved left/right editor settings using `localStorage` in `src/client/lazy-app/Compress/index.tsx`. The feature stores `leftSideSettings` and `rightSideSettings`, then imports them back into each comparison side.

This is useful, but it should be hardened before larger work:

- handle invalid or old JSON in `localStorage`;
- version saved settings so future option changes do not break imports;
- document the expected saved-settings shape;
- add tests or manual QA steps around save/import/undo.

## Deployment notes

The generated app expects to be served as a static site. The generated `_headers` file sets:

- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`

These headers matter because some codecs use WebAssembly threads. If a production host does not apply these headers, threaded/SIMD codec paths may fail or fall back.

The service worker only registers in production builds. Local dev behavior can differ from production behavior.
