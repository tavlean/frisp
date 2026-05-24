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
  const fileName =
    lastSlash === -1 ? trimmedName : trimmedName.slice(lastSlash + 1);
  const lastDot = fileName.lastIndexOf('.');
  const baseName =
    lastDot > 0 ? fileName.slice(0, lastDot) : fileName.replace(/\.+$/, '');
  const sanitizedBaseName = baseName
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/\s*-\s*/g, '-')
    .replace(/^[\s-]+|[\s-]+$/g, '')
    .trim();
  const safeBaseName = sanitizedBaseName || 'image';
  const reservedSafeBaseName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(
    safeBaseName,
  )
    ? `${safeBaseName}-file`
    : safeBaseName;

  return `${reservedSafeBaseName}.${normalizedExtension}`;
}
