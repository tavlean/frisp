# Codec benchmarks

For the browser-pipeline SVG benchmark, see [svg/README.md](svg/README.md).

Measures each WASM codec's **output size** (compression), **encode time** (speed),
and **success** (reliability) on a fixed image, so a codec upgrade can be proven
to be an improvement, not a regression, and so we have real numbers to quote
when writing up "we got X% smaller / Y% faster."

## Run

```sh
npm run bench                         # writes benchmarks/results/current.json
BENCH_LABEL=webp-1.6 npm run bench    # custom label → results/webp-1.6.json
```

It boots the production build (cross-origin isolated) and, for each **image type**
(`photo` 1024×683, `illustration`, `transparent`, five synthetic stressors, and
`photo-large` 12 MP; see `tests/fixtures/`), encodes through each of WebP, AVIF,
JPEG XL, MozJPEG and OxiPNG at the app's default settings. The normal fixtures
take 3 measured runs (records the median); the big 12 MP image takes one (each
encode is slow; it's there to show whether huge inputs behave differently).
Browser PNG/JPEG/GIF and QOI are excluded (native or decode-only).

Multiple types matter: a codec change can help photos but hurt flat
illustrations, break alpha, or behave very differently on huge images; the
report (and `bench:compare`) breaks results out per type so any of those shows up.

### How a run is measured

The editor caches finished encodes in-session, keyed by the exact recipe, so the
same recipe only encodes for real **once per page session**. The harness is
shaped around that, and the shape is load-bearing:

- **Each measured run gets its own page session.** Reloading is the only way to
  empty the cache, so it is the only way a second run measures an encode instead
  of a ~9ms cache hit.
- **The left side warms the codec's WASM module first.** Its persisted options
  carry a bench-only marker key, which changes the cache key and nothing else
  (unknown option keys pass straight through settings-storage and are ignored by
  the codec bindings), so the left side can encode the same image at the same
  cost without consuming the right side's cache entry.
- **The right side is then timed at the app's pristine defaults**, cache-cold and
  module-warm. `medianMs` is that number; `coldMs` is the left side's warm-up,
  i.e. the same encode with the module still to load.

`photo-large` is the exception: it skips the warm-up (so its `coldMs` is 0 and
its `medianMs` includes module load) because three live 12 MP results do not fit
the editor's result-cache budget. The reasoning is in the `FIXTURES` comment.

The run also fails if a codec reports **different output sizes across runs**:
sizes are supposed to be bit-exact, so a mismatch means something upstream is
nondeterministic and no number in the report can be trusted until it is
explained.

## Compare (before vs after an upgrade)

```sh
# 1. Before touching a codec, capture the baseline (already committed):
#    benchmarks/baseline.json
# 2. After rebuilding the codec:
npm run bench
# 3. Diff:
npm run bench:compare
#    (defaults to baseline.json vs results/current.json)
#    or: node benchmarks/compare.mjs <before.json> <after.json>
```

`bench:compare` prints a per-codec size Δ / time Δ table, marks each ✓ better /
✗ WORSE / ≈, and **exits non-zero if a codec got bigger or started failing**,
so it can gate a codec upgrade in CI.

**Timing is printed but does not gate.** Two back-to-back runs on the same
machine with no code change between them drifted +10% to +60% per codec purely
on machine state, so a timing gate fires on noise rather than on regressions.
Anything more than 25% slower is called out loudly at the end of the table for a
human to judge; re-run on a quiet machine before believing it.

## Files

- `baseline.json`: committed reference (the current codecs). **Re-capture and
  commit this after a confirmed-good upgrade** so it tracks the shipped state,
  and record here when and at which commit, because a stale baseline is worse
  than none: it reads as a codec regression long after the real cause (a changed
  default, a codec rebuild) has been forgotten. Current baseline captured
  **2026-11-04 at commit `e86298cb`** (the worker-side pipeline, review change
  B), on a Mac reporting 11 logical cores, with the cache-cold methodology
  described above. It is the first capture with WebP back at method 4
  (`555def1c`) and with jpegli as the one JPEG, so MozJPEG has no rows. It
  replaced a 2026-08-09 capture (commit `c788155f`) whose WebP rows were made at
  method 6 and read as a WebP size regression of up to 3 percent against today's
  default. Every size matched a same-day run at `b437df36`, before the change.
- `results/`: per-run reports (gitignored).
- Fixtures live in `tests/fixtures/` (shared with the e2e suite); see
  `tests/fixtures/README.md`. Swap `photo.jpg` / `photo-large.jpg` for your own
  images for article-quality numbers; re-capture the baseline if you do.

## Caveats

- **Size is exact and repeatable on one machine**: the primary "compresses
  better?" signal. It is not, however, machine-independent: **AVIF sizes depend
  on the core count**, because `avif_enc.cpp` sets `maxThreads` from
  `emscripten_num_logical_cores()` and libaom's multi-threaded encode partitions
  the frame differently per thread count. Every other codec here reproduced to
  the byte across the same threading change, JPEG XL included. Compare AVIF sizes
  only against a baseline captured on the same machine.
- **Time is machine-dependent** (and excludes the ~100ms option debounce, since
  it measures the editor's encode window). Only compare reports captured on the
  **same machine**; `bench:compare` warns if core counts differ.
- This measures size at the codec's **default settings**. A smaller file at the
  same settings is usually a real win, but a big drop can also mean lower default
  quality; for headline claims, sanity-check quality visually (or add a
  perceptual metric like SSIMULACRA2 later).
- Multithreading is wired (see `docs/threading-enablement.md`); AVIF, JPEG XL,
  and OxiPNG encode multi-core, so the baseline already reflects threaded
  encodes. Re-baseline (on the same machine) after any further threading change,
  since threaded encodes shift the speed numbers substantially.
