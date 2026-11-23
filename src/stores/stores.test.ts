import { beforeEach, describe, expect, it } from "vitest";
import { validateSchema } from "@/domain/schema/validate";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { useLayoutStore } from "./layout-store";
import { useSchemaStore } from "./schema-store";
import { useUiStore } from "./ui-store";

const schema = createEcommerceSchema();

beforeEach(() => {
  useSchemaStore.getState().clear();
  useLayoutStore.setState({ layouts: {}, version: 0 });
  useUiStore.getState().reset();
});

describe("schema-store", () => {
  it("loads a schema with fingerprint and no issues", () => {
    useSchemaStore.getState().loadSchema(schema);
    const s = useSchemaStore.getState();
    expect(s.status).toBe("ready");
    expect(s.fingerprint).toMatch(/^sf1-/);
    expect(s.issues).toEqual([]);
  });
});

describe("schema-store issues", () => {
  it("does not duplicate validation issues an importer already added", () => {
    const broken = createEcommerceSchema();
    broken.tableOrder.push(broken.tableOrder[0]!);
    broken.issues = validateSchema(broken);
    expect(broken.issues).toEqual([
      { severity: "error", message: "tableOrder contains duplicate table IDs." },
    ]);
    useSchemaStore.getState().loadSchema(broken);
    expect(useSchemaStore.getState().issues).toEqual(broken.issues);
  });

  it("re-importing the same schema reuses its layout (no re-layout)", () => {
    const load = () => {
      useSchemaStore.getState().loadSchema(createEcommerceSchema());
      const { schema: s, fingerprint } = useSchemaStore.getState();
      useLayoutStore.getState().ensureLayout(s!, fingerprint!);
    };
    load();
    const version = useLayoutStore.getState().version;
    load();
    expect(useLayoutStore.getState().version).toBe(version);
  });
});

describe("layout-store", () => {
  it("computes a layout once per fingerprint and keeps manual positions", () => {
    const store = useLayoutStore.getState();
    store.ensureLayout(schema, "fp");
    const first = useLayoutStore.getState().layouts["fp"];
    expect(Object.keys(first?.positions ?? {})).toHaveLength(12);
    expect(first?.direction).toBe("LR");

    store.setPosition("fp", "public.users", { x: 1, y: 2 });
    store.ensureLayout(schema, "fp");
    expect(useLayoutStore.getState().layouts["fp"]?.positions["public.users"]).toEqual({
      x: 1,
      y: 2,
    });
    expect(useLayoutStore.getState().version).toBe(1);
  });

  it("re-layout replaces manual positions and bumps the version", () => {
    const store = useLayoutStore.getState();
    store.ensureLayout(schema, "fp");
    const auto = useLayoutStore.getState().layouts["fp"]?.positions["public.users"];
    store.setPosition("fp", "public.users", { x: 9999, y: 9999 });
    store.relayout(schema, "fp");
    expect(useLayoutStore.getState().layouts["fp"]?.positions["public.users"]).toEqual(auto);
    expect(useLayoutStore.getState().version).toBe(2);
  });

  it("ignores updates for unknown fingerprints", () => {
    useLayoutStore.getState().setPosition("nope", "x", { x: 0, y: 0 });
    useLayoutStore.getState().setViewport("nope", { x: 0, y: 0, zoom: 1 });
    expect(useLayoutStore.getState().layouts).toEqual({});
  });
});

describe("ui-store", () => {
  it("selects, focuses and clears tables", () => {
    const ui = useUiStore.getState();
    ui.selectTable("a");
    expect(useUiStore.getState().selectedTableId).toBe("a");
    ui.focusTable("b");
    ui.focusTable("b");
    expect(useUiStore.getState()).toMatchObject({
      selectedTableId: "b",
      focusRequest: { tableId: "b", nonce: 2 },
    });
    ui.selectTable(null);
    expect(useUiStore.getState().selectedTableId).toBeNull();
  });

  it("does not notify subscribers when selecting the already-selected table", () => {
    useUiStore.getState().selectTable("a");
    let calls = 0;
    const unsub = useUiStore.subscribe(() => (calls += 1));
    useUiStore.getState().selectTable("a");
    useUiStore.getState().setPanelOpen("left", true);
    unsub();
    expect(calls).toBe(0);
  });
});

describe("subject area visibility (P4-T03)", () => {
  it("hides, shows only, shows all, and resets for a new schema", () => {
    const ui = useUiStore.getState();
    ui.setAreaVisible("a", false);
    ui.setAreaVisible("b", false);
    expect([...useUiStore.getState().hiddenAreas]).toEqual(["a", "b"]);
    useUiStore.getState().showOnlyArea("b", ["a", "b", "c"]);
    expect([...useUiStore.getState().hiddenAreas]).toEqual(["a", "c"]);
    const before = useUiStore.getState().hiddenAreas;
    useUiStore.getState().showOnlyArea("b", ["a", "b", "c"]);
    expect(useUiStore.getState().hiddenAreas).toBe(before);
    useUiStore.getState().showAllAreas();
    expect(useUiStore.getState().hiddenAreas.size).toBe(0);
    useUiStore.getState().setAreaVisible("a", false);
    useUiStore.getState().resetForNewSchema();
    expect(useUiStore.getState().hiddenAreas.size).toBe(0);
  });
});

describe("ui-store commands (P4-T04)", () => {
  it("opens and closes the import and shortcuts dialogs, idempotently", () => {
    const ui = useUiStore.getState();
    ui.setImportOpen(true);
    ui.setShortcutsOpen(true);
    expect(useUiStore.getState().importOpen).toBe(true);
    expect(useUiStore.getState().shortcutsOpen).toBe(true);
    const before = useUiStore.getState();
    useUiStore.getState().setImportOpen(true);
    expect(useUiStore.getState()).toBe(before);
    useUiStore.getState().setImportOpen(false);
    useUiStore.getState().setShortcutsOpen(false);
    expect(useUiStore.getState().importOpen).toBe(false);
    expect(useUiStore.getState().shortcutsOpen).toBe(false);
  });
  it("counts reset-view requests", () => {
    useUiStore.getState().requestResetView();
    useUiStore.getState().requestResetView();
    expect(useUiStore.getState().resetViewRequest).toBe(2);
  });
});
