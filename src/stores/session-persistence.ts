import type { SqlDialect } from "@/domain/schema/types";
import { deleteRecord, getRecord, putRecord } from "@/lib/session-db";
import { readJson, removeKey, writeText } from "@/lib/safe-storage";
import type { ImportFormatChoice } from "@/parsers";
import { PREFS_KEY } from "./ui-store";
import { clearSavedLayouts, discardPendingSaves } from "./layout-persistence";
import {
  bumpSaveGeneration,
  disableSaving,
  enableSaving,
  saveGeneration,
  savingEnabled,
} from "./save-gate";

/** IndexedDB record key of the last import (database `schemaflow`, store `session`). */
export const SESSION_RECORD_KEY = "current";
/** localStorage: the selection to restore with the session. */
export const SESSION_UI_KEY = "schemaflow:session-ui:v1";
/** Same cap as the import dialog (5 MB); a larger record is treated as corrupt. */
export const MAX_SESSION_CHARS = 5 * 1024 * 1024;
const CHANNEL_NAME = "schemaflow";

export interface SessionRecord {
  v: 1;
  /** The imported source text, re-parsed on restore (ADR-030). */
  text: string;
  /** The resolved format, so a restore never re-detects differently. */
  format: ImportFormatChoice;
  name: string;
  savedAt: number;
}

export type InspectorTabName = "columns" | "keys" | "relations";

export interface SessionUi {
  fingerprint: string;
  selectedTableId: string | null;
  inspectorTab: InspectorTabName;
}

const FORMATS: readonly ImportFormatChoice[] = ["auto", "postgresql", "mysql", "sqlite", "prisma"];
const TABS: readonly InspectorTabName[] = ["columns", "keys", "relations"];
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The format to store: what was parsed, not what was chosen ("auto" is only a last resort). */
export function resolveSessionFormat(
  parsed: { format: "sql" | "prisma" | "unknown"; dialect?: SqlDialect },
  schemaDialect?: SqlDialect,
): ImportFormatChoice {
  if (parsed.format === "prisma") return "prisma";
  return parsed.dialect ?? schemaDialect ?? "auto";
}

function parseRecord(raw: unknown): SessionRecord | null {
  if (!isRecord(raw) || raw.v !== 1) return null;
  const { text, format, name, savedAt } = raw;
  if (typeof text !== "string" || text.length === 0 || text.length > MAX_SESSION_CHARS) return null;
  const known = FORMATS.find((f) => f === format);
  if (!known || typeof name !== "string" || typeof savedAt !== "number") return null;
  return { v: 1, text, format: known, name, savedAt };
}

/** The saved import, or null when there is none, it is invalid, or IndexedDB is unavailable. */
export async function loadSession(): Promise<{ record: SessionRecord | null; invalid: boolean }> {
  const raw = await getRecord(SESSION_RECORD_KEY);
  if (raw === null) return { record: null, invalid: false };
  const record = parseRecord(raw);
  return { record, invalid: record === null };
}

/**
 * Saves the import as the session. Called only for an explicit import, which also lets this tab
 * save again after another tab cleared. A put still in flight when a clear happens undoes itself.
 */
export async function saveSession(record: SessionRecord): Promise<void> {
  enableSaving();
  const generation = saveGeneration();
  if (!(await putRecord(SESSION_RECORD_KEY, record))) return;
  if (generation !== saveGeneration()) await deleteRecord(SESSION_RECORD_KEY);
}

export const clearSession = (): Promise<boolean> => deleteRecord(SESSION_RECORD_KEY);

export function loadSessionUi(): SessionUi | null {
  const raw = readJson(SESSION_UI_KEY);
  if (!isRecord(raw) || typeof raw.fingerprint !== "string") return null;
  const tab = TABS.find((t) => t === raw.inspectorTab);
  const id = raw.selectedTableId;
  if (!tab || !(id === null || typeof id === "string")) return null;
  return { fingerprint: raw.fingerprint, selectedTableId: id, inspectorTab: tab };
}

export function saveSessionUi(ui: SessionUi): void {
  if (!savingEnabled()) return;
  writeText(SESSION_UI_KEY, JSON.stringify(ui));
}

// Debounced selection saves, flushed when the page is hidden.
let uiTimer: ReturnType<typeof setTimeout> | undefined;
let uiRead: (() => SessionUi | null) | undefined;
let listening = false;

export function cancelSessionUiSave(): void {
  clearTimeout(uiTimer);
  uiTimer = undefined;
  uiRead = undefined;
}

export function flushSessionUiSave(): void {
  const read = uiRead;
  cancelSessionUiSave();
  const ui = read?.();
  if (ui) saveSessionUi(ui);
}

export function scheduleSessionUiSave(read: () => SessionUi | null, delay = 300): void {
  if (!listening && typeof window !== "undefined") {
    listening = true;
    window.addEventListener("pagehide", flushSessionUiSave);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSessionUiSave();
    });
  }
  clearTimeout(uiTimer);
  uiRead = read;
  uiTimer = setTimeout(flushSessionUiSave, delay);
}

let channel: BroadcastChannel | null | undefined;

function broadcast(): BroadcastChannel | null {
  if (channel === undefined) {
    try {
      channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);
      channel?.addEventListener("message", (event: MessageEvent<unknown>) => {
        const data = event.data;
        if (isRecord(data) && data.type === "cleared") stopSavingAfterClear();
      });
    } catch {
      channel = null;
    }
  }
  return channel;
}

/** Another tab cleared the saved data: this tab stops writing until its next import. */
function stopSavingAfterClear(): void {
  bumpSaveGeneration();
  disableSaving();
  cancelSessionUiSave();
  discardPendingSaves();
}

/** Call once at startup so this tab hears a clear from another tab. */
export function listenForClears(): void {
  broadcast();
}

/**
 * Removes everything this app stores on the device and makes the clear final: pending saves are
 * cancelled, a session write still in flight undoes itself (`saveGeneration`), and other tabs stop
 * saving (BroadcastChannel; without it the multi-tab limit is documented in ADR-030).
 */
export function clearAllSavedData(): Promise<boolean> {
  bumpSaveGeneration();
  cancelSessionUiSave();
  discardPendingSaves();
  clearSavedLayouts();
  removeKey(PREFS_KEY);
  removeKey(SESSION_UI_KEY);
  try {
    broadcast()?.postMessage({ type: "cleared" });
  } catch {
    // The other tabs keep their own state; documented.
  }
  return clearSession();
}
