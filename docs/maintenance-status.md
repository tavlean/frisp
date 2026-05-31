# Maintenance status

Last updated: 2026-05-26.

## Resume handoff

Current stable branch: `main`.

Prototype evidence branch: `code/sveltekit-prototype`.

Current SvelteKit migration-seams review branch:
`code/sveltekit-migration-seams`.

Standalone GitHub repo: `tavlean/sqush`.

Default branch: `main`.

Project homepage metadata: `https://sqush.app`.

Historical archived fork, not the current project: `tavlean/SquooshPlus`.

Project identity note: see [Project identity](project-identity.md). The current app/repo/package name is Sqush. The local checkout has been renamed to `/Users/tav/Development/Tavlean/Sqush`. Any remaining `SquooshPlus` references should be historical fork references or temporary tool compatibility paths.

Current local checkout: `/Users/tav/Development/Tavlean/Sqush`.

For SvelteKit prototype evidence, read
`docs/sveltekit-prototype-handoff.md`. For the current reusable seam review,
start from `code/sveltekit-migration-seams` and read
`docs/sveltekit-migration-seams-review.md` plus
`docs/sveltekit-migration-seams-exit-audit.md`.

Codec roadmap note: focus WebP first, AVIF second, and JPEG XL as the advanced
codec. WebP 2 is now kept as experimental parity in the SvelteKit editor so the
migration does not silently drop an inherited format. Any future WebP 2
promotion, hiding, or removal should be a separate evidence-based cleanup
decision after the focused codec surface is stable.

Working tree at last update: `code/sveltekit-migration-seams` packages the
SvelteKit prototype findings into reusable seams while keeping the current
Preact app shell intact. Proven shared seams include generated UI-free feature
metadata entrypoints, shared image-pipeline helpers, the production
`imagePipeline` bundle, structural worker-bridge boundaries, service-worker
registration/cache-planning seams, canonical codec asset record helpers,
generated active worker/cache metadata, and prototype evidence for
`processBulkImageJob` plus `runCompressionUpdateWorkflow` through SvelteKit
worker bridges. The branch also records source-safe merge slices in
`docs/sveltekit-migration-seams-review.md` and a roadmap-level exit audit in
`docs/sveltekit-migration-seams-exit-audit.md`. Root `npm run check` and the
prototype gates have passed on the latest meaningful checkpoints. PR #1 is
clean against `main`, and GitHub Actions passed on Ubuntu, Windows, and macOS
for the latest migration-seams head. Run `git status --short --branch` for the
exact state.

Latest recent committed work at last update:

- Current local work: merged latest `main` into `code/sveltekit-migration-seams`
  and restored green PR CI
- `a6865c9` Merge main into migration seams
- `1cd4caf` Sync migration seams status docs
- `a4832a1` Audit migration seams exit status
- `a82949b` Guard production image pipeline bundle
- `93fd5a3` Share production image pipeline bundle
- `7479e0a` Probe compression update workflow in SvelteKit
- `82e2ffa` Validate codec asset manifest audit
- `ec65e69` Share codec asset manifest helpers
- `1dc1cbd` Package migration seams review slices
- `a64d27b` Deprioritize WebP 2 across roadmap
- `b4c17c0` Extract initial app startup workflow
- `a450c50` Extract result render state
- `e6f048a` Extract compression render state
- `bb45769` Extract output render state
- `9c6931c` Update handoff after workflow CI
- `598b0c1` Extract update workflow
- `616acb5` Document verification workflow
- `db9fdb1` Extract options workflow
- `82c65eb` Extract output workflow
- `72efb0a` Extract result loading workflow
- `fcbc5e8` Extract editor update workflow
- `06f25f9` Extract side workflow
- `afbe11e` Extract editor cleanup workflow
- `c6031ca` Extract image update queue
- `e7bdbeb` Extract source workflow
- `b5c404f` Extract side copy workflow
- `2542c6c` Extract saved settings workflow
- `a885e92` Extract side job loop runner
- `1e6f061` Extract work start runner
- `3e48b5e` Extract source job runner
- `885306b` Sync bulk architecture handoff
- `2229b9e` Extract side job runner
- `9b2192e` Document codec source references
- `0f252c1` Harden runnable side job records
- `72ef7ba` Extract runnable side job records
- `14634b2` Document codec build metadata
- `c6dbb63` Sync Svelte migration handoff
- `72ed1c8` Extract output retarget focus state
- `d5012d3` Extract output update planning
- `1592d7e` Extract range display formatting
- `6c5b35a` Extract initial app open state
- `c8fbba6` Extract result initial loading state
- `81ff9f5` Extract output initial controls
- `832d746` Extract result loading visibility state
- `373b6fa` Extract options load state
- `150b4f5` Extract range input state
- `13af7b9` Extract option expander state
- `e0689b4` Convert stateless option controls
- `66320f7` Extract initial app entry state
- `1171174` Retry browser smoke preview startup
- `a816003` Extract active job completion state
- `3fe738d` Extract side copy import state
- `5041a6f` Extract source decode success state
- `b4e7bbd` Extract output control interactions
- `469cbcc` Extract side job state patches
- `677f442` Extract side settings state patches
- `12eadfa` Extract initial editor state
- `0a4abb4` Extract source lifecycle state
- `b4b023d` Extract viewport state
- `abc8cdd` Extract editor update scheduling options
- `0203b66` Extract side job run selection
- `7fcc841` Extract saved settings availability updates
- `f8f8840` Extract image update scheduling
- `86e1295` Extract processor control transitions
- `2b98ba3` Extract output control state
- `47ee8d7` Extract resize preset state
- `1eaf210` Extract active image job bookkeeping
- `02845f2` Extract side job result assembly
- `ee99125` Extract side job execution planning
- `36e83f7` Extract work abort planning
- `92e0a42` Extract output draw state
- `e147331` Extract options render state
- `787d8e1` Extract compression panel layout state
- `5a8d377` Extract output preview state
- `71560b5` Extract result download state
- `8c82cd1` Extract result loading state
- `399d7ce` Extract result size state
- `6af3473` Extract processor control state
- `f5577e9` Extract encoder select state
- `2b73dba` Extract processing error messages
- `763ac46` Extract side copy feedback action
- `c1ede5a` Extract saved settings feedback actions
- `70d9d89` Extract compression render state
- `bd5e2da` Normalize bulk add counters
- `4974517` Share bulk status list
- `0de39c6` Share bulk queued reset behavior
- `3d1cbec` Share bulk export predicates
- `4416a56` Extract saved settings actions
- `b460e48` Extract initial side states
- `03b0a0d` Share bulk active status checks
- `f284a94` Share bulk import result recording
- `927870a` Extract saved settings availability
- `97c3146` Extract encoder support filtering
- `c00eb28` Extract editor update effects
- `e973a9d` Replace editor prop lifecycle
- `3ecb1e2` Reuse bulk queue counter deltas
- `3706601` Share bulk queue counter deltas
- `ca0e2b0` Share abort error checks
- `8b4f578` Extract side encode planning
- `af3743d` Extract image work start scheduling
- `bbaca5d` Extract image work planner
- `62a49c4` Extract saved settings payload helper
- `e5f7686` Extract editor display selectors
- `b9ce004` Extract preprocessor change state
- `b98f4c0` Document dependency drift
- `974ea79` Limit redundant CI runs
- `abd74e7` Tighten service worker utility types
- `f890ea1` Automate production browser smoke
- `7243559` Summarize bulk job sizes
- `6f007fe` Add bulk job settings lookup
- `08cb06a` Add bulk selected job context
- `6608e75` Add bulk action selectors
- `281521b` Update handoff after status grouping
- `662808c` Group bulk job statuses
- `0f9b001` Update handoff after selection navigation
- `04488dd` Add bulk selection navigation
- `9e3d2a6` Update handoff after override summary
- `1fdf5eb` Summarize bulk overrides
- `1e2ead6` Update handoff after percent cleanup
- `6345b2d` Share bulk percent change calculation
- `4df5cd0` Update handoff after bulk counter cleanup
- `e4e3c1d` Update bulk counters when adding jobs
- `16a36f3` Normalize empty bulk overrides
- `dc94c12` Summarize bulk optimized output
- `48746ca` Clear stale output on bulk retry
- `aa59341` Normalize bulk queue concurrency
- `995c9b2` Document WebP smoke coverage
- `63adddf` Update handoff after failure cleanup
- `09d0f7b` Clear stale output on bulk failure
- `ffc9138` Update handoff after queue hardening
- `1090c84` Keep exported count stable on completion
- `93519a2` Update handoff after CI recovery
- `7c2c39e` Reject null saved encoder options
- `9d7ac14` Update handoff after abort cleanup
- `ef12543` Clean up abortable listeners
- `0bbe31a` Update handoff after smoke coverage
- `64e7600` Verify service worker build assets
- `1959482` Derive counters for restored bulk sessions
- `82eb7b6` Reserve generated bulk export names
- `1fc97c3` Refresh static render dependency
- `eed9cb2` Sanitize bulk export archive names
- `2666f83` Guard bulk runner aborts before processing
- `df147a6` Deduplicate bulk object URL cleanup
- `0c06bbe` Type encoder options rendering
- `7971432` Type core encoder dispatch
- `2732488` Use Preact constructor type for quality options
- `557d935` Tighten worker bridge dispatch types
- `27fb26a` Tighten clean modify types
- `03edd81` Tighten shallowEqual types
- `0dd042d` Keep bulk exported counts consistent
- `28a16e2` Document Playwright CLI smoke flow
- `a69317c` Define browser support baseline
- `fbaf1ae` Validate saved processor settings
- `df5f370` Validate saved encoder options
- `f20c721` Harden bulk export filenames
- `ae8e4c0` Update handoff after import fallback
- `d7e19d4` Accept more extension-only image imports
- `3a78229` Guard build against external runtime assets
- `b4b45ef` Clarify optimizer reliability mission

