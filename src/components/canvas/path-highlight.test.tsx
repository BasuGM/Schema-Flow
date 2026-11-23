// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEscapeToClear } from "@/components/workspace/use-escape-to-clear";
import { showPath } from "@/stores/reveal";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { SchemaCanvas } from "./schema-canvas";

function Harness() {
  useEscapeToClear();
  return (
    <TooltipProvider>
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
    </TooltipProvider>
  );
}

const node = (name: string) => screen.getByTestId(`table-node-${name}`);
const onPathTables = () =>
  [...document.querySelectorAll('[data-testid^="table-node-"][data-on-path="true"]')].map((e) =>
    e.getAttribute("data-testid")!.replace("table-node-", ""),
  );
const litEdges = () =>
  [...document.querySelectorAll('.relationship-edge[data-on-path="true"]')].map((e) =>
    e.getAttribute("data-testid"),
  );

beforeEach(() => resetStores());

describe("Active path on the canvas (P4-T02)", () => {
  it("lights the path's tables and edges and dims everything else", () => {
    render(<Harness />);
    let path: ReturnType<typeof showPath> = null;
    act(() => {
      path = showPath("public.reviews", "public.coupons");
    });
    expect(path).not.toBeNull();
    const names = path!.tables.map((t) => t.replace("public.", ""));
    expect(onPathTables().sort()).toEqual([...names].sort());
    for (const name of names) expect(node(name)).not.toHaveAttribute("data-dimmed");
    expect(node("audit_log")).toHaveAttribute("data-dimmed", "true");
    expect(litEdges()).toHaveLength(path!.hops.length);
    const dimmedEdges = document.querySelectorAll('.relationship-edge[data-dimmed="true"]');
    const total = Object.keys(useSchemaStore.getState().schema!.relationships).length;
    expect(dimmedEdges).toHaveLength(total - path!.hops.length);
    for (const e of document.querySelectorAll('.relationship-edge[data-on-path="true"]'))
      expect(e).toHaveAttribute("data-edge-state", "highlighted");
  });

  it("survives selecting another table and hovering an edge", () => {
    render(<Harness />);
    act(() => void showPath("public.reviews", "public.coupons"));
    act(() => useUiStore.getState().selectTable("public.audit_log"));
    expect(useUiStore.getState().activePath).not.toBeNull();
    expect(onPathTables().length).toBeGreaterThan(1);
    fireEvent.mouseEnter(screen.getAllByTestId(/^edge-hit-/)[0]!);
    expect(useUiStore.getState().activePath).not.toBeNull();
  });

  it("Clear restores neighbourhood dimming of the selected table", () => {
    render(<Harness />);
    act(() => useUiStore.getState().selectTable("public.orders"));
    const before = [...useUiStore.getState().focusSet!].sort();
    act(() => void showPath("public.reviews", "public.coupons"));
    expect([...useUiStore.getState().focusSet!].sort()).not.toEqual(before);
    act(() => useUiStore.getState().setActivePath(null));
    expect([...useUiStore.getState().focusSet!].sort()).toEqual(before);
    expect(onPathTables()).toEqual([]);
  });

  it("a failed search, Escape and a new schema clear it", () => {
    render(<Harness />);
    act(() => void showPath("public.reviews", "public.coupons"));
    act(() => {
      expect(showPath("public.reviews", "public.nope")).toBeNull();
    });
    expect(useUiStore.getState().activePath).toBeNull();
    act(() => void showPath("public.reviews", "public.coupons"));
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(useUiStore.getState().activePath).toBeNull();
    expect(useUiStore.getState().focusSet).toBeNull();
    act(() => void showPath("public.reviews", "public.coupons"));
    act(() => useUiStore.getState().resetForNewSchema());
    expect(useUiStore.getState().activePath).toBeNull();
  });

  it("keeps on-path edges lit in the zoomed-out overview", () => {
    render(<Harness />);
    act(() => useUiStore.getState().setCanvasZoomedOut(true));
    act(() => void showPath("public.reviews", "public.coupons"));
    expect(litEdges().length).toBeGreaterThan(0);
  });

  it("fitTables bumps a distinct request each time", () => {
    const ui = useUiStore.getState();
    ui.fitTables(["a"]);
    const first = useUiStore.getState().fitRequest!.nonce;
    ui.fitTables(["a"]);
    expect(useUiStore.getState().fitRequest!.nonce).toBe(first + 1);
  });
});
