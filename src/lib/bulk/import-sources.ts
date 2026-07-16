export interface ImportedFile {
  file: File;
  /** Path inside a picked/dropped folder, e.g. "trip/day1/img.jpg". */
  relativePath?: string;
}

interface WebkitFileEntry {
  isFile: true;
  isDirectory: false;
  name: string;
  fullPath: string;
  file(
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void,
  ): void;
}

interface WebkitDirectoryReader {
  readEntries(
    successCallback: (entries: WebkitEntry[]) => void,
    errorCallback?: (error: DOMException) => void,
  ): void;
}

interface WebkitDirectoryEntry {
  isFile: false;
  isDirectory: true;
  name: string;
  fullPath: string;
  createReader(): WebkitDirectoryReader;
}

type WebkitEntry = WebkitFileEntry | WebkitDirectoryEntry;

type WebkitDataTransferItem = DataTransferItem & {
  webkitGetAsEntry?: () => WebkitEntry | null;
};

export function shouldSkipEntryName(name: string): boolean {
  return name.startsWith('.');
}

export function normalizeRelativePath(
  path: string | undefined,
): string | undefined {
  if (!path) return undefined;
  const normalized = path.replace(/^\/+/, '');
  return normalized || undefined;
}

/** Picker files: webkitRelativePath is set for webkitdirectory picks. */
export function fromFileList(list: FileList | File[]): ImportedFile[] {
  return Array.from(list).map((file) => {
    const relativePath = normalizeRelativePath(file.webkitRelativePath);
    return relativePath ? { file, relativePath } : { file };
  });
}

type SnapshotItem =
  | { kind: 'file'; file: File }
  | { kind: 'directory'; entry: WebkitDirectoryEntry };

/** Drop: walks directory entries recursively; plain files pass through.
 *  Skips dot-files/dirs (.DS_Store etc.). */
export async function fromDataTransfer(
  dataTransfer: DataTransfer,
): Promise<ImportedFile[]> {
  const snapshot = snapshotItems(dataTransfer.items);
  if (snapshot.length === 0) {
    return Array.from(dataTransfer.files).map((file) => ({ file }));
  }

  const imported = await Promise.all(
    snapshot.map((item) => {
      if (item.kind === 'file') {
        return shouldSkipEntryName(item.file.name) ? [] : [{ file: item.file }];
      }
      return walkEntry(item.entry);
    }),
  );
  return imported.flat();
}

/** The item list is only readable during the drop event, so it must be
 *  snapshotted synchronously. Plain files come straight off getAsFile();
 *  only directories need the webkit entry walk. (Never read plain files
 *  through their entry's async file(): Safari can hand out entries whose
 *  file() rejects with NotFoundError while getAsFile() works — the old
 *  entry-first path turned such drops into a silent no-op.) */
function snapshotItems(
  items: DataTransferItemList | undefined,
): SnapshotItem[] {
  if (!items) return [];

  const snapshot: SnapshotItem[] = [];
  for (const item of Array.from(items) as WebkitDataTransferItem[]) {
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.() as WebkitEntry | null | undefined;
    if (entry?.isDirectory) {
      snapshot.push({ kind: 'directory', entry });
      continue;
    }
    const file = item.getAsFile();
    if (file) snapshot.push({ kind: 'file', file });
  }
  return snapshot;
}

/** Recursive directory walk; every file keeps its path inside the folder. */
async function walkEntry(entry: WebkitEntry): Promise<ImportedFile[]> {
  if (shouldSkipEntryName(entry.name)) return [];

  if (entry.isFile) {
    const file = await readFileEntry(entry);
    if (!file) return [];
    const relativePath = normalizeRelativePath(entry.fullPath);
    return [relativePath ? { file, relativePath } : { file }];
  }

  const children = await readAllDirectoryEntries(entry.createReader());
  const imported = await Promise.all(children.map(walkEntry));
  return imported.flat();
}

function readFileEntry(entry: WebkitFileEntry): Promise<File | undefined> {
  return new Promise((resolve) => {
    entry.file(resolve, () => resolve(undefined));
  });
}

async function readAllDirectoryEntries(
  reader: WebkitDirectoryReader,
): Promise<WebkitEntry[]> {
  const entries: WebkitEntry[] = [];

  while (true) {
    const batch = await readDirectoryBatch(reader);
    if (batch.length === 0) return entries;
    entries.push(...batch);
  }
}

function readDirectoryBatch(
  reader: WebkitDirectoryReader,
): Promise<WebkitEntry[]> {
  return new Promise((resolve) => {
    reader.readEntries(resolve, () => resolve([]));
  });
}
