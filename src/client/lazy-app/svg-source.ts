/** Whether a file is an SVG source. The one sniffer the editor, bulk, and the
 *  SVG lane share: two would be two answers. */
export function isSvgSource(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}
