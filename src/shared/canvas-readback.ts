// Every canvas readback whose pixels get encoded, scored, or shown as an
// output goes through readPixels, on the main thread and in workers.
//
// WebKit draws through its GPU process. When that process dies during a
// draw, the readback either throws or, worse, returns all zero bytes with no
// error: a blank frame that encodes to a fully transparent file the user can
// save. Measured 2026-11-19 by killing the process mid-decode. Drawing again
// at once fails the same way; after one task WebKit has relaunched the
// process and the draw succeeds. A source that really is transparent black
// (an empty SVG, say) draws blank twice and is kept, so one retry is the
// whole cost.

/** True when every byte is zero. Stops at the first nonzero pixel, so a
 *  normal frame costs a few reads. */
export function isBlankFrame(image: ImageData): boolean {
  return new Uint32Array(
    image.data.buffer,
    image.data.byteOffset,
    image.data.byteLength >> 2,
  ).every((word) => word === 0);
}

/** `draw`'s frame, drawn once more after a task when the first attempt threw
 *  or came back blank. `draw` must start from scratch each call (a new
 *  canvas, and a new bitmap when it decodes), since the failed attempt's
 *  canvas belongs to the dead process. The second attempt's result or error
 *  is final. */
export async function readPixels(
  draw: () => ImageData | Promise<ImageData>,
): Promise<ImageData> {
  try {
    const image = await draw();
    if (!isBlankFrame(image)) return image;
  } catch {
    // Retried below; a real failure fails again and surfaces from there.
  }
  await new Promise((resolve) => setTimeout(resolve));
  return draw();
}
