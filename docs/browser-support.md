# Browser support policy

Last reviewed: 2026-05-24.

Frisp should target modern browsers that can run the optimizer locally. The product promise is not just that the page renders; the browser must be able to decode inputs, run WebAssembly codecs in workers, preview results, download outputs, and support the service-worker path for offline use.

## Supported baseline

Use this as the first public support target:

| Browser           | Minimum target | Reason                                                                                                      |
| ----------------- | -------------: | ----------------------------------------------------------------------------------------------------------- |
| Chrome / Chromium |            121 | Modern Chromium baseline with WebAssembly, workers, service workers, WebP, and AVIF.                        |
| Edge              |            121 | Aligns with Chromium and MDN's AVIF support note for Edge 121.                                              |
| Firefox           |        115 ESR | Long-lived Firefox baseline with WebAssembly, workers, service workers, WebP, and AVIF still-image support. |
| Safari            |             17 | Avoid Safari 16 because this codebase has a known WebAssembly-thread/nested-worker compatibility concern.   |

These are support targets, not artificial blockers. The app can still run in newer compatible browsers outside this list, and many older versions may work. The project should only promise support for versions that we test.

## Required browser capabilities

Frisp depends on these capabilities:

- WebAssembly for codecs and processors;
- Web Workers for keeping heavy optimization work off the UI thread;
- service workers and Cache Storage for offline/PWA behavior;
- Canvas and ImageData for preview and resize;
- Blob, File, object URLs, local file input, paste, drag/drop, and downloads;
- dynamic module loading for the current SvelteKit/Vite output;
- optional WebAssembly SIMD and threads for faster codec paths.

WebAssembly SIMD and threads are optimization paths, not the minimum product contract. The app should fall back to non-SIMD or single-threaded codec builds when possible.

## Codec support notes

Browser image support and bundled WASM codec support are separate concerns. A browser may run Frisp but still lack native preview or decode support for some formats.

Product priority:

- WebP is the safest first-class output. MDN lists WebP as supported in Chrome, Edge, Firefox, Opera, and Safari.
- AVIF is first-class, but should be tested carefully because encoding can be slower and browser history is shorter. MDN lists AVIF support in Chrome, Edge, Firefox, Opera, and Safari, with version floors including Chrome 85, Edge 121, Firefox 93, and Safari 16.1.
- JPEG XL should stay advanced or experimental until default browser support and preview behavior are proven. Frisp can keep its bundled WASM codec path for local conversion, but public delivery guidance should still prefer AVIF/WebP fallbacks.
- WebP 2 was removed entirely on 2026-06-02 (no browser can decode it; see [codec-surface-cleanup.md](codec-surface-cleanup.md)).

MDN also lists BMP as broadly browser-supported and TIFF as Safari-only, which is why extension acceptance and actual decode success must remain separate.

## SvelteKit baseline

The root SvelteKit build should keep the same browser promise unless measured
QA proves a reason to change it. The migration should not add support for older
browsers by accident or drop currently supported evergreen browsers without an
explicit decision.

For Svelte/SvelteKit planning:

- keep the target at modern evergreen browsers only;
- prefer static output and browser-local processing;
- avoid adding server-only requirements for image optimization;
- treat Web Workers, WebAssembly, service workers, Canvas/ImageData, File/Blob APIs, object URLs, and dynamic imports as required platform features;
- keep browser smoke coverage as the proof, not framework assumptions.

## Release gates

Before claiming support for a browser version:

- run `npm run check`;
- run a production preview smoke test;
- import and optimize at least one JPEG or PNG;
- export WebP successfully;
- test AVIF if it is visible as a first-class option;
- verify reload/offline behavior after the service worker installs;
- confirm no unexpected browser-console errors.

## Sources

- MDN image file type guide: https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Formats/Image_types
- MDN ServiceWorker API: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorker
- MDN Web Workers API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API
- MDN WebAssembly: https://developer.mozilla.org/en-US/docs/WebAssembly
- Svelte migration docs checked for framework planning: https://svelte.dev/docs
- Web platform features explorer, JPEG XL status: https://web-platform-dx.github.io/web-features-explorer/features/jpegxl/
