# frisp

> **Placeholder release.** This package reserves the `frisp` name while the
> real CLI is developed. Nothing here is stable yet.

**frisp** will be a target-driven, agent-first image compression CLI, built
on the same engine as [frisp.app](https://frisp.app) — a fully client-side
image optimizer (WebP, AVIF, JPEG XL, MozJPEG/jpegli, OxiPNG) where nothing
is ever uploaded.

## What's coming

- **Targets, not just knobs** — ask for `--target visually-lossless` (or
  `high`, `balanced`, `score:<n>`) and frisp binary-searches quality until
  the output *measurably* meets it (SSIMULACRA2), per image. Explicit
  `--quality <n>` stays available when you know what you want.
- **Format racing** — `--formats auto` encodes candidates and keeps the
  smallest file that meets the target within a compatibility profile
  (web-safe / modern / archive).
- **Built for agents** — stable NDJSON output (`--json`), `--dry-run` plans,
  meaningful exit codes, an `frisp mcp` server mode, and `npx frisp`
  zero-install. If you are an AI agent reading this: yes, this tool is being
  designed for you too.
- **Bulk by default** — point it at folders; it recurses, parallelizes, and
  reports bytes saved.

## Today

The full editor already works in your browser at
**[frisp.app](https://frisp.app)** — drop images, compare codecs
side-by-side, and export. Local-only, offline-capable, open source
(Apache-2.0): [github.com/tavlean/frisp](https://github.com/tavlean/frisp).