Latest verification run:

- Svelte MCP docs checked on 2026-05-25 for project types, static adapter, service workers, and Svelte 5 runes while deciding whether a small technical prototype is now appropriate.
- `npm outdated --json`: confirmed the largest remaining maintenance risk is the old build/tooling stack, including Rollup 2, older Rollup plugins, TypeScript 4.9, and older Preact-era dependencies.
- `npm run test:helpers`: passed after extracting the initial app startup workflow.
- `npm run check`: passed after extracting the initial app startup workflow and updating helper coverage.
- `npm run smoke:browser`: passed after extracting the initial app startup workflow; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `gh run list --repo tavlean/sqush --branch main --limit 5`: latest pushed CI run `26378286324` completed successfully for `e6f048a`.
- `npm run check`: passed after extracting result render-state composition and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting result render-state composition; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: passed after extracting result render-state composition and updating dashboard/docs.
- `npm run check`: passed after extracting the update workflow coordinator, adding no-work helper coverage, and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting the update workflow coordinator; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows update workflow helper, five top cards, and no stale top-card deltas.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26377994493` completed successfully for `598b0c1`.
- `gh run list --repo tavlean/sqush --branch main --limit 5`: latest pushed CI run `26377765152` completed successfully for `616acb5`.
- `npm run check`: passed after refreshing README local-first verification guidance and dashboard/docs.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows README verification docs, five top cards, and only the Documentation `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 5`: latest pushed CI run `26377593784` completed successfully for `82c65eb`.
- `npm run test:helpers`: passed after extracting options async load/listener workflow.
- `npm run check`: passed after extracting options async load/listener workflow and updating dashboard/docs.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows options workflow, five top cards, and only the Svelte `+1` top-card delta.
- `npm run test:helpers`: passed after extracting output mount/update workflow.
- `npm run check`: passed after extracting output mount/update workflow and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting output mount/update workflow; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows output workflow, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26377344412` completed successfully for `fcbc5e8`.
- `npm run test:helpers`: passed after extracting result loading timer workflow.
- `npm run check`: passed after extracting result loading timer workflow and updating dashboard/docs.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows result loading workflow, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 5`: latest pushed CI run `26377109562` completed successfully for `06f25f9`.
- `npm run test:helpers`: passed after extracting editor update workflow orchestration.
- `npm run check`: passed after extracting editor update workflow orchestration.
- `npm run smoke:browser`: passed after extracting editor update workflow orchestration; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows editor update workflow, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26376944247` completed successfully for `afbe11e`.
- `npm run test:helpers`: passed after extracting side image workflow orchestration.
- `npm run check`: passed after extracting side image workflow orchestration and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting side image workflow orchestration; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side workflow, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26376811905` completed successfully for `c6031ca`.
- `npm run test:helpers`: passed after extracting editor cleanup runtime orchestration.
- `npm run check`: passed after extracting editor cleanup runtime orchestration and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting editor cleanup runtime orchestration; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows editor cleanup, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26376678137` completed successfully for `e7bdbeb`.
- `npm run test:helpers`: passed after extracting image update debounce/runtime scheduling into a framework-neutral helper.
- `npm run check`: passed after extracting image update debounce/runtime scheduling and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting image update debounce/runtime scheduling; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows update queue, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 5`: latest pushed CI run `26376496241` completed successfully for `b5c404f`.
- `npm run check`: passed after extracting source workflow orchestration and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting source workflow orchestration; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows source workflow, five top cards, and only the Svelte `+1` top-card delta.
- `npm run test:helpers`: passed after extracting initial app editor-open state.
- `npm run typecheck`: passed after extracting initial app editor-open state.
- `npm run check`: passed after extracting initial app editor-open state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting initial app editor-open state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows initial app open state, five top cards, and only Repo/Svelte `+1` deltas.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26374439011` completed successfully for `6c5b35a` after pushing the accumulated local batch.
- `npm run typecheck`: passed after adding app-shell listener cleanup.
- `npm run check`: passed after adding app-shell listener cleanup and updating dashboard/docs.
- `npm run smoke:browser`: passed after adding app-shell listener cleanup; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows app shell listener cleanup, five top cards, and no stale top-card deltas.
- `npm run typecheck`: passed after adding app-shell async guards.
- `npm run check`: passed after adding app-shell async guards and updating dashboard/docs.
- `npm run smoke:browser`: passed after adding app-shell async guards; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows app shell async guards, five top cards, and no stale top-card deltas.
- `npm run typecheck`: passed after adding editor async undo guards.
- `npm run check`: passed after adding editor async undo guards and updating dashboard/docs.
- `npm run smoke:browser`: passed after adding editor async undo guards; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows editor async undo guards, five top cards, and no stale top-card deltas.
- `npm run typecheck`: passed after adding editor async error guards.
- `npm run check`: passed after adding editor async error guards and updating dashboard/docs.
- `npm run smoke:browser`: passed after adding editor async error guards; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows editor error async guards, five top cards, and no stale top-card deltas.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26374750959` completed successfully for `980e87f`.
- `npm run typecheck`: passed after tightening the file-drop custom element handler type.
- `npm run check`: passed after tightening the file-drop custom element handler type and updating dashboard/docs.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows file-drop handler type, five top cards, and no stale top-card deltas.
- `npm run check`: passed after adding worker bridge disposal cleanup and updating dashboard/docs.
- `npm run smoke:browser`: passed after adding worker bridge disposal cleanup; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows worker bridge dispose cleanup, five top cards, and no stale top-card deltas.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26374912708` completed successfully for `5ef6bd7`.
- `npm run test:helpers`: passed after extracting expander transition completion state.
- `npm run typecheck`: passed after adding the expander transition unmount guard.
- `npm run check`: passed after adding expander transition cleanup and updating dashboard/docs.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows expander transition cleanup, five top cards, and no stale top-card deltas.
- `npm run typecheck`: passed after adding custom element observer cleanup.
- `npm run check`: passed after adding custom element observer cleanup and updating dashboard/docs.
- `npm run smoke:browser`: passed after adding custom element observer cleanup; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows custom element observer cleanup, five top cards, and no stale top-card deltas.
- `npm run typecheck`: passed after adding custom element listener and animation-frame cleanup.
- `npm run check`: passed after adding custom element listener cleanup and updating dashboard/docs.
- `npm run smoke:browser`: passed after adding custom element listener cleanup; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows custom element listener cleanup, five top cards, and no stale top-card deltas.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26375095128` completed successfully for `d972760`.
- `npm run test:helpers`: passed after extracting range display formatting helpers.
- `npm run typecheck`: passed after moving range thumb-label formatting into tested helper logic.
- `npm run check`: passed after extracting range display helpers and updating dashboard/docs.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows range display helper, five top cards, and no stale top-card deltas.
- `npm run test:helpers`: passed after extracting output update-plan decisions.
- `npm run typecheck`: passed after moving output update-plan decisions into tested helper logic.
- `npm run check`: passed after extracting output update-plan decisions and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting output update-plan decisions; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows output update plan helper, five top cards, and no stale top-card deltas.
- `npm run test:helpers`: passed after extracting output retarget focus decisions.
- `npm run typecheck`: passed after moving output retarget focus decisions into tested helper logic.
- `npm run check`: passed after extracting output retarget focus decisions and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting output retarget focus decisions; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows output retarget focus helper, five top cards, and no stale top-card deltas.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows Svelte context sync, five top cards, and no stale top-card deltas.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows codec provenance metadata, five top cards, and no stale top-card deltas.
- `npm run test:helpers`: passed after extracting runnable side job records.
- `npm run check`: passed after extracting runnable side job records and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting runnable side job records; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side job run records, five top cards, and only the Svelte `+1` top-card delta.
- `npm run test:helpers`: passed after hardening runnable side job records for missing job-state entries.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows runnable job hardening, five top cards, and no stale top-card deltas.
- `gh run list --repo tavlean/sqush --branch main --limit 1`: latest pushed CI run `26375595677` completed successfully for `72ef7ba`.
- `npm run format:check`: passed after documenting local codec source references.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows codec source references, five top cards, and only the Documentation `+1` top-card delta.
- `npm run test:helpers`: passed after extracting single-image side job execution into a framework-neutral runner.
- `npm run check`: passed after extracting single-image side job execution into a framework-neutral runner and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting single-image side job execution; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side job runner helper, five top cards, and only the Svelte `+1` top-card delta.
- `npm run format:check`: passed after syncing the bulk architecture note with the side-job runner extraction.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows bulk architecture sync, five top cards, and no stale top-card deltas.
- `gh run list --repo tavlean/sqush --branch main --limit 1`: latest pushed CI run `26375807878` completed successfully for `2229b9e`.
- `npm run test:helpers`: passed after extracting source decode/preprocess execution into a framework-neutral runner.
- `npm run check`: passed after extracting source decode/preprocess execution into a framework-neutral runner and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting source decode/preprocess execution; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows source job runner helper, five top cards, and only the Svelte `+1` top-card delta.
- `npm run test:helpers`: passed after extracting work-start abort/controller cycling into a framework-neutral runner.
- `npm run check`: passed after extracting work-start abort/controller cycling into a framework-neutral runner and tightening the controller tuple type.
- `npm run smoke:browser`: passed after extracting work-start abort/controller cycling; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows work start runner helper, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 5`: latest pushed CI run `26376109158` completed successfully for `1e6f061`.
- `npm run test:helpers`: passed after moving runnable side-job loop orchestration into the side-job runner.
- `npm run check`: passed after moving runnable side-job loop orchestration into the side-job runner and updating dashboard/docs.
- `npm run smoke:browser`: passed after moving runnable side-job loop orchestration; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side job loop runner, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26376241687` completed successfully for `a885e92`.
- `npm run test:helpers`: passed after extracting saved-settings save/import workflows.
- `npm run check`: passed after extracting saved-settings save/import workflows and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting saved-settings save/import workflows; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows saved settings workflow, five top cards, and only the Svelte `+1` top-card delta.
- `gh run list --repo tavlean/sqush --branch main --limit 3`: latest pushed CI run `26376381672` completed successfully for `2542c6c`.
- `npm run test:helpers`: passed after extracting copy-to-other-side workflow and undo orchestration.
- `npm run check`: passed after extracting copy-to-other-side workflow and undo orchestration.
- `npm run smoke:browser`: passed after extracting copy-to-other-side workflow; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side copy workflow, five top cards, and only the Svelte `+1` top-card delta.
- `npm run test:helpers`: passed after extracting result initial loading state.
- `npm run typecheck`: passed after extracting result initial loading state.
- `npm run check`: passed after extracting result initial loading state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting result initial loading state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows result initial loading state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting output initial control state.
- `npm run typecheck`: passed after extracting output initial control state.
- `npm run check`: passed after extracting output initial control state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting output initial control state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows output initial controls, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting result loading visibility state.
- `npm run typecheck`: passed after extracting result loading visibility state.
- `npm run check`: passed after extracting result loading visibility state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting result loading visibility state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows result loading cleanup, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting options initial/load state.
- `npm run typecheck`: passed after extracting options initial/load state.
- `npm run check`: passed after extracting options initial/load state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting options initial/load state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows options state load, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting range input state.
- `npm run typecheck`: passed after extracting range input state.
- `npm run check`: passed after extracting range input state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting range input state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows range input state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting option expander derived state.
- `npm run typecheck`: passed after extracting option expander derived state.
- `npm run check`: passed after extracting option expander derived state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting option expander derived state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows expander derived state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run typecheck`: passed after converting stateless option controls from empty-state classes to function components.
- `npm run check`: passed after converting stateless option controls from empty-state classes to function components and updating dashboard/docs.
- `npm run smoke:browser`: passed after converting stateless option controls; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows stateless option controls, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting initial app entry state.
- `npm run typecheck`: passed after extracting initial app entry state.
- `npm run smoke:browser`: passed after extracting initial app entry state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run check`: passed after extracting initial app entry state and updating dashboard/docs.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows initial app entry state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run check`: passed after adding browser-smoke preview-port retry handling.
- `npm run smoke:browser`: passed after adding browser-smoke preview-port retry handling; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting active job completion state.
- `npm run typecheck`: passed after extracting active job completion state.
- `npm run check`: passed after extracting active job completion state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting active job completion state on rerun; the first attempt failed before app testing because the preview server hit a transient `EADDRINUSE` port bind. Production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows active job completion state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting side copy/import state patches.
- `npm run typecheck`: passed after extracting side copy/import state patches.
- `npm run check`: passed after extracting side copy/import state patches and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting side copy/import state patches; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side copy import state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run check`: passed after extracting source decode success state.
- `npm run smoke:browser`: passed after extracting source decode success state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows source decode success state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run check`: passed after extracting output control interaction helpers.
- `npm run smoke:browser`: passed after extracting output control interaction helpers; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting side job state patches.
- `npm run typecheck`: passed after extracting side job state patches.
- `npm run check`: passed after extracting side job state patches and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting side job state patches; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side job state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting side settings state patches.
- `npm run typecheck`: passed after extracting side settings state patches.
- `npm run check`: passed after extracting side settings state patches and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting side settings state patches; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side settings state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting initial editor state.
- `npm run typecheck`: passed after extracting initial editor state.
- `npm run check`: passed after extracting initial editor state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting initial editor state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows initial editor state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting source decode/preprocess loading lifecycle state.
- `npm run typecheck`: passed after extracting source decode/preprocess loading lifecycle state.
- `npm run check`: passed after extracting source decode/preprocess loading lifecycle state and updating dashboard/docs.
- `npm run smoke:browser`: passed after extracting source decode/preprocess loading lifecycle state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows source lifecycle state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting viewport state.
- `npm run typecheck`: passed after extracting viewport state.
- `npm run check`: passed after extracting viewport state.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows viewport state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting editor update scheduling options.
- `npm run typecheck`: passed after extracting editor update scheduling options.
- `npm run check`: passed after extracting editor update scheduling options.
- `npm run smoke:browser`: passed after extracting editor update scheduling options; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows editor update scheduling options, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting side job run selection.
- `npm run typecheck`: passed after extracting side job run selection.
- `npm run smoke:browser`: passed after extracting side job run selection; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run check`: passed after extracting side job run selection.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows side job run selection, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting saved-settings availability updates.
- `npm run typecheck`: passed after extracting saved-settings availability updates.
- `npm run smoke:browser`: passed after extracting saved-settings availability updates; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run check`: passed after extracting saved-settings availability updates.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows saved-settings availability updates, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting image update scheduling.
- `npm run typecheck`: passed after extracting image update scheduling.
- `npm run check`: passed after extracting image update scheduling.
- `npm run smoke:browser`: passed after extracting image update scheduling; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows image update scheduling, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting processor control transitions.
- `npm run typecheck`: passed after extracting processor control transitions.
- `npm run check`: passed after extracting processor control transitions.
- `npm run smoke:browser`: passed after extracting processor control transitions; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows processor control transitions, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting output control state.
- `npm run typecheck`: passed after extracting output control state.
- `npm run check`: passed after extracting output control state.
- `npm run smoke:browser`: passed after extracting output control state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting resize preset state and removing the remaining deprecated prop-change lifecycle.
- `npm run typecheck`: passed after extracting resize preset state and removing the remaining deprecated prop-change lifecycle.
- `npm run check`: passed after extracting resize preset state and removing the remaining deprecated prop-change lifecycle.
- `npm run smoke:browser`: passed after extracting resize preset state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting active job bookkeeping.
- `npm run typecheck`: passed after extracting active job bookkeeping.
- `npm run check`: passed after extracting active job bookkeeping.
- `npm run smoke:browser`: passed after extracting active job bookkeeping; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting side result/cache assembly.
- `npm run typecheck`: passed after extracting side result/cache assembly.
- `npm run check`: passed after extracting side result/cache assembly.
- `npm run smoke:browser`: passed after extracting side result/cache assembly; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting side job execution planning.
- `npm run typecheck`: passed after extracting side job execution planning.
- `npm run check`: passed after extracting side job execution planning.
- `npm run smoke:browser`: passed after extracting side job execution planning; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting work abort planning.
- `npm run typecheck`: passed after extracting work abort planning.
- `npm run check`: passed after extracting work abort planning.
- `npm run smoke:browser`: passed after extracting work abort planning; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting output draw state.
- `npm run typecheck`: passed after extracting output draw state.
- `npm run check`: passed after extracting output draw state.
- `npm run smoke:browser`: passed after extracting output draw state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting options render state.
- `npm run typecheck`: passed after extracting options render state.
- `npm run check`: passed after extracting options render state.
- `npm run smoke:browser`: passed after extracting options render state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting panel layout state.
- `npm run typecheck`: passed after extracting panel layout state.
- `npm run check`: passed after extracting panel layout state.
- `npm run smoke:browser`: passed after extracting panel layout state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting output preview state.
- `npm run typecheck`: passed after extracting output preview state.
- `npm run check`: passed after extracting output preview state.
- `npm run smoke:browser`: passed after extracting output preview state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.

