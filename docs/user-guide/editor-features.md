# Editor features

> Everything you can do once an image is open: compare before vs. after, zoom and pan, rotate, inspect pixels, copy settings between the two sides, save your favourite settings, download, and load or replace images by drag-and-drop.

## Overview / When to use it

Sqush is an in-browser image compressor — you pick an image, it stays on your device, and you tune how it is saved to make the file smaller. The editor shows a single **two-up** view: the same picture split down the middle, with your _original_ on one side and the _compressed result_ on the other, so you can judge the trade-off between quality and file size before you download. This page covers the interactive parts of that view — the compare slider, the zoom/rotate/inspect controls, and the per-side settings actions in each panel's header. (The encoder-specific quality settings live in their own format docs.)

The screen has three parts: the big image area in the middle, and two settings panels pinned to the bottom-left and bottom-right corners. The **left panel and the left half of the image are "side 0"** (accented coral, the _before_ by default), and the **right panel and the right half are "side 1"** (accented azure, the _after_). By default the left side is the untouched **Original** and the right side is **WebP**.

## Controls / Settings

### Before/after compare slider (two-up)

- **What it does:** Splits the image area in two. One side shows the left panel's output, the other shows the right panel's output, clipped at a movable split line. Drag the split line to wipe between _before_ and _after_ and spot compression artifacts.
- **How to use it:** Grab the round handle on the split line and drag. On wide screens (viewport wider than 760px) the split is **horizontal** (left/right, drag sideways); on narrow/mobile screens (760px or less) it flips to **vertical** (top/bottom, drag up and down). The handle shows a coral left-arrow and an azure right-arrow so you can tell which side is which. The split position is kept as a _proportion_, so it stays in the same relative spot if you resize the window. There is also a hidden keyboard shortcut: with the editor focused (and not while typing in a text field), press **1**, **2**, or **3** to snap the split to the start, middle, or end.
- **How to choose:** Put the split roughly in the middle to compare the two sides side-by-side, or push it fully to one end to view a single side in isolation. Drag it slowly across a detailed area (text, skin, gradients) to watch where compression starts to hurt.
- **Recommended starting point:** **Middle** — then drag across the busiest part of the image to check quality.

### "Optimising…" while a side encodes

- **What it does:** Tells you when a side is busy compressing. The side never goes blank — until it has its own result it shows your loaded image as a stand-in, with a small **"Optimising…"** pill (a spinner + label) floating over that half of the view.
- **Range & default:** Appears automatically over whichever side is encoding (left pill over the left half, right pill over the right half; top/bottom on a narrow screen). It only shows after a short delay, so quick encodes don't flash it — which is why on a fast format you may not see it at all.
- **How to use it / how to read it:** The first time a side encodes it reads **"Optimising…"**. After that, whenever you change a setting and the side re-encodes, it reads **"Re-optimising…"** — and the previous result stays on screen, crisp, while the new one is computed, so you're never left looking at nothing. The pill is the single, consistent "this side is working" signal: if you see it, that side is (re-)optimising; when it disappears, the result you're looking at is final.
- **Recommended starting point:** Nothing to set — just know that a pill over a side means "still working," and a side with no pill is showing its finished result.

### Zoom (in / out / type a percentage)

- **What it does:** Magnifies the image so you can inspect fine detail. Both sides zoom and pan together, so the comparison always stays aligned.
- **Range & default:** The **−** and **+** buttons step the zoom by ×1.25 each press (about the centre of the view). The current zoom is shown as a percentage with a dashed underline; click it (or focus it and press **Enter**) to turn it into a number field where you can type an exact value. The typed field accepts **1 to 1,000,000 (%)**, step 1. Behind the scenes the zoom itself is clamped to roughly **1%–10,000,000%** (0.01×–100,000×). When you first open an image (or after a rotate/resize), it auto-fits to the available space and never starts zoomed _in_ past 100%.
- **How to use it:** Click **+ / −**, type a percentage, or use your **mouse wheel / trackpad** over the image (scroll to zoom toward the cursor; a trackpad pinch zooms more finely). One-finger drag pans; two-finger pinch zooms on touch devices.
- **How to choose:** Zoom to 100% or higher to judge real per-pixel quality; zoom out to see the whole frame and overall colour.
- **Recommended starting point:** Leave it at the **auto-fit** view to frame the whole image, then zoom to **100%+** on the details you care about most.

### Rotate

- **What it does:** Turns the image 90° clockwise each press (wrapping back around after a full turn). It rotates the shared source for **both** sides at once and re-compresses them in the new orientation.
- **Range & default:** Fixed +90° per click; starts un-rotated.
- **How to choose:** Use it to straighten a sideways photo before you download. If you have **Resize** turned on, rotating a quarter-turn automatically swaps your width and height values so your resize settings stay correct for the new orientation (this happens for both sides whether or not resize is currently on).
- **Recommended starting point:** Only when the image needs straightening.

### Toggle smoothing (pixelated)

- **What it does:** Switches the on-screen preview between smooth scaling and **crisp, pixelated** scaling. It does **not** change the saved file — it only affects how the preview is drawn so you can see individual pixels.
- **Range & default:** On/off toggle, **off** by default (smooth). Note: this button is **not shown in Safari**.
- **How to choose:** Turn it on when you are zoomed in and want to inspect exact pixels (for pixel art, sharp edges, or to study compression blocks) without the browser blurring them.
- **Recommended starting point:** **Off** for normal viewing; turn **on** when zoomed in to inspect pixels.

### Toggle background

