"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { KeyRound, Link2, Table2 } from "lucide-react";
import { memo } from "react";
import { displayTableName } from "@/domain/schema/selectors";
import type { Column, ColumnId, Table } from "@/domain/schema/types";
import { columnHandleId, headerHandleId } from "@/graph/handles";
import {
  NODE_HEADER_HEIGHT,
  NODE_ROW_HEIGHT,
  NODE_WIDTH,
  renderedColumns,
  visibleColumns,
} from "@/graph/node-metrics";
import type { TableFlowNode } from "@/graph/types";
import { cn } from "@/lib/utils";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

function TableNodeComponent({ id, data }: NodeProps<TableFlowNode>) {
  const table = useSchemaStore((s) => s.schema?.tables[data.tableId]);
  // `billing.invoices` outside the source's default schema, so same-named tables stay distinct.
  const title = useSchemaStore((s) => {
    const t = s.schema?.tables[data.tableId];
    return s.schema && t ? displayTableName(s.schema, t) : "";
  });
  const selected = useUiStore((s) => s.selectedTableId === id);
  // Neighbourhood highlighting (P2-T09): a boolean, so only nodes whose state flips re-render.
  const dimmed = useUiStore((s) => s.focusSet !== null && !s.focusSet.has(id));
  // A primitive per node: only the node that owns the highlighted column re-renders.
  const highlighted = useUiStore((s) =>
    s.highlightedColumn?.tableId === id ? s.highlightedColumn.columnId : null,
  );
  if (!table) return null;
  const hasRows = renderedColumns(table, data.mode, highlighted).length > 0;

  return (
    <div
      data-testid={`table-node-${title}`}
      data-selected={selected}
      data-dimmed={dimmed || undefined}
      style={{ width: NODE_WIDTH }}
      className={cn(
        "table-node rounded-lg border bg-card text-card-foreground shadow-sm",
        selected ? "border-brand ring-2 ring-brand/40" : "hover:shadow-md",
      )}
    >
      <div
        style={{ height: NODE_HEADER_HEIGHT }}
        className={cn(
          "relative flex items-center gap-2 rounded-t-lg px-3",
          hasRows && "border-b",
          selected ? "bg-brand-muted" : "bg-muted/60",
        )}
      >
        <Table2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="truncate text-sm font-semibold" title={table.id}>
          {title}
        </span>
        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
          {table.columns.length}
        </span>
        <Handle
          type="source"
          position={Position.Left}
          id={headerHandleId(table.id, "source")}
          className="column-handle"
          isConnectable={false}
        />
        <Handle
          type="target"
          position={Position.Right}
          id={headerHandleId(table.id, "target")}
          className="column-handle"
          isConnectable={false}
        />
      </div>
      {hasRows && <ColumnRows table={table} mode={data.mode} highlighted={highlighted} />}
    </div>
  );
}

/**
 * The column rows, memoized on their own inputs: selecting, dimming or un-dimming a table
 * re-renders only its header and frame, not every row and icon (P2-T10; a hub selection flips
 * ~150 nodes at once).
 */
const ColumnRows = memo(function ColumnRows({
  table,
  mode,
  highlighted,
}: {
  table: Table;
  mode: TableFlowNode["data"]["mode"];
  highlighted: ColumnId | null;
}) {
  const columns = renderedColumns(table, mode, highlighted);
  const revealedId =
    highlighted && !visibleColumns(table, mode).some((c) => c.id === highlighted)
      ? highlighted
      : null;
  return (
    <ul className="py-1.5">
      {columns.map((column) => (
        <ColumnRow
          key={column.id}
          column={column}
          highlighted={column.id === highlighted}
          revealed={column.id === revealedId}
        />
      ))}
    </ul>
  );
});

interface ColumnRowProps {
  column: Column;
  /** Found by search (P2-T07). */
  highlighted: boolean;
  /** Hidden by the node's collapse mode, shown only because it is highlighted. */
  revealed: boolean;
}

function ColumnRow({ column, highlighted, revealed }: ColumnRowProps) {
  const kind = column.isPrimaryKey
    ? "primary key"
    : column.isForeignKey
      ? "foreign key"
      : undefined;
  return (
    <li
      style={{ height: NODE_ROW_HEIGHT }}
      data-testid={`column-${column.name}`}
      data-pk={column.isPrimaryKey || undefined}
      data-fk={column.isForeignKey || undefined}
      data-highlighted={highlighted || undefined}
      data-revealed={revealed || undefined}
      title={revealed ? "Hidden column, shown because search found it" : undefined}
      className={cn(
        "relative flex items-center gap-2 px-3 text-xs",
        column.isPrimaryKey && "bg-pk/8",
        highlighted && "bg-brand-muted ring-2 ring-brand ring-inset",
        revealed && "italic",
      )}
    >
      <span className="flex w-3.5 shrink-0 justify-center" aria-hidden>
        {column.isPrimaryKey ? (
          <KeyRound data-testid="pk-icon" className="size-3 text-pk" />
        ) : column.isForeignKey ? (
          <Link2 data-testid="fk-icon" className="size-3 text-fk" />
        ) : null}
      </span>
      {kind && <span className="sr-only">{kind}</span>}
      <span className={cn("truncate", column.isPrimaryKey && "font-semibold")}>{column.name}</span>
      {column.isPrimaryKey && column.isForeignKey && (
        <Link2 aria-label="also a foreign key" className="size-3 shrink-0 text-fk" />
      )}
      <span className="ml-auto flex min-w-0 items-center gap-1 pl-2">
        <span
          className="truncate font-mono text-[11px] text-muted-foreground"
          title={column.dataType.raw}
        >
          {column.dataType.raw}
        </span>
        {column.nullable && (
          <span
            data-testid="nullable-marker"
            className="text-[10px] text-muted-foreground"
            title="Nullable"
          >
            null
          </span>
        )}
      </span>
      <Handle
        type="source"
        position={Position.Left}
        id={columnHandleId(column.id, "source")}
        className="column-handle"
        isConnectable={false}
      />
      <Handle
        type="target"
        position={Position.Right}
        id={columnHandleId(column.id, "target")}
        className="column-handle"
        isConnectable={false}
      />
    </li>
  );
}

export const TableNode = memo(TableNodeComponent);
