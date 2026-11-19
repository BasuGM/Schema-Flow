/**
 * A tiny key/value store on IndexedDB for the saved session (P3-T06, ADR-030). Every operation
 * resolves, never rejects: a blocked, throwing or hanging IndexedDB (private mode, a stuck upgrade)
 * gives `null` / `false` after at most `SESSION_TIMEOUT_MS`, and the app simply runs unsaved.
 */
export interface SessionBackend {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
}

const DB_NAME = "schemaflow";
const STORE = "session";
export const SESSION_TIMEOUT_MS = 2000;

function indexedDbBackend(): SessionBackend | null {
  let idb: IDBFactory | undefined;
  try {
    idb = typeof indexedDB === "undefined" ? undefined : indexedDB;
  } catch {
    return null;
  }
  if (!idb) return null;
  const factory = idb;

  let opened: Promise<IDBDatabase> | undefined;
  const open = (): Promise<IDBDatabase> => {
    opened ??= new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("blocked"));
    }).catch((error: unknown) => {
      opened = undefined; // try again next time
      throw error;
    });
    return opened;
  };

  const run = async <T>(
    mode: IDBTransactionMode,
    action: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> => {
    const db = await open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  };

  return {
    get: (key) => run("readonly", (s) => s.get(key)),
    put: (key, value) => run("readwrite", (s) => s.put(value, key)).then(() => undefined),
    remove: (key) => run("readwrite", (s) => s.delete(key)).then(() => undefined),
  };
}

/** Tests replace the backend; `undefined` means the real IndexedDB, `null` means none. */
let override: SessionBackend | null | undefined;
let real: SessionBackend | null | undefined;

export function setSessionBackend(backend: SessionBackend | null | undefined): void {
  override = backend;
}

function backend(): SessionBackend | null {
  if (override !== undefined) return override;
  real ??= indexedDbBackend();
  return real;
}

/** False where there is no IndexedDB at all (jsdom, some privacy modes): nothing to restore. */
export function hasSessionBackend(): boolean {
  return backend() !== null;
}

/** Settles with `fallback` when the operation fails, throws or takes over `SESSION_TIMEOUT_MS`. */
function settle<T>(start: (b: SessionBackend) => Promise<T>, fallback: T): Promise<T> {
  const b = backend();
  if (!b) return Promise.resolve(fallback);
  return new Promise<T>((resolve) => {
    const timer = setTimeout(() => resolve(fallback), SESSION_TIMEOUT_MS);
    Promise.resolve()
      .then(() => start(b))
      .then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        () => {
          clearTimeout(timer);
          resolve(fallback);
        },
      );
  });
}

export const getRecord = (key: string): Promise<unknown> =>
  settle((b) => b.get(key), null).then((v) => v ?? null);

export const putRecord = (key: string, value: unknown): Promise<boolean> =>
  settle((b) => b.put(key, value).then(() => true), false);

export const deleteRecord = (key: string): Promise<boolean> =>
  settle((b) => b.remove(key).then(() => true), false);