- **What it does:** Turns the dark backdrop behind the image on or off (it fades over about half a second). Useful for judging how a result — especially one with transparency — looks against a light vs. dark background.
- **Range & default:** On/off toggle; the dark backdrop is **on** by default (an 80%-opacity black). Toggling it off reveals the lighter app background.
- **How to choose:** Flip it when you are checking edges, halos, or transparent areas that might look fine on one background but bad on the other.
- **Recommended starting point:** Default (dark). Toggle to **light** to check transparency and edge fringing.

### Copy settings to the other side

- **What it does:** Copies this panel's complete settings (its format, that format's options, and its Resize/Reduce-palette state) onto the _other_ side in one click. The button is an arrow that points toward the side it will copy to.
- **Range & default:** Action button; lives in the **Edit** header (so it is hidden on a side set to "Original Image"). After copying, a "Settings copied across" message appears with an **Undo** option for a few seconds.
- **How to choose:** Use it to A/B two encoders from the same baseline — set one side up the way you like, copy it across, then change just the format on the other side to compare them fairly.
- **Recommended starting point:** Use whenever you want both sides to start from identical settings.

### Save side settings / Import saved side settings

- **What it does:** **Save** (the gear button) remembers this side's full setup — format, that format's options, and the Resize/Reduce-palette state — in your browser so it survives reloads and future images. **Import** (the gear-with-arrow button) applies your saved setup back onto this side.
- **Range & default:** Two action buttons in the **Edit** header (hidden on the "Original Image" side). Saving confirms with a "<Left/Right> side settings saved" message. Importing confirms with a "<Left/Right> side settings imported" message and offers **Undo**. **Import is greyed out until a valid saved setup exists** for that side — and it only enables if the stored data actually passes validation, not merely because something was saved.
- **How to choose:** Save the encoder + options you reach for most (your house WebP or AVIF recipe), then Import it on any new image instead of re-dialling every slider. Save is stored separately per side (left vs. right).
- **Recommended starting point:** Save once you've found settings you like; Import them on each new image.

### Download

- **What it does:** Downloads that side's result. The **Save** pill button in the panel footer is a real download link pointing at the freshly encoded file.
- **Range & default:** One download button per side, in the panel footer next to the result size and the size-change badge. It is **disabled** (dimmed, no link) while that side is still encoding or before its first result exists. A spinner appears over it while encoding — but only after a short delay, so quick encodes don't flash it.
- **How to choose:** The filename uses your original name with the new format's extension swapped in (for example `photo.webp`). The **Original** side downloads the untouched original file under its original name.
- **Recommended starting point:** Compare both sides first, then download the side with the best size/quality balance for you.

### Drag-and-drop to load or replace

- **What it does:** Lets you drop an image file **anywhere on the page** to load it — or, if the editor is already open, to replace the current image. This works because the whole app is a drop zone; the browser's default "open the file in a new tab" behaviour is suppressed.
- **Range & default:** Always active, on the intro screen and inside the editor. While you drag a file over the window, a coral dashed full-page overlay fades in to show it's a valid drop target. Drags that carry only text or links (no actual files) are ignored — no overlay, no interference. A dropped file whose type isn't an image is rejected with a "…doesn't look like an image." message and not loaded.
- **How to choose:** Drag from your file manager straight onto the page — faster than the "Select an image" button. Drop a new file mid-edit to swap images while keeping the editor open.
- **Recommended starting point:** Use it as the quick way to start or switch images.

### Back

- **What it does:** Closes the editor and returns to the intro/landing screen. It's the round "X" button in the top-left.
- **Range & default:** Action button, shown while an image is open. It uses the browser's history, so the browser **Back button** (or a back-swipe gesture) does the same thing — returns you to the intro screen.
- **How to choose:** Use it to drop the current image and start over.
- **Recommended starting point:** Use when you're done with the current image.

## Tips & pitfalls

- **The two sides always zoom, pan, and rotate together.** You drive one side and the other mirrors it exactly — that's deliberate, so before/after stays pixel-aligned. You can't zoom only one side.
- **Smoothing and background are preview-only.** Toggling them changes what _you_ see, not the saved file. Don't worry about leaving "pixelated" on before you download.
- **The hidden 1 / 2 / 3 split shortcut is suppressed while typing.** If a number field (like the zoom % or a resize input) has focus, those keys type digits instead of moving the split — click the image area first.
- **Rotate affects both sides and your resize numbers.** A quarter-turn swaps width/height in the Resize fields automatically, so don't be surprised to see those values flip.
- **Copy and Import both offer Undo, but only for a few seconds.** If you overwrite a side by mistake, grab the Undo before the message disappears.
- **Import stays greyed until you've Saved a valid setup** for that side — and Save/Import are per-side and per-browser; clearing site data forgets them.
- **The Original ("Original Image") side has no Edit header**, so Copy/Save/Import aren't shown there, and its download is the raw, unchanged file.
- **Wheel zoom works even over the drag handle.** Scrolling always zooms the image; only click-dragging on the handle moves the split.
- **Auto-fit only re-runs on real changes** — a new file, a dimension/orientation change, or a window resize. Re-compressing at the same size keeps your current zoom and pan.

## Under the hood

The image area is a `<two-up>` custom element containing two synced `<pinch-zoom>` panes; only the left pane is actually driven, and pointer/wheel events are cloned and re-dispatched to it so the right pane can mirror its transform — that's what keeps the two halves locked together. To keep the split aligned when a side is resized smaller than the source, each canvas's CSS box is pinned to the original source dimensions regardless of the resize settings — so a downscaled output stays in the same footprint (just softer, scaled up to fill it) instead of shrinking in place. The **"Contain"** fit method additionally applies CSS `object-fit: contain`, letterboxing the output inside that footprint without distortion.
