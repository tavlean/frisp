# Frisp

Optimize images inside your browser. Resize and compress them on your own machine, and export. Your images never leave your device, and it works offline after the first load.

It is a modern fork of the amazing [Squoosh app], which has gone quiet over the last few years. Frisp is carrying it forward on a modern stack, current codebase, with the codecs rebuilt and the app being actively maintained.

[Try it at frisp.app](https://frisp.app)

<!-- screenshot -->

## Why Frisp

The codecs are built from current sources. That closed 14 known CVEs, one of them critical (CVSS 9.8), and made a few of them smaller or faster. Where a fix was security only, the output is identical to before, byte for byte.

The app is built on SvelteKit and Svelte 5 as a static site, a smaller and clearer codebase that is easier to build on. A Playwright suite runs the real production build in Chromium and Safari's engine on every change.

## Features

- Add an image by file picker, drag and drop, or paste.
- Encode to WebP, AVIF, JPEG XL, JPEG (MozJPEG), or PNG (OxiPNG).
- Optimize an SVG source to a smaller SVG on a dedicated vector lane.
- Resize, reduce the color palette, and rotate.
- Compare before and after side by side, with zoom, pan, and a draggable split.
- A different format and settings per side, remembered between sessions.
- Installable, runs offline, codecs precached.

## Privacy

There is no upload and no server doing the work. Every step happens in the page, and it keeps running with the network off. Your images, their file names and their details (size, dimensions, contents) never leave the browser.

The site counts a few anonymous usage events so the maintainer can see what gets used: the app was opened, an image was opened, a format was chosen, a feature was switched on, a result was saved.

- Each event is one word from a fixed list, plus the visitor's country as Cloudflare reports it.
- No cookies and no identifiers. IP addresses and user agents are not stored.
- Do Not Track and Global Privacy Control switch the counting off. So does opening `frisp.app/?usage=off` once: that browser is then never counted (`?usage=on` undoes it).
- The data stays in the project's own Cloudflare account. The code is short: [`src/lib/usage.ts`](src/lib/usage.ts), [`src/edge/worker.ts`](src/edge/worker.ts) and [`src/shared/usage-events.ts`](src/shared/usage-events.ts).

Cloudflare Web Analytics is also on, for cookieless page-view counts.

## Status

Maintained and ready for everyday single-image and bulk optimization work. Bulk Phase 2 and 2b shipped on 2026-07-03; next bulk work is Phase 3 overrides polish, with multi-format compare after that ([roadmap](docs/project/roadmap.md), [current state](docs/project/brief.md)).

## Browser support

Recent Chrome, Edge, Firefox, and Safari. The [policy](docs/browser-support.md) has the version floors.

## Running it locally

Node 24.12 or newer and npm 11 or newer (see [.nvmrc](.nvmrc)).

```sh
npm install
npm run dev      # dev server
npm run build    # static production build
npm run check    # typecheck, production build, static-output audit
npm test         # check, unit tests, Playwright e2e
```

## Docs

[docs/README.md](docs/README.md) maps everything. Useful starts:
[overview](docs/overview.md), [how the codecs are built](docs/codec-build-notes.md),
[multithreading](docs/threading-enablement.md),
[user guide](docs/user-guide/index.md), [agent guide](AGENTS.md).

## Thanks

Frisp exists because of [Squoosh] from GoogleChromeLabs. They worked out how to do all this in the browser with no server and made it look easy. It continues from there under the same Apache 2.0 license.

[squoosh]: https://github.com/GoogleChromeLabs/squoosh

[Squoosh app]: https://github.com/GoogleChromeLabs/squoosh