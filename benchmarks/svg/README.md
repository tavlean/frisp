# SVG benchmark corpus

This corpus is a deliberately varied set of 200 SVG inputs for measuring Frisp's optimization ratio, robustness, and visual fidelity against external optimizers. It covers stroke and fill icons, multi-color emoji, brand artwork, public-health illustrations, realistic synthetic editor exports, and adversarial SVG features; it is benchmark data rather than application or test-fixture code.

## Regeneration

Downloaded files are immutable snapshots from the exact URLs in `corpus/MANIFEST.json`; fetch those URLs with `curl -fsSL`, reject responses without an `<svg` root marker, and recalculate `bytes` and SHA-256 after any intentional refresh. Synthetic editor exports and adversarial inputs are maintained directly in their stratum directories and use `source: "synthetic"`. Keep every ordinary input at or below 500 KB, the complete corpus at or below 15 MB, and update the manifest whenever a file changes. License metadata must be checked against the tagged upstream release before changing a source.

## Licenses

| Source family | Corpus use | License |
|---|---|---|
| Tabler Icons 3.31.0 | Stroke icons | MIT |
| Material Design Icons SVG 0.14.15 | Fill icons | Apache-2.0 |
| Simple Icons 13.21.0 | Fill icons and brand marks | CC0-1.0 |
| Twemoji 16.0.1 (`jdecked/twemoji`) | Multi-color icons | CC-BY-4.0 |
| Devicon 2.16.0 | Complex color logos | MIT |
| Health Icons (`main`, fetched 2026-07-12) | Flat public-health illustrations | CC0-1.0 |
| Frisp synthetic inputs | Editor exports and adversarial cases | CC0-1.0 |

Individual provenance, exact source URL, byte count, and digest are recorded in `corpus/MANIFEST.json`. CC-BY attribution for Twemoji: Copyright 2020 Twitter, Inc and other contributors; graphics licensed under CC-BY 4.0.

## Harness

Harness TBD (stage S7b).
