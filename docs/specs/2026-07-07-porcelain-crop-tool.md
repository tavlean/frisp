# Porcelain lab — Crop tool (Pixelmator-Pro-style)

Status: **IN PROGRESS** (2026-07-07). Maintainer request: a full crop tool in
`/lab/porcelain`, modeled on Pixelmator Pro's crop, styled porcelain. This doc
is the execution contract — APIs and math conventions here are FIXED; if an
implementation detail must diverge, update this doc in the same commit.

## Scope decisions (made this session, maintainer gave latitude)

- **In**: crop rect with 8 handles; rotate by dragging outside the corners;
  straighten slider (−45°…45°); rotate-90°/flip buttons; move the rect
  anywhere INCLUDING beyond the image (out-of-canvas crop); constrain menu
  (free "Custom Size", "Custom Aspect Ratio", Original + 14 ratio presets,
  2 size presets); W/H pixel fields; background fill for empty pixels
  (transparent default, white/gray/black swatches, any-color picker, and
  sample-from-image); overlay guides (Rule of Thirds, Grid, Diagonal,
  Triangle, Golden Ratio, Golden Spiral, Center) with Auto/Always/Never;
  Reset / Cancel / Apply; Esc/Enter shortcuts; non-destructive re-edit
  (re-opening the tool restores the previous crop over the ORIGINAL image).
- **Out (v1, discuss with maintainer)**: Perspective sliders (needs
  homography resampling — real work, doable later), Auto Crop, Auto
  Straighten (both need content analysis), "Delete cropped pixels" checkbox
  (superseded: we are ALWAYS non-destructive within the session), zoom/pan
  inside the crop stage (view auto-fits instead).
- Crop is a **lab-page-level source transform**, upstream of EditorSession:
  Apply renders the crop to a PNG File (`stem.png`, keeps alpha) and feeds it
  through `session.pickFiles` — zero production-engine changes. The page
  keeps `original: File` + the last `CropSnapshot` so re-edit starts from the
  original, not the cropped copy. SVG sources: crop disabled (needs raster).

## Files

| File | Owner | Role |
|---|---|---|
| `src/lib/lab/crop/crop-types.ts` | orchestrator | shared types (below) |
| `src/lib/lab/crop/crop-geometry.ts` | orchestrator | pure math, no Svelte/DOM |
| `src/lib/lab/crop/crop-tool.svelte.ts` | orchestrator | `CropTool` runes class — the ONE shared state object |
| `src/lib/lab/crop/render-crop.ts` | orchestrator | final render → canvas/File |
| `src/lib/lab/crop/overlays.ts` | Codex | pure guide-line/path generators |
| `src/lib/lab/crop/CropStage.svelte` | orchestrator | canvas + pointer interactions |
| `src/lib/lab/crop/CropPanel.svelte` | Opus agent | porcelain right-panel UI |
| `src/lib/lab/crop/crop-geometry.test.ts`, `overlays.test.ts` | Codex | Vitest |
| `src/routes/lab/porcelain/+page.svelte`, `src/lib/lab/porcelain/TopBar.svelte` | orchestrator | integration (crop button, mode swap) |

One writer per file — delegates create ONLY their files, never edit others.

## Coordinate model (FIXED — all math flows from this)

Everything is y-down. Angles in degrees in state; positive = clockwise on
screen (canvas convention).

- **Image space**: source pixels, origin top-left, size W×H.
- **World space**: image → world is `world = R(θ) · F · (p − (W/2, H/2))`
  where `θ = orientation + angleDeg` and `F = diag(flipH ? −1 : 1,
  flipV ? −1 : 1)` — flip FIRST, then rotate. Image center = world origin.
- **Crop rect**: `{ cx, cy, w, h }`, ALWAYS axis-aligned in world space.
  Output image = the rect content at 1:1 world px, size `round(w)×round(h)`.
- **Screen (stage view)**: `screen = world·scale + (tx, ty)` — uniform scale +
  pan only, never rotation, so the rect is axis-aligned on screen and the
  IMAGE rotates behind it (Pixelmator behavior).

State (`CropState`): `rect`, `angleDeg ∈ (−45, 45]` (straighten),
`orientation ∈ {0,90,180,270}`, `flipH`, `flipV`.

Operations (each proved by `T = R·F` algebra; keep these exact):