- `npm run test:helpers`: passed after extracting result download state.
- `npm run typecheck`: passed after extracting result download state.
- `npm run check`: passed after extracting result download state.
- `npm run smoke:browser`: passed after extracting result download state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows result download state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting result loading effects.
- `npm run typecheck`: passed after extracting result loading effects.
- `npm run check`: passed after extracting result loading effects.
- `npm run smoke:browser`: passed after extracting result loading effects; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows result loading state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting result size display state.
- `npm run typecheck`: passed after extracting result size display state.
- `npm run check`: passed after extracting result size display state.
- `npm run smoke:browser`: passed after extracting result size display state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows result size state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting processor control state.
- `npm run typecheck`: passed after extracting processor control state.
- `npm run check`: passed after extracting processor control state.
- `npm run smoke:browser`: passed after extracting processor control state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows processor control state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting encoder select state.
- `npm run typecheck`: passed after extracting encoder select state.
- `npm run check`: passed after extracting encoder select state.
- `npm run smoke:browser`: passed after extracting encoder select state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run dashboard`: confirmed the dashboard is already running at `http://localhost:4177`; local dashboard HTML shows encoder select state, five top cards, and only Repo/Svelte `+1` deltas.
- `npm run test:helpers`: passed after extracting image processing error messages.
- `npm run typecheck`: passed after extracting image processing error messages.
- `npm run check`: passed after extracting image processing error messages.
- `npm run smoke:browser`: passed after extracting image processing error messages; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting side-copy feedback action data.
- `npm run typecheck`: passed after extracting side-copy feedback action data.
- `npm run check`: passed after extracting side-copy feedback action data.
- `npm run smoke:browser`: passed after extracting side-copy feedback action data; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting saved-settings feedback actions.
- `npm run typecheck`: passed after extracting saved-settings feedback actions.
- `npm run check`: passed after extracting saved-settings feedback actions.
- `npm run smoke:browser`: passed after extracting saved-settings feedback actions; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting composed single-image render state.
- `npm run typecheck`: passed after extracting composed single-image render state.
- `npm run check`: passed after extracting composed single-image render state.
- `npm run smoke:browser`: passed after extracting composed single-image render state; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after making bulk add-job counters drift-tolerant.
- `npm run typecheck`: passed after making bulk add-job counters drift-tolerant.
- `npm run check`: passed after making bulk add-job counters drift-tolerant.
- `npm run test:helpers`: passed after sharing the canonical bulk status list with snapshot validation.
- `npm run typecheck`: passed after sharing the canonical bulk status list with snapshot validation.
- `npm run check`: passed after sharing the canonical bulk status list with snapshot validation.
- `npm run test:helpers`: passed after sharing bulk queued reset behavior.
- `npm run typecheck`: passed after sharing bulk queued reset behavior.
- `npm run check`: passed after sharing bulk queued reset behavior.
- `npm run test:helpers`: passed after sharing bulk export predicates.
- `npm run typecheck`: passed after sharing bulk export predicates.
- `npm run check`: passed after sharing bulk export predicates.
- `npm run test:helpers`: passed after extracting saved-settings action helpers.
- `npm run typecheck`: passed after extracting saved-settings action helpers.
- `npm run check`: passed after extracting saved-settings action helpers.
- `npm run smoke:browser`: passed after extracting saved-settings action helpers; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting initial side-state setup.
- `npm run typecheck`: passed after extracting initial side-state setup.
- `npm run check`: passed after extracting initial side-state setup.
- `npm run smoke:browser`: passed after extracting initial side-state setup; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting saved-settings availability.
- `npm run typecheck`: passed after extracting saved-settings availability.
- `npm run check`: passed after extracting saved-settings availability.
- `npm run smoke:browser`: passed after extracting saved-settings availability.
- `npm run format:check`: passed after extracting saved-settings availability.
- `npm run test:helpers`: passed after extracting supported encoder filtering.
- `npm run typecheck`: passed after extracting supported encoder filtering.
- `npm run check`: passed after extracting supported encoder filtering.
- `npm run smoke:browser`: passed after extracting supported encoder filtering.
- `npm run format:check`: passed after extracting supported encoder filtering.
- `npm run test:helpers`: passed after extracting editor update effects.
- `npm run typecheck`: passed after extracting editor update effects.
- `npm run check`: passed after extracting editor update effects.
- `npm run smoke:browser`: passed after extracting editor update effects.
- `npm run format:check`: passed after extracting editor update effects.
- `npm run test:helpers`: passed after replacing the main editor's deprecated prop-change lifecycle.
- `npm run typecheck`: passed after replacing the main editor's deprecated prop-change lifecycle.
- `npm run check`: passed after replacing the main editor's deprecated prop-change lifecycle.
- `npm run smoke:browser`: passed after replacing the main editor's deprecated prop-change lifecycle.
- `npm run format:check`: passed after replacing the main editor's deprecated prop-change lifecycle.
- `npm run test:helpers`: passed after reusing bulk counter deltas in batch queue transitions.
- `npm run typecheck`: passed after reusing bulk counter deltas in batch queue transitions.
- `npm run check`: passed after reusing bulk counter deltas in batch queue transitions.
- `npm run format:check`: passed after reusing bulk counter deltas in batch queue transitions.
- `npm run test:helpers`: passed after sharing bulk queue counter deltas.
- `npm run typecheck`: passed after sharing bulk queue counter deltas.
- `npm run format:check`: passed after sharing bulk queue counter deltas.
- `npm run check`: passed after sharing bulk queue counter deltas.
- `npm run test:helpers`: passed after extracting planned image work assembly.
- `npm run typecheck`: passed after extracting planned image work assembly.
- `npm run check`: passed after extracting planned image work assembly.
- `npm run smoke:browser`: passed after extracting planned image work assembly; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting work-start scheduling.
- `npm run typecheck`: passed after extracting work-start scheduling.
- `npm run check`: passed after extracting work-start scheduling.
- `npm run smoke:browser`: passed after extracting work-start scheduling; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting side encode planning.
- `npm run typecheck`: passed after extracting side encode planning.
- `npm run check`: passed after extracting side encode planning.
- `npm run smoke:browser`: passed after extracting side encode planning; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after sharing abort-error checks.
- `npm run typecheck`: passed after sharing abort-error checks.
- `npm run check`: passed after sharing abort-error checks.
- `npm run smoke:browser`: passed after sharing abort-error checks; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run test:helpers`: passed after extracting saved-settings payload construction.
- `npm run typecheck`: passed after extracting saved-settings payload construction.
- `npm run check`: passed after extracting saved-settings payload construction.
- `npm run smoke:browser`: passed after extracting saved-settings payload construction; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, reloads the app shell offline, and loads with service worker disabled.
- `npm run format:check`: passed after saved-settings payload extraction and dashboard/doc updates.
- `npm run dashboard`: confirmed existing dashboard server detection still exits cleanly with `Dashboard already running: http://localhost:4177`.
- `npm run test:helpers`: passed after extracting render display selectors for output/result props.
- `npm run typecheck`: passed after extracting render display selectors for output/result props.
- `npm run check`: passed after extracting render display selectors for output/result props.
- `npm run smoke:browser`: passed after extracting render display selectors; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, and reloads the app shell offline.
- `npm run test:helpers`: passed after extracting preprocessor-change state updates.
- `npm run typecheck`: passed after extracting preprocessor-change state updates.
- `npm run check`: passed after extracting preprocessor-change state updates.
- `npm run smoke:browser`: passed after extracting preprocessor-change state updates; production build still imports PNG, exports WebP, resizes WebP to `64px`, imports saved side settings, handles extensionless input naming, and reloads the app shell offline.
- `npm run dashboard`: now exits cleanly with `Dashboard already running: http://localhost:4177` when the existing dashboard server owns the port.
- `npm run typecheck`: passed after moving the project baseline to Node 24 with `@types/node@22.9.3`, the newest Node type package compatible with the current TypeScript 4.9 toolchain.
- `npm run test:helpers`: passed after adding single-image unmount download URL cleanup coverage.
- `npm ci`: passed after pinning `@types/node` to the TypeScript 4.9-compatible release.
- `npm run check`: passed on Node 24.12.0 after the Node baseline and unmount cleanup changes.
- `npm audit --audit-level=low`: passed after the Node 24 type update.
- `npm run smoke:browser`: passed after single-image unmount cleanup and the Node 24 baseline update.
- Initial pushed Node 24 CI caught that `@types/node@24.12.4` is not compatible with the current TypeScript 4.9 toolchain on a clean install; this was corrected by pinning `@types/node@22.9.3` until a TypeScript migration is handled separately.
- GitHub Actions passed on Ubuntu, Windows, and macOS for the Node type correction before the workflow action-runtime opt-in was folded into the same checkpoint.
- `npm run format:check`: passed.
- `npm run typecheck`: passed, including after bulk queue concurrency normalization and retry stale-output cleanup.
- `npm run test:unit`: passed, including after bulk queue concurrency normalization and retry stale-output cleanup.
- `npm run typecheck`: passed after bulk output summary helper.
- `npm run test:unit`: passed after bulk output summary helper.
- `npm run typecheck`: passed after empty per-image override normalization.
- `npm run test:unit`: passed after empty per-image override normalization.
- `npm run typecheck`: passed after add-jobs counter derivation.
- `npm run test:unit`: passed after add-jobs counter derivation.
- `npm run typecheck`: passed after shared bulk percent-change helper.
- `npm run test:unit`: passed after shared bulk percent-change helper.
- `npm run typecheck`: passed after bulk override summary helper.
- `npm run test:unit`: passed after bulk override summary helper.
- `npm run typecheck`: passed after bulk selection navigation helpers.
- `npm run test:unit`: passed after bulk selection navigation helpers.
- `npm run typecheck`: passed after bulk job status grouping helper.
- `npm run test:unit`: passed after bulk job status grouping helper.
- `npm run typecheck`: passed after bulk action-state selectors.
- `npm run test:unit`: passed after bulk action-state selectors.
- `npm run typecheck`: passed after bulk selected-job context helper.
- `npm run test:unit`: passed after bulk selected-job context helper.
- `npm run format:check`: passed after bulk job effective-settings helper.
- `npm run typecheck`: passed after bulk job effective-settings helper.
- `npm run test:unit`: passed after bulk job effective-settings helper.
- `npm run format:check`: passed after bulk per-job size summary helper.
- `npm run typecheck`: passed after bulk per-job size summary helper.
- `npm run test:unit`: passed after bulk per-job size summary helper.
- `npm run smoke:browser`: passed locally after automating the production-build Playwright CLI WebP output smoke.
- `npm run check`: passed after adding the automated browser smoke command.
- `npm run check`: passed after service-worker/shared type cleanup.
- `npm run smoke:browser`: passed after service-worker/shared type cleanup.
- `npm audit --audit-level=low`: passed after dependency drift review.
- `npm outdated --cache /private/tmp/sqush-npm-cache`: reviewed on 2026-05-24; remaining drift is major-version migration work, not routine patch cleanup.
- `npm run check`: passed after saved-settings storage refactor.
- `npm run smoke:browser`: passed after saved-settings storage refactor.
- `npm run smoke:browser`: passed after adding real-editor saved side settings verification.
- `npm run check`: passed after adding real-editor saved side settings verification.
- `npm run check`: passed after updating `@types/node` from Node 16 types to Node 20 types.
- `npm run check`: passed after requiring saved-settings availability checks to parse successfully.
- `npm run check`: passed after hardening saved-settings storage against throwing `localStorage` reads and writes.
- `npm run smoke:browser`: passed after hardening saved-settings storage against throwing `localStorage` reads and writes.
- `npm run test:helpers`: passed after adding result-cache hit/miss coverage.
- `npm run check`: passed after adding result-cache hit/miss coverage.
- `npm run test:helpers`: passed after adding MIME sniffing coverage for PNG, JPEG, WebP, JPEG XL, and unknown data.
- `npm run check`: passed after adding MIME sniffing coverage for PNG, JPEG, WebP, JPEG XL, and unknown data.
- `npm run check`: passed after tightening TIFF MIME sniffing and adding little-endian, big-endian, and false-positive coverage.
- `npm run check`: passed after relaxing AVIF MIME sniffing and adding AVIF/non-AVIF `ftyp` coverage.
- `npm run check`: passed after adding async bulk import MIME sniffing support.
- `npm run check`: passed after making async bulk import MIME sniffing reject unreadable files without failing the whole batch.
- `npm run check`: passed after making the bulk runner return the session unchanged when no jobs are runnable, even if no worker bridge is available.
- `npm run check`: passed after adding explicit zero-concurrency no-op coverage for the bulk runner.
- `npm run check`: passed after hardening bulk export names against Windows reserved device names.
- `npm run check`: passed after adding an `exported` count to bulk export summaries and keeping exported jobs out of pending counts.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `207589f` (`Track exported bulk summary counts`).
- `npm run check`: passed after adding Svelte migration context documentation.
- `npm run test:helpers`: passed after adding selected bulk export plan helpers.
- `npm run check`: passed after adding selected bulk export plan helpers.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `e68caee` (`Plan selected bulk exports`).
- `npm run check`: passed after tightening selected bulk export summary semantics.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `54a12b5` (`Summarize selected bulk exports`).
- `npm run test:helpers`: passed after extracting and covering single-image side reset logic.
- `npm run typecheck`: passed after extracting and covering single-image side reset logic.
- `npm run check`: passed after extracting and covering single-image side reset logic.
- `npm run smoke:browser`: passed after extracting and covering single-image side reset logic.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `baed797` (`Reset both editor sides on new source`).
- `npm run test:helpers`: passed after extracting compressed output filename generation.
- `npm run check`: passed after extracting compressed output filename generation.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `7b2984a` (`Preserve extensionless output names`).
- `npm run test:helpers`: passed after adding `ImageBitmap` cleanup to built-in decode.
- `npm run typecheck`: passed after adding `ImageBitmap` cleanup to built-in decode.
- `npm run check`: passed after adding `ImageBitmap` cleanup to built-in decode.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `95087f7` (`Update handoff after filename cleanup`).
- GitHub Actions passed on Ubuntu, Windows, and macOS for `d2958c9` (`Update handoff after decode cleanup`).
- `npm run typecheck`: passed after removing raw decode failure console logging.
- `npm run test:helpers`: passed after removing raw decode failure console logging.
- `npm run check`: passed after removing raw decode failure console logging.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `95c2a25` (`Stop logging raw decode failures`).
- `npm run test:helpers`: passed after adding full bulk queue draining.
- `npm run check`: passed after adding full bulk queue draining.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `590f2c3` (`Drain bulk queue in runner`).
- GitHub Actions passed on Ubuntu, Windows, and macOS for `aa329a9` (`Update handoff after queue drain`).
- `npm run test:helpers`: passed after expanding bulk action state command flags.
- `npm run check`: passed after expanding bulk action state command flags.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `773afcf` (`Expand bulk action state flags`).
- `npm run test:helpers`: passed after guarding bulk exported-state updates against stale outputs.
- `npm run check`: passed after guarding bulk exported-state updates against stale outputs.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `6618b01` (`Ignore stale bulk exports`).
- `npm run test:helpers`: passed after active jobs were added to incomplete bulk requeueing.
- `npm run check`: passed after active jobs were added to incomplete bulk requeueing.
- GitHub Actions passed on Ubuntu, Windows, and macOS for `1f213d8` (`Requeue active bulk jobs`).
- `npm run test:helpers`: passed after adding canonical bulk session counter derivation and normalization.
- `npm run check`: passed after adding canonical bulk session counter derivation and normalization.
- `npm run check`: passed after making bulk queue scheduling drift-tolerant.
- `npm run check`: passed after making bulk queue status transitions normalize drifted counters.
- `npm run test:helpers`: passed after adding metadata-only bulk session snapshots.
- `npm run test:helpers`: passed after adding serialized bulk snapshot validation coverage.
- `npm run check`: passed after making stale exported outputs pending in bulk export summaries.
- `npm run smoke:browser`: passed after expanding the production browser smoke to cover extensionless PNG input and WebP output naming.
- `npm run smoke:browser`: passed after expanding the production browser smoke to reload the app shell while offline.
- `npm run check`: passed after guarding service-worker bridge startup for service-worker-disabled contexts.
- `npm run smoke:browser`: passed after guarding service-worker bridge startup for service-worker-disabled contexts.
- `npm run check`: passed after adding a pure bulk active-job cancellation helper.
- `npm run check`: passed after adding bulk settings-change workflow helpers.
- `npm run check`: passed after removing obsolete TS suppressions from option controls and icon props.
- `npm run typecheck`: passed after removing the remaining maintained app/lib `@ts-ignore` from worker-bridge dispatch.
- `npm run build && npm run smoke:build`: passed.
- `npm run test:helpers`: passed.
- `npm run check`: passed after CI matrix diagnostics.
- `npm run check`: passed after adding bulk strip item selectors and project identity docs.
- `npm run check`: passed after adding bulk session summary selectors.
- `npm run test:helpers`: passed after extracting single-image work planning.
- `npm run typecheck`: passed after extracting single-image work planning.
- `npm run check`: passed after extracting single-image work planning.
- `npm run smoke:browser`: passed after extracting single-image work planning; production build still imports PNG, exports WebP, handles extensionless input naming, saves side settings, and reloads the app shell offline.
- `npm run check`: passed after extracting source default resize rules.
- `npm run check`: passed after extracting orientation resize adjustment.
- `npm run check`: passed after extracting default source resize side updates.
- `npm run check`: passed after extracting side loading/result updates.
- `npm run smoke:browser`: passed after extracting side loading/result updates; production build still imports PNG, exports WebP, resizes WebP to `64px`, saves/imports side settings, handles extensionless input naming, and reloads the app shell offline.
- `npm run check`: passed after sharing source decode behavior and adding `docs/progress-dashboard.html`.
- `npm run check`: passed after extracting preprocessing completion state and adding the dashboard live-reload server.
- `npm run check`: passed after extracting side undo restoration and documenting the Codex project path handoff.
- `npm run check`: passed after extracting saved side settings key/label lookup, removing forward-looking WebP 2 mentions, and updating handoff/dashboard notes.
- `npm run check`: passed after extracting document-title formatting.
- `npm run check`: passed after extracting side-copy URL behavior.
- `npm run check`: passed after extracting document-title loading selectors.
- `npm run check`: passed after extracting saved side-state import updates.
- `npm run check`: passed after adding saved-settings parser edge-case coverage for latest-only settings, version mismatches, and invalid versioned payloads.
- `npm run smoke:browser`: passed after expanding production browser smoke to verify saved right-side WebP settings can be imported back into the real editor.
- `npm run check`: passed after expanding saved-settings import browser smoke coverage.
- `npm run check`: passed after extracting default and initial side state helpers.
- `npm run check`: passed after adding the bulk selected-job detail selector.
- `npm run check`: passed after adding metadata-only bulk snapshot restore.
- `npm run check`: passed after adding serialized bulk snapshot restore.
- `npm run check`: passed after adding the bulk queue-state selector.
- `npm run check`: passed after adding the bulk import-to-session helper and clarifying remaining local folder naming.
- `npm run check`: passed after adding the bulk export-plan completion helper.
- `npm run check`: passed after extracting bulk process-plan creation.
- `npm run check`: passed after normalizing counters in bulk remove/export session mutations.
- `npm run check`: passed after adding queue state to the bulk session summary selector.
- `npm run check`: passed after adding structured bulk import rejection reasons.
- `npm run check`: passed after adding bulk import rejection reason counts.
- `npm run smoke:browser`: passed after adding the service-worker-disabled app-shell check; the first sandbox run could not access the existing Playwright CLI config under `~/.playwright`, and the rerun with approved elevated access passed.
- `npm run check`: passed after adding the service-worker-disabled browser smoke path.
- `npm run check`: passed after adding the shared-image service-worker controller guard.
- `npm run check`: passed after adding the bulk append-import session helper.
- `npm run check`: passed after making static build file writing return a promise from the utility.
- `npm run check`: passed after hardening single-image output filenames against path-like and reserved names.
- `npm run check`: passed after sharing filename basename sanitization between single-image and bulk exports.
- `npm audit --audit-level=low`: passed, 0 vulnerabilities.
- Latest observed GitHub Actions state: pushed commits through `63adddf` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the WebP smoke documentation push: `995c9b2` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the bulk queue/retry cleanup: `48746ca` passed on Ubuntu, Windows, and macOS after rerunning a transient macOS DNS failure during `npm audit`.
- Latest observed GitHub Actions state after the bulk queue-state selector: `cf3eb92` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the import-to-session helper and local folder naming clarification: `d3d377b` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the export-plan completion helper: `52b3556` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the process-plan helper: `a51ac15` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after normalizing bulk session mutations: `ded5ecf` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after adding queue state to the summary selector: `73a192a` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after adding structured bulk import rejection reasons: `9d12fd2` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after the service-worker-disabled browser smoke path: `6dac0ae` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after refreshing the browser support policy: `92083df` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after adding the bulk append-import helper: `36c1250` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after making static build file writing return a promise: `ed6b81c` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after hardening single-image output names: `dfb472c` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk summary/override/add-jobs cleanup: `e4e3c1d` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after shared bulk percent-change cleanup: `6345b2d` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk override summary cleanup: `1fdf5eb` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk selection navigation cleanup: `04488dd` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk status grouping cleanup: `662808c` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after latest handoff update: `281521b` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk action/selection/effective-settings cleanup: `6f007fe` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after latest handoff update: `677750f` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk per-job size summaries: `7243559` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after automated browser smoke command: `f890ea1` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after CI hygiene cleanup: `974ea79` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after dependency drift documentation: `b98f4c0` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after saved-settings storage refactor: `68d03b4` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after latest handoff update: `ae72c6c` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after saved-settings browser smoke: `bc78e14` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after Node type alignment: `b66bda1` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after saved-settings availability cleanup: `1644efa` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after blocked saved-settings storage handling: `019de22` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after MIME sniffing coverage and TIFF sniffing cleanup: `eae6859` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after AVIF MIME sniffing cleanup: `51553da` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after async bulk import MIME sniffing support: `bbdb8ea` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk runner no-op and reserved export name cleanup: `b7d0f3b` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk exported-count summaries: `207589f` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after selected bulk export plans: `e68caee` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after selected bulk export summaries: `54a12b5` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after single-image side reset cleanup: `baed797` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after compressed output filename cleanup: `7b2984a` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after built-in decode cleanup: `95087f7` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after decode handoff update: `d2958c9` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after decode logging cleanup: `95c2a25` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after full bulk queue draining: `590f2c3` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after queue-drain handoff update: `aa329a9` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after bulk action-state flags: `773afcf` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after stale bulk export guard: `6618b01` passed on Ubuntu, Windows, and macOS.
- Latest observed GitHub Actions state after active incomplete-job requeueing: `1f213d8` passed on Ubuntu, Windows, and macOS.
- `npm run serve` wrapper: launched successfully on port 55194.
- Browser production-preview smoke: passed after shared image pipeline extraction; app shell, Sqush logo, and drop target rendered.
- Playwright CLI production-build smoke: passed after the Sqush rename, with `Sqush` title, file input present, Sqush logo alt text present, and zero console messages.
- Playwright CLI production-build image import smoke: passed on `2026-05-23`; built app loaded, `icon-large.png` imported into `/editor`, processing completed with title `icon-large.png - Sqush`, WebP options were present, and console errors were 0.
- Playwright CLI production-build WebP output smoke: passed on `2026-05-24`; built app loaded, `icon-large.png` imported into `/editor`, output side switched to `WebP`, `icon-large.webp` blob download was present, output was `24.1 kB` with a 9% reduction, and console errors were 0.
- Playwright CLI production-build extensionless input smoke: passed on `2026-05-24`; built app loaded an extensionless PNG copy named `icon-large`, output side switched to `WebP`, and `icon-large.webp` blob download was present.
- Playwright CLI production-build offline shell smoke: passed on `2026-05-24`; after the production app loaded, the browser context was set offline, the app reloaded, and the file input was available from the cached app shell.
- Playwright CLI production-build service-worker-disabled smoke: passed on `2026-05-24`; with `navigator.serviceWorker` simulated as unavailable, the production app shell loaded and the file input was available.

