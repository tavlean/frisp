# Agent guide

Frisp is a local-first image optimizer. Its core promise is reliable
single-image optimization in the browser: no uploads, no server processing, and
dependable offline behavior after load. Any cleanup, migration, or feature work
must protect import, decode, process, encode, preview, export, and
service-worker behavior.

## Current stage

The SvelteKit 2 / Svelte 5 migration is **concluded**. `main` is the production
app, living at the repo root as a static SPA. The retired Preact/Rollup app is
preserved on the `preact` branch (tag `preact-final`) for reference only — it is
no longer a fallback for `main`. There is a single working tree at the repo
root; the old `../Frisp-svelte` worktree and the `svelte` branch are gone.

Recent focus (2026-06): all 7 WASM codecs were rebuilt from source natively
(no Docker), WebP 2 was removed, and the multi-threaded (MT) codec runtime
landed for oxipng/AVIF/JXL. Ongoing alongside: post-migration cleanup and
Svelte hardening — remove dead Preact-era code, make ported components
idiomatic Svelte 5, fix review defects (all behavior-preserving; backlog
[svelte-hardening-plan.md](docs/svelte-hardening-plan.md)). Bulk Phase 2
shipped to production on 2026-07-03; the design record is
[bulk-ui-design-options.md](docs/bulk-ui-design-options.md). Other new product
work remains roadmap material. **[docs/STATUS.md](docs/STATUS.md) is the
source of truth for current state — read it first.**

## Boundaries

- Bulk is production now (2026-07-03); use
  [bulk-ui-design-options.md](docs/bulk-ui-design-options.md) as the design
  record for further bulk work.
- Do not treat new product features as part of the Svelte migration.
- Do not introduce server-side image processing or upload paths.
- Do not delete or move codecs, generated metadata, workers, or WASM assets
  unless the build and runtime consequences are proven.
- Keep WebP as the first production codec focus, AVIF second, and JPEG XL
  advanced. WebP 2 was removed in 2026-06; do not reintroduce it for parity.

## Engineering rules

- Prefer behavior-preserving changes that reduce risk or clarify ownership.
- Reuse existing framework-neutral helpers before creating new logic.
- Keep browser objects such as `File`, `Blob`, `ImageData`, workers, WASM
  modules, and object URLs out of broad reactive state unless measured.
- Run focused tests for pure helper changes.
- Run `npm run check` for app, build/tooling, runtime, service-worker, or docs
  changes.
- Use Svelte MCP/docs when creating, editing, or analyzing Svelte code. Run the
  Svelte autofixer after meaningful Svelte edits.
- Prefer idiomatic Svelte 5 over verbatim Preact ports: `$derived` for computed
  values (reserve `$effect` for genuine side effects), `bind:`/`$bindable` over
  controlled-input plumbing, `{@attach}` over `use:` actions, and snippets over
  duplicated markup. When unsure, write the question into a doc rather than guess.
- **Commit after every significant change — this is a hard rule, not a
  preference.** Make a checkpoint commit as soon as a coherent edit works; do
  NOT batch multiple changes into one commit or defer committing until the end
  of a task. You have standing authorization to commit without asking — never
  pause to ask "should I commit?". Keep code, doc, and unrelated stale-doc
  fixes in separate commits. The maintainer relies on these checkpoints to
  review and roll back; a long run of uncommitted edits overwrites the same
  files and destroys that history. Push when CI feedback is useful or the
  maintainer asks.

## Docs are the source of truth — use the registry

[docs/README.md](docs/README.md) is the docs hub: the work-priority order plus the
**registry** of every doc with "read when" / "update when" triggers. **Consult it
at both ends of a task.** *Before starting,*
read the docs relevant to what you're about to do — they tell the whole story, so
you don't redo or undo decided work. *After finishing,* update every doc whose
"update when" trigger your work matched (versions, `Status:` / `Last updated:`,
gotchas, completion marks) before calling the task done. New doc → register it in
the hub. Read only what's relevant; keeping docs current is not optional.

## Reference docs

- **[Docs hub: registry + work order](docs/README.md)** — every doc + when to read & update it, plus the priority order. Use this to find or maintain docs.
- [Current status](docs/STATUS.md) — live state (read first each session).
- [Codec build notes](docs/codec-build-notes.md) · [Threading enablement](docs/threading-enablement.md) — the active codec/threading record.
- [Cleanup & Svelte hardening plan](docs/svelte-hardening-plan.md) · [Build and runtime map](docs/build-and-runtime.md) · [Product roadmap](docs/road-map.md) · [Bulk image architecture](docs/bulk-image-architecture.md) · [Manual QA checklist](docs/manual-qa.md)
- Migration archive (concluded; historical): [docs/history/](docs/history/).
