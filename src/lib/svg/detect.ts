export function isSvgSource(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}