Next recommended tasks when work resumes:

1. Start the next Codex session from the real project folder `/Users/tav/Development/Tavlean/Sqush` if possible. Use this document, [Progress dashboard](progress-dashboard.md), [visual dashboard](progress-dashboard.html), [Todo](todo.md), and [Svelte migration context](svelte-migration-context.md) as handoff context.
2. Continue extracting/tested framework-neutral logic from Preact components where it clearly reduces future Svelte migration risk.
3. Use [Svelte migration context](svelte-migration-context.md) before Svelte-adjacent refactors so new helpers stay aligned with Svelte 5/SvelteKit best practices.
4. Add browser smoke tests before significant UI or codec-surface changes.
5. Do not implement bulk UI until the workflow design has been discussed and iterated.
6. Use `docs/dependency-modernization.md` for dependency cleanup order; do not use `npm audit fix --force` blindly.
7. For live status viewing, run `npm run dashboard` and open the printed `http://localhost:4177` URL. The dashboard reloads only when `docs/progress-dashboard.html` changes.

Quick investigation note:

- `rg "as any|: any| any[),;]" src/client/lazy-app src/features lib/test-helpers.js` currently reports no remaining matches in the main lazy app, feature code, or helper tests. The only generated `as any` text found is emitted by `lib/feature-plugin.js` for worker exposure.

