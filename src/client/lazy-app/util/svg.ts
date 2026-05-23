export interface SvgViewBoxSize {
  width: string;
  height: string;
}

export function parseSvgViewBoxSize(
  viewBox: string,
): SvgViewBoxSize | undefined {
  const viewBoxParts = viewBox.trim().split(/[\s,]+/);
  if (viewBoxParts.length !== 4) return;

  const [, , width, height] = viewBoxParts;
  if (!width || !height) return;

  return { width, height };
}
