// Shrink-only presets. This app is an optimizer, not an upscaler — it has no
// super-resolution, so enlarging just spreads existing pixels (blurry, more
// bytes, no real detail). Anyone who genuinely needs a larger output (e.g.
// hitting an exact dimension, or hqx pixel-art magnification) can still type
// values into the Custom width/height fields.
export const sizePresets = [0.25, 0.5, 1];

export interface ResizePresetSize {
  width: number;
  height: number;
}

export function getResizePresetSize(
  inputWidth: number,
  inputHeight: number,
  preset: number,
): ResizePresetSize {
  return {
    width: Math.round(inputWidth * preset),
    height: Math.round(inputHeight * preset),
  };
}

export function getMatchingResizePreset(
  outputSize: ResizePresetSize,
  inputWidth: number,
  inputHeight: number,
  presets: readonly number[] = sizePresets,
): number | 'custom' {
  for (const preset of presets) {
    const presetSize = getResizePresetSize(inputWidth, inputHeight, preset);
    if (
      outputSize.width === presetSize.width &&
      outputSize.height === presetSize.height
    ) {
      return preset;
    }
  }

  return 'custom';
}
