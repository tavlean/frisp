function getLastPathPart(value: string): string {
  const lastSlash = Math.max(value.lastIndexOf('/'), value.lastIndexOf('\\'));

  return lastSlash === -1 ? value : value.slice(lastSlash + 1);
}

export function getFileNameParts(fileName: string): {
  baseName: string;
  extension: string;
} {
  const normalizedName = getLastPathPart(fileName.trim()) || 'image';
  const lastDot = normalizedName.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === normalizedName.length - 1) {
    return {
      baseName: normalizedName.replace(/\.+$/, ''),
      extension: '',
    };
  }

  return {
    baseName: normalizedName.slice(0, lastDot),
    extension: normalizedName.slice(lastDot + 1),
  };
}

export function getSafeFileNameBase(
  value: string,
  fallbackName = 'image',
): string {
  const fileName = getLastPathPart(value.trim());
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
  const safeBaseName = sanitizedBaseName || fallbackName;
  const reservedSafeBaseName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(
    safeBaseName,
  )
    ? `${safeBaseName}-file`
    : safeBaseName;

  return reservedSafeBaseName;
}

export function getOutputFileName(
  sourceFilename: string,
  extension: string,
): string {
  const normalizedExtension = extension.replace(/^\.+/, '');
  if (!normalizedExtension) return getSafeFileNameBase(sourceFilename);
  return `${getSafeFileNameBase(sourceFilename)}.${normalizedExtension}`;
}
