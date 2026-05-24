export function getPercentChange(
  originalSize: number,
  outputSize: number,
): number {
  return originalSize ? (outputSize / originalSize - 1) * 100 : 0;
}
