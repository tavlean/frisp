# SVG benchmark corpus

This corpus is a deliberately varied set of 215 SVG inputs for measuring Frisp's optimization ratio, robustness, and visual fidelity against external optimizers. It covers stroke and fill icons, multi-color emoji, brand artwork, public-health illustrations, realistic synthetic editor exports, large detailed maps and technical diagrams, and adversarial SVG features; it is benchmark data rather than application or test-fixture code.

## Regeneration

Downloaded files are immutable snapshots from the exact URLs in `corpus/MANIFEST.json`; fetch those URLs with `curl -fsSL`, reject responses without an `<svg` root marker, and recalculate `bytes` and SHA-256 after any intentional refresh. Synthetic editor exports and adversarial inputs are maintained directly in their stratum directories and use `source: "synthetic"`. Keep every ordinary input at or below 500 KB, the complete corpus at or below 15 MB, and update the manifest whenever a file changes. License metadata must be checked against the tagged upstream release before changing a source.

## Licenses

| Source family                             | Corpus use                           | License    |
| ----------------------------------------- | ------------------------------------ | ---------- |
| Tabler Icons 3.31.0                       | Stroke icons                         | MIT        |
| Material Design Icons SVG 0.14.15         | Fill icons                           | Apache-2.0 |
| Simple Icons 13.21.0                      | Fill icons and brand marks           | CC0-1.0    |
| Twemoji 16.0.1 (`jdecked/twemoji`)        | Multi-color icons                    | CC-BY-4.0  |
| Devicon 2.16.0                            | Complex color logos                  | MIT        |
| Health Icons (`main`, fetched 2026-07-12) | Flat public-health illustrations     | CC0-1.0    |
| Wikimedia Commons (fetched 2026-07-12)    | Large detailed maps                  | CC0 / Public domain |
| libaom 3.12.1                             | Large technical diagrams             | BSD-2-Clause |
| Frisp synthetic inputs                    | Editor exports and adversarial cases | CC0-1.0    |

Individual provenance, exact source URL, byte count, and digest are recorded in `corpus/MANIFEST.json`. CC-BY attribution for Twemoji: Copyright 2020 Twitter, Inc and other contributors; graphics licensed under CC-BY 4.0.

## Harness

Run `npm run bench:svg` to start a Vite dev server on port 5190 and drive Chromium through Frisp's real SVG worker, renderer, visual gate, and auto-search pipeline. Use `npm run bench:svg -- --limit 10` for a smoke run, or `--base-url http://host:port` with an existing development server.

Runs write metadata to `results/frisp-<git-short-sha>.json` and optimized files under `external/frisp-safe/` and `external/frisp-auto/`, preserving corpus-relative paths. Browser gzip sizes in the JSON are informational because fflate and Node zlib can differ slightly.

Add an external tool by placing outputs in `external/<tool>/<same-relative-path>.svg`; never overwrite the corpus. Run `npm run bench:svg:compare -- results/frisp-<sha>.json` (N result JSONs are accepted) to generate `RESULTS.md`. Comparison reads every tool's files from disk and recompresses all outputs with Node zlib gzip level 9. It reports raw and gzip totals, median/geomean ratios to input, pairwise gzip win/tie/loss, and per-stratum tables. A tie is within `max(4 bytes, 0.1%)`.
