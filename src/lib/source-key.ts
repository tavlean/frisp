// Names a source File for the codec worker's source cache. Keyed on the File
// object itself, so reopening the same file reuses a worker's decoded frame
// and any other file misses; a WeakMap lets the name go with the File.

const keys = new WeakMap<File, string>();
let next = 0;

export function sourceKey(file: File): string {
  let key = keys.get(file);
  if (!key) {
    next += 1;
    key = `src-${next}`;
    keys.set(file, key);
  }
  return key;
}
