Frisp is a privacy-first, fully client-side image optimizer: a maintained modern fork of Squoosh on SvelteKit 3 and Svelte 5, shipped as a static SPA. Start with [docs/README.md](docs/README.md) (the docs index) and [docs/project/brief.md](docs/project/brief.md) (what this is and where it stands). Read the docs related to your task BEFORE working and update the ones you invalidated after; the index routes you, so load only what the task needs.

## Style tie-breakers

Match the surrounding code by default. When the surroundings are mixed or absent and you are unsure which local style to follow, prefer these files:

- [src/lib/editor/editor-session.svelte.ts](src/lib/editor/editor-session.svelte.ts): reactive-state discipline at scale. Comments state constraints the code cannot show, such as why a read is untracked or who owns a URL's lifecycle, and every effect the class creates it also disposes.
- [src/lib/result-cache.ts](src/lib/result-cache.ts): the model for a small class. A header explaining why it exists and its memory model, then quiet code with no comment the code already says.
- [src/lib/bulk/runtime.ts](src/lib/bulk/runtime.ts): the model for delegating to a pure framework-neutral engine faithfully, with the reasoning (per-slot bridges, abort scoping, the rerun latch) attached where it binds.
- [src/lib/editor/intro/Intro.svelte](src/lib/editor/intro/Intro.svelte): component discipline. Every comment is a contract (event routing, a11y with measured ratios, browser quirks with their trigger), and the styles carry their design reasoning.

## Hard rules (every task; all how-to detail lives in docs/)

- Never push. Commit checkpoint-sized changes regularly, straight to `main` unless the change is risky enough to need a branch.
- One source of truth per topic.
- Never introduce server-side image processing or an upload path. Offline must keep working after first load.
- Never delete or move anything under `codecs/`, the codec asset manifest, the workers, or the WASM assets without proving the build AND runtime consequences. A green build is not sufficient; only the e2e suite catches a broken WASM import name.
- Never store live blobs or object URLs in localStorage. The `app:settings:v3` wire format is frozen.
- Never delete lab code that [docs/lab.md](docs/lab.md) marks ongoing or kept-for-reference, and never delete branch `claude/clever-swartz-2b34ed`.
- Never auto-format `*.md`, and never add Markdown to a Prettier or hook glob.
- Merge worktree branches with a fast-forward local merge or `--merge`, never `gh pr merge --rebase`; rebasing strips the maintainer's SSH signatures.
- Before finishing code work: `npm run check` and `npm run test:unit`. After any codec, build, worker, or service-worker change also run `npm run test:e2e`. Add nothing, break nothing (silent traps: [docs/gotchas.md](docs/gotchas.md)).
- No em dashes in anything you write; rewrite the sentence to be simpler instead.
- Note your gotcha discoveries in your final report so the worklog can capture them.

Svelte work: follow `~/.agents/svelte-mcp.md` (how to use the Svelte MCP tools; mandatory autofixer loop).
