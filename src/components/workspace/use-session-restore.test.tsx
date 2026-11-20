// @vitest-environment jsdom
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fingerprintSchema } from "@/domain/schema/fingerprint";
import { setSessionBackend } from "@/lib/session-db";
import { parseSchemaText } from "@/parsers";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { flushPendingSaves } from "@/stores/layout-persistence";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { SESSION_RECORD_KEY, SESSION_UI_KEY } from "@/stores/session-persistence";
import { useUiStore } from "@/stores/ui-store";
import { FakeSessionBackend } from "@/test/fake-session-backend";
import { resetStores } from "@/test/store-helpers";
import { useSessionRestore } from "./use-session-restore";

const SQL =
  "CREATE TABLE authors (id integer primary key);\n" +
  "CREATE TABLE books (id integer primary key, author_id integer references authors(id));";
const record = { v: 1, text: SQL, format: "sqlite", name: "Library", savedAt: 1 };
let backend: FakeSessionBackend;

const setUrl = (search: string) => window.history.pushState({}, "", `/${search}`);

beforeEach(() => {
  localStorage.clear();
  resetStores(null);
  backend = new FakeSessionBackend();
  setSessionBackend(backend);
  setUrl("");
});
afterEach(() => {
  setSessionBackend(undefined);
  setUrl("");
});

const schemaName = () => useSchemaStore.getState().schema?.name;

describe("useSessionRestore", () => {
  it("loads the default sample when there is no session", async () => {
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe(createEcommerceSchema().name));
  });

  it("restores the saved import with its selection and tab", async () => {
    backend.data.set(SESSION_RECORD_KEY, record);
    const parsed = parseSchemaText(SQL, { format: "sqlite", name: "Library" }).result.schema!;
    localStorage.setItem(
      SESSION_UI_KEY,
      JSON.stringify({
        fingerprint: fingerprintSchema(parsed),
        selectedTableId: parsed.tableOrder[1],
        inspectorTab: "relations",
      }),
    );
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe("Library"));
    expect(useSchemaStore.getState().restoring).toBeNull();
    expect(useSchemaStore.getState().sourceText).toBe(SQL);
    expect(useUiStore.getState().selectedTableId).toBe(parsed.tableOrder[1]);
    expect(useUiStore.getState().inspectorTab).toBe("relations");
    expect(document.activeElement).toBe(document.body);
  });

  it("ignores a selection saved for a different schema", async () => {
    backend.data.set(SESSION_RECORD_KEY, record);
    localStorage.setItem(
      SESSION_UI_KEY,
      JSON.stringify({ fingerprint: "other", selectedTableId: "books", inspectorTab: "keys" }),
    );
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe("Library"));
    expect(useUiStore.getState().selectedTableId).toBeNull();
    expect(useUiStore.getState().inspectorTab).toBe("columns");
  });

  it("queues the saved viewport once for the canvas", async () => {
    backend.data.set(SESSION_RECORD_KEY, record);
    const parsed = parseSchemaText(SQL, { format: "sqlite", name: "Library" }).result.schema!;
    const fp = fingerprintSchema(parsed);
    useLayoutStore.getState().ensureLayout(parsed, fp);
    useLayoutStore.getState().setViewport(fp, { x: 10, y: 20, zoom: 0.5 });
    flushPendingSaves(); // the layout is saved with its viewport; the restore loads it back
    useLayoutStore.setState({ layouts: {} });
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe("Library"));
    expect(useLayoutStore.getState().takePendingViewport()).toEqual({ x: 10, y: 20, zoom: 0.5 });
    expect(useLayoutStore.getState().takePendingViewport()).toBeNull();
  });

  it("lets ?sample= win and leaves the session alone", async () => {
    backend.data.set(SESSION_RECORD_KEY, record);
    setUrl("?sample=ecommerce");
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe(createEcommerceSchema().name));
    expect(backend.gets).toBe(0);
    expect(backend.data.get(SESSION_RECORD_KEY)).toEqual(record);
  });

  it("falls back to the sample and deletes a corrupt record", async () => {
    backend.data.set(SESSION_RECORD_KEY, { v: 9 });
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe(createEcommerceSchema().name));
    await waitFor(() => expect(backend.data.has(SESSION_RECORD_KEY)).toBe(false));
  });

  it("falls back to the sample when the store fails", async () => {
    backend.mode = "fail";
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe(createEcommerceSchema().name));
  });

  it("falls back to the sample and deletes a record with no tables", async () => {
    backend.data.set(SESSION_RECORD_KEY, {
      ...record,
      text: "not a schema at all",
      format: "prisma",
    });
    renderHook(() => useSessionRestore());
    await waitFor(() => expect(schemaName()).toBe(createEcommerceSchema().name));
    await waitFor(() => expect(backend.data.has(SESSION_RECORD_KEY)).toBe(false));
    expect(useSchemaStore.getState().restoring).toBeNull();
  });

  it("drops a restore that finishes after something else was loaded", async () => {
    backend.data.set(SESSION_RECORD_KEY, record);
    backend.holdGets();
    renderHook(() => useSessionRestore());
    useSchemaStore.getState().loadSchema(createEcommerceSchema());
    backend.releaseGets();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(schemaName()).toBe(createEcommerceSchema().name);
    expect(useSchemaStore.getState().restoring).toBeNull();
  });
});
