# Bulk optimization

> Compress several images in one batch, compare any image before you save, and
> download the finished set as a ZIP — still entirely in your browser.

## Overview / When to use it

Use bulk optimization when you have a group of images that should get the same
basic treatment: a website gallery, screenshots for a post, product photos, or
a folder of assets that all need to be smaller.

Bulk mode keeps the same local-first promise as the single-image editor. Frisp
reads, previews, compresses, and zips the images on your own device. Nothing is
uploaded.

## Importing several images

There are three common ways to start:

- Drag several image files — or a whole folder — onto Frisp.
- Click **Browse files** in the middle and pick more than one image.
- Paste an image with ⌘/Ctrl+V, or the quiet **paste** action next to **Browse files**.

If you import **2 or more supported images**, Frisp opens the batch view. If you
import **1 image**, Frisp opens the normal single-image editor exactly as before.
While a batch is already open, dropping or choosing more images appends them to
the same batch.

Folder import walks the whole folder, including sub-folders. Hidden dot-files
and dot-folders, such as `.DS_Store`, are skipped.

## Global settings and per-image tweaks

Bulk starts with one set of settings for the whole batch. Change the main
settings and every image that still follows the batch recipe is recompressed.

Click an image when it needs special treatment. Changes you make while that
image is selected become that image's own tweak, while untouched settings keep
following the batch. A small dot marks images and controls that have custom
settings, so you can tell what no longer matches the global recipe.

Selecting every image is the same as editing the global settings.

If you change settings while an image is still compressing, Frisp finishes that
pass and then compresses the image again with the new settings, so no image is
left on old settings. Removing an image while it is compressing does not hold up
the rest of the batch.

The bulk focus view has **no Rotate button**. A batch has no rotation setting,
so rotating only changed the preview, never the exported file, and the button
was removed on 2026-11-04. To rotate an image, open it on its own in the
single-image editor. Rotation in bulk is planned with a future model where bulk
and the single editor share one recipe.

## Selecting images

Click an image in the strip to inspect it. Use **Cmd/Ctrl-click** to add or
remove one image from the selection, or **Shift-click** to select a range. On
desktop, you can also drag across the strip to sweep-select a range.

When several images are selected, changes apply to that selected group. Use this
when a few images need the same adjustment but the rest of the batch should stay
on the global settings.

## Strip size

The strip can show thumbnails at three sizes:

| Size | Best for |
| ---- | -------- |
| **S** | Seeing more images at once. |
| **M** | A balanced default. |
| **L** | Checking image content before opening it. |

Changing the strip size only changes the view. It does not change any saved
file.

## The stack view

When no single image is selected, the stage shows a stack of the batch. It is a
resting view, not a separate export mode: it keeps the work visible while the
right panel edits the global settings and the left panel shows batch totals.

Click an image in the strip to focus it and compare its original against its
optimized result.

## Save all as ZIP

When the batch is ready, click **Save all** to download one ZIP containing the
ready images. Files sit at the top level of the ZIP under safe, de-duplicated
names — two images that would produce the same output name get a numbered
suffix.

The **Keep originals when larger** toggle is on by default. With it on, if an
image's optimized version would be bigger than the original, Frisp puts the
original file in the ZIP instead. That keeps the batch from accidentally shipping
a larger file for that image. Turn it off only if you want the chosen format and
settings to be used even when the result grows.

The toggle only swaps in the original when the image's settings are a pure
re-encode. If **Resize**, **Film grain**, or **Reduce palette** changes the
pixels, the original is not what you asked for, so Frisp exports the encoded
result even when it is larger (since 2026-11-04; before that, a larger result
could silently undo your resize).

## Remove and Undo

Use the remove button on an image to take it out of the batch. Frisp shows a
short message with **Undo**; click it to restore the removed image before the
message disappears.

## Tips & pitfalls

- **One image still opens the normal editor.** Bulk only starts at 2 or more
  supported images.
- **Custom dots are useful checkpoints.** If a result surprises you, look for
  the dot first — that image may have a custom quality, effort, resize, or other
  setting.
- **Keep originals when larger protects the ZIP, not the preview.** You may
  still see that an optimized result is larger; the toggle decides what gets put
  into the ZIP.
- **SVGs in a batch become raster images.** Two or more SVGs opened together
  are rasterized to the batch format (WebP by default), not optimized as SVG.
  Open a single SVG on its own to keep it vector. This is a known gap, planned
  with the shared-recipe model.
- **Folder import is for reading, not saving back.** Frisp downloads a ZIP; it
  does not overwrite files in the folder you imported.
