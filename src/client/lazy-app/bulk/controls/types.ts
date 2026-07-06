export interface BulkControl<T extends object> {
  id: string;
  label: string;
  fields: readonly Extract<keyof T, string>[];
  equal?: (a: T, b: T) => boolean;
  apply: (source: T, target: T) => void;
}

type BulkControlDefinition<T extends object> = Omit<BulkControl<T>, 'apply'> &
  Partial<Pick<BulkControl<T>, 'apply'>>;

export function fieldsEqual<T extends object>(
  fields: readonly Extract<keyof T, string>[],
  a: T,
  b: T,
): boolean {
  return fields.every((field) => a[field] === b[field]);
}

export function applyFields<T extends object>(
  fields: readonly Extract<keyof T, string>[],
  source: T,
  target: T,
): void {
  for (const field of fields) {
    target[field] = source[field];
  }
}

export function defineControl<T extends object>(
  control: BulkControlDefinition<T>,
): BulkControl<T> {
  return {
    ...control,
    equal: control.equal ?? ((a, b) => fieldsEqual(control.fields, a, b)),
    apply:
      control.apply ??
      ((source, target) => applyFields(control.fields, source, target)),
  };
}