## Completed baseline cleanup

- Added project documentation and a road map.
- Added an issue-list backlog seed.
- Added a progress dashboard to keep cleanup, simplification, bulk, and Svelte migration readiness aligned.
- Added Svelte migration context based on the Svelte MCP documentation pass.
- Added an agent guide to keep future work aligned with the product and maintenance mission.
- Added an initial browser support policy note.
- Documented first public browser support targets and release gates for local/offline optimization reliability.
- Added `npm run typecheck`.
- Added `npm test` as an alias for the full baseline check.
- Added `npm run test:unit` as an alias for pure-helper tests.
- Added Node and npm engine metadata matching `.nvmrc`.
- Updated Node type definitions to the newest release compatible with the current TypeScript 4.9 toolchain while moving the runtime baseline to Node 24.
- Added `npm run format` and `npm run format:check`.
- Added `npm run smoke:build` to verify generated build output.
- Expanded `npm run smoke:build` to check generated Sqush metadata and absence of analytics code.
- Expanded `npm run smoke:build` to verify generated feature metadata and worker entry files exist.
- Expanded `npm run smoke:build` to guard against accidental external runtime scripts, runtime links, and manifest media.
- Expanded `npm run smoke:build` to verify service-worker precache assets exist in the production build.
- Added `npm run preview` to serve the production `build/` directory.
- Documented and verified a Playwright CLI smoke flow for the production app shell and local-image editor import path.
- Documented and verified a Playwright CLI smoke flow for explicit WebP output generation and export-link presence.
- Added `npm run smoke:browser` to automate the local production-build Playwright CLI smoke without adding Playwright as a project dependency.
- Expanded `npm run smoke:browser` to verify the real editor writes versioned WebP side settings to `localStorage`.
- Updated CI to use current checkout/setup-node actions and run the baseline checks.
- Expanded CI to cover Ubuntu, Windows, and macOS.
- CI matrix fail-fast is disabled so one platform failure does not hide the other platform results.
- CI uses read-only repository permissions, a 15-minute job timeout, and concurrency cancellation so superseded runs do not keep running after newer pushes.
- Removed the inherited upstream Google Analytics integration.
- Refreshed Browserslist data.
- Removed the old Node `DEP0190` warning from the TypeScript build spawn.
- Upgraded the local static server from `serve@11` to `serve@14`.
- Applied compatible `npm audit fix` updates.
- Replaced `npm-run-all` with a local dev runner script.
- Hardened saved side settings against invalid `localStorage` data.
- Added versioned saved side settings serialization while preserving legacy saved settings.
- Hardened saved settings parsing to reject array-shaped payloads.
- Hardened saved settings parsing to reject missing or array-shaped encoder options.
- Hardened saved settings parsing to reject null encoder option values.
- Hardened saved settings parsing to reject invalid processor enabled values and null option values.
- Hardened saved settings availability checks so corrupt `localStorage` data is not treated as importable settings.
- Hardened saved settings storage so blocked browser storage does not break editor startup or falsely report a successful save.
- Centralized saved-settings storage reads/writes and fixed the right-side settings event listener cleanup path.
- Modernized one editor media query listener path.
- Hardened the shared abort helper so it removes abort listeners when wrapped work settles.
- Replaced avoidable `any` types in shared DOM input helpers and gesture prevention.
- Replaced the shared shallow object comparison helper's public `any` types with object types.
- Replaced avoidable public `any` types in the shared immutable update helper with `unknown`/object types.
- Replaced avoidable public `any` types in the generated worker bridge dispatch with `unknown`/method types.
- Replaced a handwritten encoder option component constructor type with Preact's component constructor type.
- Replaced the core image compression pipeline's encoder options cast with typed encoder dispatch.
- Replaced the editor encoder options render cast with typed encoder option component dispatch.
- Replaced avoidable `any` casts in the result cache processor-state comparison.
- Added result-cache helper coverage for matching, mismatched image data, mismatched encoder options, and mismatched processor options.
- Added MIME sniffing helper coverage for PNG, JPEG, WebP, JPEG XL, and unknown data.
- Tightened TIFF MIME sniffing to require real little-endian or big-endian TIFF headers instead of loose `I`/`MM` prefixes.
- Relaxed AVIF MIME sniffing to accept normal `ftypavif` headers regardless of box size while still rejecting non-AVIF `ftyp` data.
- Added an async bulk import helper that can accept extensionless or misnamed image files through injected MIME sniffing.
- Hardened async bulk import MIME sniffing so one unreadable file is rejected without aborting the whole batch.
- Hardened the bulk runner so empty runnable sets are no-ops and do not require worker bridge availability.
- Added explicit bulk runner coverage for zero-concurrency no-op scheduling.
- Hardened bulk export filename sanitization so Windows reserved device names such as `CON` and `LPT1` are not emitted directly.
- Added an `exported` count to bulk export summaries so exported jobs are not reported as pending.
- Replaced avoidable `any` usage and optional Promise entries in service-worker cache cleanup and shared ref utilities.
- Added framework-neutral bulk settings, session, import, queue, and stale-output helpers.
- Hardened bulk session construction so initial active and exported jobs derive matching counters.
- Hardened bulk session job additions so active and exported counters update when adding restored jobs.
- Extracted and tested processor-state equivalence logic from the Preact editor component.
- Tightened bulk override detection so empty nested override objects are not treated as real overrides.
- Tightened bulk session updates so empty per-image override objects are stored as no override.
- Added framework-neutral bulk override summary helpers for future image-strip indicators.
- Added framework-neutral bulk next/previous selection helpers for future image-strip navigation.
- Added framework-neutral bulk selected-job context for future image-strip navigation state.
- Added framework-neutral bulk job effective-settings lookup to keep global/override merge rules out of UI code.
- Added framework-neutral bulk job status grouping for future status labels and controls.
- Added framework-neutral bulk action-state selectors for future export/retry/activity controls.
- Tightened bulk settings merging so falsy overrides such as `false` and `0` remain valid per-image overrides.
- Added a settings override path helper for future per-image override highlighting.
- Hardened bulk queue transitions so missing or repeated jobs do not corrupt active-job counts.
- Hardened bulk queue scheduling so invalid, fractional, negative, or infinite concurrency values do not produce surprising runnable-job lists.
- Hardened bulk queue/session bookkeeping so removed or stale exported jobs keep exported counts consistent.
- Hardened bulk queue completion/failure transitions so exported-count bookkeeping recovers if an exported job is overwritten.
- Hardened bulk queue failure transitions so failed jobs do not retain stale output download data.
- Hardened bulk retry transitions so failed or skipped jobs do not retain stale output download data.
- Hardened bulk single-job requeue bookkeeping so reprocessing an exported job decrements exported counts.
- Added a bulk queue retry helper for failed and skipped jobs.
- Added framework-neutral bulk export helpers for exportable jobs and batch size summaries.
- Added a framework-neutral bulk output summary helper for valid optimized bytes, stale outputs, and already-exported jobs.
- Added a framework-neutral bulk per-job size summary helper so future image-strip stats can ignore stale outputs consistently.
- Added a shared bulk percent-change helper used by processing and summary code.
- Added bulk export entry naming helpers for duplicate-safe future batch downloads.
- Hardened bulk export entry naming so names generated to resolve earlier collisions are also reserved against later files.
- Hardened bulk export archive names so batch IDs cannot create path-like or invalid download names.
- Hardened bulk export filenames for invalid characters, punctuation-only names, hidden-style names, and deterministic case-insensitive duplicate checks.
- Added session helpers for global setting changes and per-image override changes.
- Added detailed bulk progress counters for future batch status displays.
- Hardened bulk session imports so repeated files receive unique job IDs.
- Added a bulk import extension fallback for image files with missing MIME types.
- Expanded bulk import extension fallback to accept extension-only JFIF, BMP, TIFF, and TIF files.
- Added a bulk import summary helper for accepted/rejected counts and byte totals.
- Added a session helper to remove jobs while preserving valid selection and active-job counts.
- Added a session helper to mark encoded jobs exported without double-counting repeat exports.
- Added a lightweight Node assertion test for bulk helper behavior.
- Expanded the lightweight helper test to cover `clean-modify` and `pretty-bytes`.
- Extracted single-image decode/process/encode/SVG pipeline helpers into `src/client/lazy-app/image-pipeline.ts`.
- Added `src/client/lazy-app/bulk/processor.ts` to process one bulk image job through the shared image pipeline without UI coupling.
- Guarded bulk processor percent-change calculation for zero-byte inputs.
- Added `src/client/lazy-app/bulk/runner.ts` to process queued bulk jobs up to the concurrency limit.
- Hardened the bulk runner so already-aborted batches do not start jobs or call processors.
- Added `src/client/lazy-app/bulk/urls.ts` to collect and revoke bulk preview, thumbnail, and download object URLs.
- Hardened bulk object URL cleanup so duplicate preview, thumbnail, and download URLs are only revoked once.
- Fixed SVG `viewBox` size parsing for comma-separated values using a tested helper.
- Replaced POSIX-only `dev` and `serve` script syntax with Node wrappers for better Windows compatibility.
- Documented the full current upstream open PR audit in `docs/upstream-pr-notes.md`.
- Removed duplicate buffer collection in `lib/url-plugin.js` based on upstream PR `#1457`.
- Added UTF-8 charset metadata based on upstream PR `#1072`.
- Added codec provenance inventory and rebuild cautions.
- Added `docs/manual-qa.md`.
- Added `npm run audit` and CI audit enforcement.
- Removed the noisy Rollup unused external import warning by narrowing `path` imports in build plugins.
- Refreshed low-risk dependencies while keeping Preact pinned because the newer Preact 10 typings require a separate migration.
- Refreshed `preact-render-to-string` within major 5 for static prerendering without starting the Preact migration.
- Refreshed compatible Rollup 2 plugins and set `@rollup/plugin-replace` `preventAssignment` explicitly.
- Applied the non-force `npm audit fix` lockfile update for `brace-expansion`.
- Migrated the CSS build stack to PostCSS 8-era packages.
- Upgraded `@rollup/plugin-terser` to clear the remaining serialization audit findings.

## Current verification commands

Run these before committing substantial changes:

```sh
npm run format:check
npm run build
npm run smoke:build
npm run test:helpers
npm run typecheck
```

For UI-sensitive changes, also run a browser smoke check against `build/` after `npm run build`.
Use `npm run preview` for that production-build browser check; `npm run serve` is for dev output in `.tmp/build/static`.

On a fresh checkout, run `npm run build` before `npm run typecheck` because the build creates ignored feature metadata files required by TypeScript. `npm run check` already runs commands in the safe order and includes the helper tests.

## Remaining audit state

`npm audit --audit-level=low` currently reports 0 vulnerabilities.

Keep avoiding blind `npm audit fix --force`; future findings should still be handled as explicit dependency or toolchain tasks with verification.

## Local npm cache issue

The default npm cache at `/Users/tav/.npm` previously failed with `EPERM` in this environment. The manual ownership repair was run successfully:

```sh
sudo chown -R 501:20 "/Users/tav/.npm"
npm cache verify
```

`npm cache verify` now succeeds in the user's normal terminal. The Codex sandbox may still report `EPERM` against individual cache files, so use a temporary npm cache for Codex-run install/update commands if that reappears.
