// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_TIMEOUT_MS, setSessionBackend } from "@/lib/session-db";
import { FakeSessionBackend } from "@/test/fake-session-backend";
import { discardPendingSaves, LAYOUT_KEY_PREFIX } from "./layout-persistence";
import { enableSaving } from "./save-gate";
import {
  cancelSessionUiSave,
  clearAllSavedData,
  loadSession,
  loadSessionUi,
  resolveSessionFormat,
  saveSession,
  scheduleSessionUiSave,
  SESSION_RECORD_KEY,
  SESSION_UI_KEY,
  type SessionRecord,
} from "./session-persistence";
import { PREFS_KEY } from "./ui-store";

const record: SessionRecord = {
  v: 1,
  text: "CREATE TABLE a (id int);",
  format: "postgresql",
  name: "Mine",
  savedAt: 1,
};
let backend: FakeSessionBackend;

beforeEach(() => {
  localStorage.clear();
  backend = new FakeSessionBackend();
  setSessionBackend(backend);
  enableSaving();
  cancelSessionUiSave();
  discardPendingSaves();
});
afterEach(() => {
  vi.useRealTimers();
  setSessionBackend(undefined);
});

describe("session record", () => {
  it("round-trips an import", async () => {
    await saveSession(record);
    expect(await loadSession()).toEqual({ record, invalid: false });
  });

  it("is empty when nothing was saved", async () => {
    expect(await loadSession()).toEqual({ record: null, invalid: false });
  });

  it.each([
    ["a wrong version", { ...record, v: 2 }],
    ["an unknown format", { ...record, format: "oracle" }],
    ["no text", { ...record, text: "" }],
    ["text over the cap", { ...record, text: "x".repeat(5 * 1024 * 1024 + 1) }],
    ["a non-object", "nope"],
  ])("rejects %s as invalid", async (_label, value) => {
    backend.data.set(SESSION_RECORD_KEY, value);
    expect(await loadSession()).toEqual({ record: null, invalid: true });
  });

  it("gives up on a hanging store after the timeout", async () => {
    vi.useFakeTimers();
    backend.mode = "hang";
    const pending = loadSession();
    await vi.advanceTimersByTimeAsync(SESSION_TIMEOUT_MS);
    expect(await pending).toEqual({ record: null, invalid: false });
  });

  it("treats a failing store as empty and never throws", async () => {
    backend.mode = "fail";
    await expect(saveSession(record)).resolves.toBeUndefined();
    expect(await loadSession()).toEqual({ record: null, invalid: false });
  });

  it("resolves the stored format from the parse, not the choice", () => {
    expect(resolveSessionFormat({ format: "prisma" })).toBe("prisma");
    expect(resolveSessionFormat({ format: "sql", dialect: "mysql" })).toBe("mysql");
    expect(resolveSessionFormat({ format: "sql" }, "sqlite")).toBe("sqlite");
    expect(resolveSessionFormat({ format: "sql" })).toBe("auto");
  });
});

describe("selection record", () => {
  it("accepts a valid selection and rejects malformed ones", () => {
    localStorage.setItem(
      SESSION_UI_KEY,
      JSON.stringify({ fingerprint: "f", selectedTableId: "t", inspectorTab: "keys" }),
    );
    expect(loadSessionUi()).toEqual({
      fingerprint: "f",
      selectedTableId: "t",
      inspectorTab: "keys",
    });
    localStorage.setItem(
      SESSION_UI_KEY,
      JSON.stringify({ fingerprint: "f", selectedTableId: 3, inspectorTab: "keys" }),
    );
    expect(loadSessionUi()).toBeNull();
    localStorage.setItem(SESSION_UI_KEY, "{");
    expect(loadSessionUi()).toBeNull();
  });

  it("accepts the Path tab (P4-T02); the active path itself is never saved", () => {
    localStorage.setItem(
      SESSION_UI_KEY,
      JSON.stringify({ fingerprint: "f", selectedTableId: "t", inspectorTab: "path" }),
    );
    expect(loadSessionUi()).toEqual({
      fingerprint: "f",
      selectedTableId: "t",
      inspectorTab: "path",
    });
  });
});

describe("Clear saved data is final (amendment 1)", () => {
  it("removes every stored key and the record", async () => {
    await saveSession(record);
    localStorage.setItem(`${LAYOUT_KEY_PREFIX}abc`, "{}");
    localStorage.setItem(PREFS_KEY, "{}");
    localStorage.setItem(SESSION_UI_KEY, "{}");
    await clearAllSavedData();
    expect(localStorage.length).toBe(0);
    expect(backend.data.size).toBe(0);
  });

  it("cancels a selection save that was waiting for its debounce", async () => {
    vi.useFakeTimers();
    scheduleSessionUiSave(() => ({ fingerprint: "f", selectedTableId: "t", inspectorTab: "keys" }));
    await clearAllSavedData();
    await vi.advanceTimersByTimeAsync(1000);
    expect(localStorage.getItem(SESSION_UI_KEY)).toBeNull();
  });

  it("undoes a session write that was still in flight", async () => {
    backend.holdPuts = true;
    const saving = saveSession(record);
    await clearAllSavedData();
    backend.releasePuts();
    await saving;
    expect(backend.data.has(SESSION_RECORD_KEY)).toBe(false);
  });
});
