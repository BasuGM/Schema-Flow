// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { applyImportedSchema } from "@/components/import/apply-import";
import { Inspector } from "@/components/inspector/inspector";
import { TooltipProvider } from "@/components/ui/tooltip";
import { parseSchemaText } from "@/parsers";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { TableList } from "./table-list";

function Harness() {
  return (
    <TooltipProvider>
      <TableList />
      <Inspector />
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
    </TooltipProvider>
  );
}

function importSql(sql: string) {
  act(() => applyImportedSchema(parseSchemaText(sql).result.schema!, sql));
}

beforeEach(() => resetStores());

describe("schema-qualified table names (ADR-019)", () => {
  const SQL = `
CREATE TABLE users (id int PRIMARY KEY);
CREATE TABLE billing.users (id int PRIMARY KEY, user_id int REFERENCES public.users (id));
`;

  it("shows non-default schemas on the canvas and in the list, so same-named tables differ", async () => {
    render(<Harness />);
    importSql(SQL);
    expect(screen.getByTestId("table-node-users")).toHaveTextContent("users");
    expect(screen.getByTestId("table-node-billing.users")).toHaveTextContent("billing.users");
    expect(screen.getByTestId("table-list-item-billing.users")).toHaveTextContent("billing.users");

    await userEvent.type(screen.getByTestId("table-filter"), "billing.");
    expect(screen.queryByTestId("table-list-item-users")).toBeNull();
    expect(screen.getByTestId("table-list-item-billing.users")).toBeInTheDocument();
  });
});

describe("partitioned tables", () => {
  it("lists folded partitions in the inspector", async () => {
    render(<Harness />);
    importSql(`
CREATE TABLE events (id int) PARTITION BY RANGE (id);
CREATE TABLE events_a PARTITION OF events FOR VALUES FROM (0) TO (10);
CREATE TABLE events_b PARTITION OF events FOR VALUES FROM (10) TO (20);
`);
    expect(screen.queryByTestId("table-node-events_a")).toBeNull();
    act(() => useUiStore.getState().selectTable("public.events"));
    const partitions = screen.getByTestId("inspector-partitions");
    expect(partitions).toHaveTextContent("Partitioned · 2 partitions folded in");
    expect(partitions).toHaveTextContent("events_a, events_b");
  });
});
