/** An in-memory Storage with an optional byte limit, for persistence tests. */
export class FakeStorage implements Storage {
  private map = new Map<string, string>();
  constructor(private readonly limit = Infinity) {}
  get length() {
    return this.map.size;
  }
  key(i: number) {
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    const used = [...this.map].reduce(
      (n, [key, val]) => (key === k ? n : n + key.length + val.length),
      0,
    );
    if (used + k.length + v.length > this.limit) {
      throw new DOMException("full", "QuotaExceededError");
    }
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
  clear() {
    this.map.clear();
  }
  [name: string]: unknown;
}

/** Replaces `window.localStorage` (restore with the returned function). */
export function installStorage(storage: Storage | (() => never)): () => void {
  const original = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: typeof storage === "function" ? storage : () => storage,
  });
  return () => {
    if (original) Object.defineProperty(window, "localStorage", original);
  };
}
