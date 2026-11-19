export type WriteResult = "ok" | "quota" | "failed";

/**
 * localStorage, or null when it is unavailable: server render, private mode, blocked site data
 * (reading the `localStorage` property itself can throw a SecurityError).
 */
function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function isQuotaError(error: unknown): boolean {
  const name =
    typeof error === "object" && error !== null ? (error as { name?: unknown }).name : "";
  return name === "QuotaExceededError" || name === "NS_ERROR_DOM_QUOTA_REACHED";
}

export function readText(key: string): string | null {
  try {
    return storage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

export function readJson(key: string): unknown {
  const text = readText(key);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Never throws: a failed write only means the value is not saved. */
export function writeText(key: string, value: string): WriteResult {
  try {
    const store = storage();
    if (!store) return "failed";
    store.setItem(key, value);
    return "ok";
  } catch (error) {
    return isQuotaError(error) ? "quota" : "failed";
  }
}

export function removeKey(key: string): void {
  try {
    storage()?.removeItem(key);
  } catch {
    // Nothing to do: the key stays.
  }
}

/** Every stored key starting with `prefix` (empty when storage is unavailable). */
export function listKeys(prefix: string): string[] {
  try {
    const store = storage();
    if (!store) return [];
    const keys: string[] = [];
    for (let i = 0; i < store.length; i++) {
      const key = store.key(i);
      if (key?.startsWith(prefix)) keys.push(key);
    }
    return keys;
  } catch {
    return [];
  }
}