- **Straighten / interactive rotate to `angle'`**: `Δ = angle' − angle`;
  `rect.c ← R(Δ)·rect.c` (this keeps the image point under the crop CENTER
  fixed — pivot = crop center); interactive rotation folds overflow into
  `orientation` (`angle > 45 → angle −= 90, orientation += 90`, and mirror
  for ≤ −45) — folding changes NO geometry, θ is invariant.
- **Rotate 90 (dir = ±1, +1 = CW)**: `orientation ← (orientation + 90·dir) mod
  360`; `rect.c ← R(90·dir)·rect.c` (y-down CW: `(x,y) → (−y,x)`); swap
  `rect.w ↔ rect.h`. Whole composition rotates; content under crop unchanged.
- **Flip horizontal**: mirror the whole scene. `flipH ← !flipH`,
  `angleDeg ← −angleDeg`, `orientation ← (360 − orientation) mod 360`,
  `rect.cx ← −rect.cx`. (Identity used: `M·R(θ) = R(−θ)·M`.) Vertical flip:
  same with `flipV`, `rect.cy ← −rect.cy`.
- **Resize by handle**: anchor = opposite corner (corner drags) / opposite
  edge with cross-axis center kept (edge drags); alt = resize from center.
  Ratio-locked corner: `w = max(|dx|, |dy|·r), h = w/r` from the anchor.
  Min rect size 8 world px per axis; never let the rect invert.
- **Move**: `rect.c += Δ` — deliberately UNCLAMPED (out-of-canvas crop is the
  point). Dragging inside the rect moves the RECT over the image.
- **Pixel snap**: on Apply only, and only when `angleDeg === 0`: round the
  rect's image-space corner + size to integers (via T⁻¹, round, T) so a pure
  crop stays resample-free at any orientation/flip.

Final render (`render-crop.ts`), canvas `w×h = outputSize(rect)`:

```
if bg: fillRect(bg)
translate(w/2 − cx, h/2 − cy); rotate(rad(θ)); scale(fx, fy)
drawImage(bitmap, −W/2, −H/2)         // imageSmoothingQuality = 'high'
```

Clamp output dims to 16384 (snackbar if clamped). `cropToPngFile(...)` wraps
`canvas.toBlob('image/png')` → `File` named `${stem}.png`.

## CropTool (runes class) — the API both UI halves consume

```ts
class CropTool {
  readonly bitmap: ImageBitmap; readonly imageWidth/Height: number;
  state: CropState                              // $state
  constrain: ConstrainMode                      // $state — see crop-types
  background: CropBackground                    // $state — {kind:'transparent'} | {kind:'color', css}
  overlay: OverlayKind; overlayMode: 'auto'|'always'|'never'   // $state
  sampling: boolean                             // $state — panel arms, stage samples a pixel → background
  adjusting: boolean                            // $state — any active gesture (stage drags set it; panel calls notifyAdjust() on slider input; auto-clears 400ms after last notify)
  rotateGesture: boolean                        // $state — true while rotating (stage) → stage shows Grid overlay in auto mode
  transformEpoch: number                        // $state — bumped by every rotation/flip remap (NOT move/resize); the stage watches it and shifts the view pan so the crop center stays screen-anchored across the remap (world is image-anchored, so without this the composition would jump on screen)
  outputWidth/Height: number                    // $derived, rounded
  activeRatio: number | null                    // $derived (w/h; 'original' resolves against oriented dims)
  isDefault: boolean                            // $derived — reset-button enable
  setConstrain(mode); setWidth(px); setHeight(px);
  setStraighten(deg); rotate90(dir: 1|-1); flipHorizontal(); flipVertical();
  moveRect(dx,dy); notifyAdjust(); reset();
  snapshot(): CropSnapshot; // state+constrain+background+overlay prefs
  applyToFile(): Promise<File>;
  dispose();
  static create(file: File, prior?: CropSnapshot | null): Promise<CropTool>
}
```

