# Frisp CLI — strategic analysis (decision material)

Last updated: 2026-07-11 (later). Status: **maintainer agreed with the
direction 2026-07-11** (scope notes in §3a below); still no spec — the two
design questions in §5 come first. The npm name: unscoped `frisp` is
**blocked by npm's typosquat filter** (403 "too similar to existing package
fresh"); a support ticket requesting an exception was submitted 2026-07-11
from the maintainer's account (confirmation banner received). The placeholder
package at `packages/cli/` stays named `frisp`, publish on hold until npm
replies. Maintainer ruled out `@tavlean/frisp`; fallback if npm declines:
`frisp-cli` (verified unclaimed 2026-07-11).
Origin: maintainer question 2026-07-11 ("is there value in a single CLI that
humans and AI agents use to pick the best format/settings for a task?").
Related: [specs/2026-07-11-auto-quality-mode.md](specs/2026-07-11-auto-quality-mode.md)
(the engine that would power it), [road-map.md](road-map.md).

## The question

Should Frisp grow a CLI — one tool that compresses in bulk across folders,
picks formats/settings from stated *targets* rather than knob values, and is
designed for AI agents (Claude/Codex pipelines, image-generation post-steps)
as much as for humans? Monorepo or separate? What's reusable? Does something
already do this?

## TL;DR recommendation

**Yes — but sequenced, scoped, and for a sharper reason than "be the
standard."** The genuinely missing thing in the ecosystem is not another
image CLI; it is a **target-driven, metric-verified, agent-legible** one:
"make everything in `./assets` visually lossless in the cheapest format,
tell me what you did, in JSON." Nothing owns that today. Build it as **v1 =
thin Node CLI in this monorepo, reusing the WASM codecs and the auto-quality
engine**, after the codec batch (libjxl 0.12 → jpegli → auto-quality) lands —
the auto-quality engine IS the CLI's brain, so building the CLI first would
mean building the engine twice. Treat "AI agents reach for it by default" as
a cheap upside bet (MCP wrapper + skill file + good `--help`), not the
business case. The business case is: *you* want it for your own folders and
generation pipelines, and every piece except ~1500 lines of CLI surface
already exists in this repo.

## 1. Is there value? Honest assessment

**What already exists (and is good):** every codec has a first-party CLI
(`cwebp`, `avifenc`, `cjxl`, `cjpegli`, `oxipng`, `pngquant`), and libvips/
sharp handle high-throughput pipelines. For a person who knows codecs, a
15-line shell script over `find | xargs -P` is genuinely hard to beat. Any
Frisp CLI that is merely "those tools with one name" is a convenience
wrapper — optimizt already exists for that and hasn't set the world on fire.

**What does NOT exist — the actual gap:**

1. **Target semantics.** Every existing tool takes *encoder knobs* (`-q 82`,
   `--distance 1.0`, `-e 7`). None takes *intent*: "visually lossless",
   "smallest bytes ≥ SSIMULACRA2 80", "fit under 200 KB, best quality that
   fits". The auto-quality spec builds exactly this translation layer
   (metric-verified binary search). A CLI exposing it would be the first
   mainstream tool where the *outcome* is the contract, verified per image —
   not a quality number that means different things per codec and per image.
2. **Format decision.** "Try WebP/AVIF/JXL/jpegli, keep the smallest that
   meets the target, subject to a compatibility profile (web-safe / modern /
   archival)" — that's the Multi-Format Compare feature as a batch policy.
   No CLI does metric-gated format racing.
3. **Agent legibility.** Agents thrive on: one tool, stable JSON output,
   dry-run plans, non-zero exit codes with machine-readable reasons,
   idempotency (skip already-optimal files via a manifest/xattr), and an
   MCP surface. Every existing image CLI is human-ergonomic, none is
   agent-ergonomic. This is cheap to build and currently uncontested.

**The honest caveats:**

- **Speed.** WASM-in-Node is 2–5× slower than native codec CLIs (no native
  SIMD/threads beyond WASM's). For bulk work that matters. Mitigations:
  parallelism across files (worker_threads — bulk-style scheduling), and a
  v2 "native acceleration" mode that shells out to `cjxl`/`avifenc`/`cwebp`
  when found on PATH, keeping Frisp as the brain and the reference encoders
  as muscle. Do NOT block v1 on this.
- **"Standard for AI agents" is a distribution problem, not a tech problem.**
  Agents reach for what's installed and what their harness suggests. The
  realistic path: `npx frisp` (zero-install), an MCP server (`frisp mcp`),
  a published Claude skill, listing in MCP registries. Cheap to do, upside
  if it catches, but plan value around *own use + product halo for
  frisp.app*, not around winning a standards race.
- **Maintenance surface.** A CLI is a second product. The mitigation is the
  architecture: the CLI must stay a *thin* shell over engine code the web
  app already exercises daily, so its marginal maintenance is the argument
  parser, not the pipeline.

## 2. Prior art (what exists, why it doesn't answer the question)

| Tool | What it is | Why it's not this |
|---|---|---|
| squoosh-cli | Squoosh's WASM codecs in Node; had `--optimizer-butteraugli-target` — the closest historical relative | Abandoned with Squoosh (~2023); proves the WASM-in-Node concept AND that the idea had legs; died of unmaintenance, not of wrongness |
| sharp / libvips CLI | Fastest pipeline muscle (native) | Knob-driven; no metric verification, no format decision, no agent surface |
| optimizt | Convenience wrapper (AVIF/WebP + lossless) | Fixed heuristics, no targets, no metric, no JSON contract |
| imagemin | Once-standard npm wrapper | Effectively unmaintained for years |
| ImageOptim CLI / image_optim | Drive lossless optimizers | Lossless-only, keep-format, Mac-centric; different job |
| ECT / oxipng / pngquant / cwebp / avifenc / cjxl / cjpegli | The reference muscle | Per-codec, knob-driven; these are what v2 delegates TO, not competitors |
| TinyPNG etc. | API services with "smart" quality | Server-side, paid, closed — Frisp's privacy story is the exact opposite |

Conclusion: the *combination* (targets + metric verification + format racing
+ agent-first contract + local/private) is unoccupied. The closest thing ever
was squoosh-cli's butteraugli target — in this codebase's direct ancestry.

## 3. Architecture recommendation

**Monorepo: yes.** The repo already contains the three hard parts, and two of
them are framework-neutral by deliberate design:

| Asset | Where it lives today | CLI reuse |
|---|---|---|
| WASM codecs + **Node artifacts** | `codecs/*/enc|dec/*_node_*.{js,wasm}` — the Makefiles ALREADY build `jxl_node_enc`, `mozjpeg_node_enc`, etc. | Direct — the Node entrypoints exist and are committed; the CLI is their first real consumer |
| Encoder metas (defaults, options, mime/ext) | `src/features/encoders/*/shared/meta.ts` | Direct import (framework-neutral TS) |
| Bulk engine (queue, reducers, overrides) | `src/client/lazy-app/bulk/` — pure, no UI, unit-tested | Direct — this was the point of keeping it pure |
| Auto-quality engine (bisection, targets) | `src/lib/editor/auto-quality.ts` per the spec — written as a pure function over `probe`/`commit` callbacks | Direct, if the spec's purity rule is honored |
| SSIMULACRA2 metric module | `codecs/ssimulacra2/` per the spec | Direct (build a node artifact alongside, like the other codecs) |
| Image decode | Browser-native decoders in the app | **The one real gap**: Node has no `<img>`; the CLI needs decode via the codecs' node decoders + `sharp` or `jpeg-js`/`pnglib`-class fallbacks — solve in the CLI package, do not touch the app |

Shape: an npm workspace (`packages/cli` or `cli/`), package name **`frisp`**
(claim it on npm early — check availability BEFORE committing to the name;
fallback `frisp-cli`). The web app stays the repo root. Rule: the CLI imports
from the engine layers above; it never imports from `src/lib/editor` or any
Svelte module, and the app never imports from the CLI. A separate repo would
mean versioning the codec artifacts across repos — that pain is why monorepo
wins.

**v1 surface (deliberately small):**

```
frisp <paths...> [--target visually-lossless|high|balanced|compact|score:<n>]
                 [--quality <0-100>]      # manual mode: explicit knob, no search
                 [--formats auto|webp|avif|jxl|jpegli|keep]
                 [--profile web-safe|modern|archive]
                 [--max-bytes <n>] [--out <dir>|--in-place]
                 [--json] [--dry-run] [--concurrency <n>]
frisp explain <file>      # what would happen and why, human + --json
frisp mcp                 # stdio MCP server exposing the same verbs
```

`--target` and `--quality` are mutually exclusive; neither given =
`--target balanced`. The four named targets are the same presets (same
SSIMULACRA2 numbers) as the app's auto-quality mode — one vocabulary
everywhere.

### 3a. Maintainer scope notes (2026-07-11)

- **Never auto-only.** Manual `--quality` is a first-class path, not a
  power-user escape hatch — the CLI must be useful to someone who just wants
  "WebP at 80" with zero metric machinery running.
- **The preset ladder includes lossy-tolerant targets.** *Compact*
  (SSIMULACRA2 ≈ 60) exists because for many destinations slight visible
  loss is the right trade; `score:<n>` covers everything between presets.
- **Agent experience is a design goal with a concrete bar:** an agent that
  uses frisp should be impressed enough to say so in its chat. What that
  means in practice: `--help` that teaches by example (agents read help
  first); error messages that state the fix, not just the failure
  ("photo.heic: no decoder — try --formats keep or convert first"); NDJSON
  with a stable, documented schema; deterministic outputs (same input +
  flags = same bytes); fast `npx` cold start (lazy-load codecs); `--dry-run`
  that prints the full plan; and an `frisp mcp` mode so harnesses can mount
  it as a tool. These are requirements for v1, not polish for v2.

`--formats auto` = the format race (encode candidates, keep smallest meeting
target within profile). `--json` streams NDJSON per file: input, chosen
format, quality found, score achieved, bytes before/after, skipped-why.
Exit 0 = all met target; 2 = some fell back; reasons in the JSON.

**v2 (only if v1 sees real use):** native-delegation mode (PATH-detected
reference CLIs, same brain), watch mode, config file, manifest-based
idempotency for CI.

## 4. What it costs

With the codec batch landed: v1 is roughly — CLI arg surface + NDJSON
reporting (small), Node decode path (the one real new problem), worker_threads
scheduling reusing bulk-engine semantics (medium), MCP wrapper (small,
mechanical), docs/examples for agents (small). Realistically a 1–2 week
focused track, most of it Codex-executable against a spec, with the decode
path and the format-race policy needing design attention. Without the codec
batch first: add the entire auto-quality engine and ssimulacra2 module to
that bill — which is why sequencing matters.

## 5. Recommendation & sequencing

1. Land the codec batch first (libjxl 0.12 → jpegli → transcode → auto-quality
   — specs all dated 2026-07-11). Each is independently valuable to the web
   app; together they are ~80% of the CLI's engine.
2. Then decide the CLI with a fresh look. If yes (my lean: **yes**), it
   starts with `/deep-design` on exactly two questions — the Node decode path
   and the format-race/profile policy — then a handoff spec; the rest is
   execution.
3. Placeholder package ready at `packages/cli/` — but unscoped `frisp` is
   blocked by npm's similarity filter (`fresh`). Support ticket submitted
   2026-07-11 asking for an exception ("There is a problem with the npm
   registry" category, from tav@artusion.com). When npm replies: if granted,
   `cd packages/cli && npm publish` (expect the web-2FA browser approval);
   if declined, the maintainer picks between `frisp-cli` (unclaimed as of
   2026-07-11) and living without the unscoped name. `@tavlean/frisp` is
   ruled out (maintainer, 2026-07-11).
4. Do NOT restructure the repo preemptively. The workspace split happens in
   the CLI's first PR, not before.

The strategic frame: Frisp-the-app proves the codecs and the intent engine
with real users; Frisp-the-CLI is the same brain with a shell interface
instead of a Svelte one. One engine, two shells — the moment the engine is
real, the CLI is cheap, and *that* is the moat no wrapper-CLI has.
