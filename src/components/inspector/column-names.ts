/** `id`, or `(a, b)` for a composite key. */
export const formatColumns = (cols: { name: string }[]): string =>
  cols.length === 1 ? cols[0]!.name : `(${cols.map((c) => c.name).join(", ")})`;