`ConstrainMode = {kind:'free'} | {kind:'original'} | {kind:'ratio', rw, rh,
custom?: boolean}`. Switching to a ratio re-fits the rect area-preserving
around its center. Ratio presets (Pixelmator's list): 16:9, 5:3, 3:2, 7:5,
4:3, 5:4, Square(1:1), 4:5, 3:4, 5:7, 2:3, 3:5, 9:16. Size presets:
1920×1080, 1024×768 (set exact rect size, constrain stays free).

## overlays.ts (Codex contract)

```ts
overlayGraphic(kind: OverlayKind, w: number, h: number): { lines: {x1,y1,x2,y2}[]; paths: string[] }
```
Pure, viewBox = 0 0 w h. thirds: 4 lines at 1/3, 2/3. grid: square cells,
cell = max(w,h)/12. diagonal: a 45° line from each corner into the rect,
length min(w,h) (4 lines). triangle: TL→BR diagonal + perpendicular feet
from TR and BL (3 lines). goldenRatio: 4 lines at 0.382/0.618. goldenSpiral:
one SVG path of ≥8 quarter-arc segments tiling golden rectangles fitted to
w×h. center: full-width + full-height center cross (2 lines).

## Stage (interaction spec)

- Fits view to bbox(rotated image corners ∪ rect) with the porcelain insets
  (left 16, right panel+32, top 84, bottom 16) + 40px padding; view FROZEN
  during a gesture, re-fits (150ms ease) on release. devicePixelRatio-aware.
- Draw order: page-bg stage → checkerboard (or bg color) inside rect →
  image (transformed) → scrim OUTSIDE rect (page color at ~78%, resolved via
  getComputedStyle so light/dark both work) → SVG rect border + handles +
  guides (white hairlines with faint dark shadow for light-mode contrast).
- Hit priority: corner handle (≤10px) > edge (≤8px) > rotate annulus
  (outside rect, ≤28px past a corner; custom curved-arrow cursor) > inside
  (move) > outside (no-op). Shift while resizing: hold current ratio even in
  free mode. Alt: resize from center. Rotate drag: snap to 0.25°, shift
  snaps 15°, sticky ±0.75° around 0. Arrows nudge rect 1px (shift 10).
  Esc = cancel, Enter = apply (wired at page level).
- Overlay visibility: never → none; always → chosen overlay; auto → only
  while `adjusting`, and Grid replaces the chosen overlay while
  `rotateGesture` (Pixelmator behavior).

## Panel (Opus contract)

Props: `{ tool: CropTool, onapply: () => void, oncancel: () => void }`.
Porcelain conventions: reuse `FormatDropdown`'s trigger/popover pattern for
the Constrain and Overlay dropdowns (grouped options + checkmarks like the
Pixelmator screenshots), `.text-field`-style inset W/H inputs, icon-button
rows like TopBar, Range-style slider for Straighten (reuse
`$lib/editor/options/Range.svelte` if it fits, else hand-rolled porcelain
range), footer Reset (ghost, disabled when `tool.isDefault`) above
Cancel | Apply (Apply = charcoal primary like `.results .download`).
Background row: transparent (checker chip), white/gray/black swatches,
native color input (custom chip), sample-from-image button (sets
`tool.sampling = true`; stage does the rest). Caption: formats without
transparency flatten transparent fill.

## Integration

- `TopBar` gains a Crop icon button (`oncrop` prop; disabled for SVG).
- Page: `cropTool` $state; while set, the editor chrome (Output, TopBar,
  both panels) is replaced by CropStage + a right `.panel` hosting CropPanel.
  Apply → `tool.applyToFile()` → internal pick (does NOT reset `original`) →
  save snapshot → dispose. New file drop → `original = file; snapshot=null`.
- Session-level undo/history intentionally does NOT capture crop (the crop
  re-edit path is the undo). Session encoder options survive Apply because
  `pickFiles` keeps encoder recipes (documented behavior).

## Gates

`npm run check` · `npm run test:unit` (geometry + overlays tests) · Svelte
MCP autofixer on every new/edited `.svelte` · manual preview: light+dark,
rotate/flip/straighten round-trips, out-of-canvas crop with color fill,
JPEG-source → WebP transparent result.

## If things break

- Rotation pivot feels wrong → re-check `c' = R(Δ)c` is applied for EVERY θ
  change (straighten AND fold AND rotate90) — a missed one shows as the crop
  "walking" across the image.
- Blurry 1:1 crops → pixel snap didn't run (angle must be exactly 0) or the
  render transform got a half-pixel offset (odd W/H: snap happens in IMAGE
  space, not world space, precisely for this).
- EXIF-rotated JPEGs offset → `createImageBitmap(file, { imageOrientation:
  'from-image' })` must be the decode path (matches production decode).
