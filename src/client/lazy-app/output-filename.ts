export function getOutputFileName(
  sourceFilename: string,
  extension: string,
): string {
  const normalizedExtension = extension.replace(/^\.+/, '');
  const fallbackName = `image.${normalizedExtension}`;
  const trimmedName = sourceFilename.trim();
  if (!trimmedName || !normalizedExtension) return fallbackName;

  const lastSlash = Math.max(
    trimmedName.lastIndexOf('/'),
    trimmedName.lastIndexOf('\\'),
  );
  const directory = lastSlash === -1 ? '' : trimmedName.slice(0, lastSlash + 1);
  const fileName =
    lastSlash === -1 ? trimmedName : trimmedName.slice(lastSlash + 1);
  const lastDot = fileName.lastIndexOf('.');
  const baseName =
    lastDot > 0 ? fileName.slice(0, lastDot) : fileName.replace(/\.+$/, '');
  const safeBaseName = baseName || 'image';

  return `${directory}${safeBaseName}.${normalizedExtension}`;
}
