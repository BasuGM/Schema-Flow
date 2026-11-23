"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { displayTableName } from "@/domain/schema/selectors";
import type { PathHop } from "@/domain/schema/path";
import type { Schema, TableId } from "@/domain/schema/types";
import { revealTable, showPath } from "@/stores/reveal";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { formatColumns } from "./column-names";
import { focusInInspector } from "./focus-inspector";
import { TablePicker } from "./table-picker";

const tableName = (schema: Schema, id: TableId) => {
  const t = schema.tables[id];
  return t ? displayTableName(schema, t) : id;
};

/**
 * Path finder (P4-T02): the shortest chain of foreign keys from the selected table to a table
 * picked here. The result is highlighted on the canvas until cleared.
 */
export function PathTab({ tableId, sheet }: { tableId: TableId; sheet: boolean }) {
  const schema = useSchemaStore((s) => s.schema);
  const active = useUiStore((s) => s.activePath);
  const [notConnected, setNotConnected] = useState<TableId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  if (!schema) return null;

  const pick = (to: TableId) => {
    const found = showPath(tableId, to);
    setNotConnected(found ? null : to);
  };
  const clear = () => {
    useUiStore.getState().setActivePath(null);
    setNotConnected(null);
    inputRef.current?.focus();
  };
  const show = () => {
    if (!active) return;
    useUiStore.getState().fitTables(active.path.tables);
    if (sheet) useUiStore.getState().setPanelOpen("right", false);
  };

  const from = active ? tableName(schema, active.from) : "";
  const to = active ? tableName(schema, active.to) : "";
  const hops = active?.path.hops.length ?? 0;
  const summary = active
    ? `${from} → ${to}: ${hops} ${hops === 1 ? "hop" : "hops"}`
    : notConnected
      ? `No path between ${tableName(schema, tableId)} and ${tableName(schema, notConnected)}`
      : "";

  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-3">
      <p className="text-xs text-muted-foreground">
        Find the shortest chain of foreign keys from{" "}
        <span className="font-medium text-foreground">{tableName(schema, tableId)}</span> to another
        table.
      </p>
      <TablePicker schema={schema} exclude={tableId} onPick={pick} inputRef={inputRef} />
      <p role="status" className="sr-only">
        {summary}
      </p>
      {notConnected && !active && (
        <p className="text-xs" data-testid="path-none">
          {summary} (no chain of foreign keys connects them).
        </p>
      )}
      {active && (
        <section aria-label="Path" data-testid="path-result" className="flex flex-col gap-2">
          {active.from !== tableId && (
            <p className="text-[11px] text-muted-foreground">Path from {from}</p>
          )}
          <p className="text-sm font-medium" data-testid="path-summary">
            {summary}
          </p>
          <ol className="flex flex-col gap-1.5" data-testid="path-hops">
            {active.path.hops.map((hop) => (
              <HopRow key={`${hop.relationshipId}-${hop.from}`} hop={hop} schema={schema} />
            ))}
          </ol>
          <div className="flex gap-2">
            <Button size="sm" onClick={show} data-testid="path-show">
              Show on canvas
            </Button>
            <Button size="sm" variant="outline" onClick={clear} data-testid="path-clear">
              Clear
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

function TableButton({ schema, id }: { schema: Schema; id: TableId }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        const button = e.currentTarget;
        revealTable(id, undefined, { tab: "path" });
        focusInInspector(button, "inspector-title");
      }}
      aria-label={`Show table ${tableName(schema, id)}`}
      className="rounded-sm font-medium text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {tableName(schema, id)}
    </button>
  );
}

/** One hop: the walk (`a references b` / `a referenced by b`) and the FK, always child → parent. */
function HopRow({ hop, schema }: { hop: PathHop; schema: Schema }) {
  const r = schema.relationships[hop.relationshipId];
  if (!r) return null;
  const cols = (end: typeof r.from) =>
    formatColumns(
      end.columnIds.map((id) => ({
        name: schema.tables[end.tableId]?.columns.find((c) => c.id === id)?.name ?? id,
      })),
    );
  return (
    <li className="rounded-md border px-2 py-1.5 text-xs" data-testid="path-hop">
      <div className="flex flex-wrap items-baseline gap-x-1">
        <TableButton schema={schema} id={hop.from} />{" "}
        <span className="text-muted-foreground">
          {hop.direction === "references" ? "references" : "referenced by"}
        </span>{" "}
        <TableButton schema={schema} id={hop.to} />
      </div>
      <div className="mt-0.5 font-mono text-[11px] break-all text-muted-foreground">
        {tableName(schema, r.from.tableId)}.{cols(r.from)} → {tableName(schema, r.to.tableId)}.
        {cols(r.to)}
      </div>
    </li>
  );
}
