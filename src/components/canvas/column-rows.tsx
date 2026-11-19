"use client";

import { Handle, Position } from "@xyflow/react";
import { KeyRound, Link2 } from "lucide-react";
import { memo } from "react";
import type { Column, ColumnId, Table } from "@/domain/schema/types";
import { columnHandleId, type EdgeEndColumns } from "@/graph/handles";
import { NODE_ROW_HEIGHT, renderedColumns, visibleColumns } from "@/graph/node-metrics";
import type { TableFlowNode } from "@/graph/types";
import { cn } from "@/lib/utils";

/**
 * A table node's column rows, memoized on their own inputs: selecting, dimming or un-dimming a
 * table re-renders only its header and frame, not every row and icon (P2-T10). Rows get a handle
 * only where an edge attaches (`ends`). A zoomed-out large schema renders one striped block
 * instead of the rows (ADR-023): same height and handle positions, a fraction of the elements.
 */
export const ColumnRows = memo(function ColumnRows({
  table,
  mode,
  highlighted,
  skeleton,
  ends,
}: {
  table: Table;
  mode: TableFlowNode["data"]["mode"];
  highlighted: ColumnId | null;
  skeleton: boolean;
  ends: EdgeEndColumns;
}) {
  const columns = renderedColumns(table, mode, highlighted);
  if (skeleton) return <SkeletonRows columns={columns} ends={ends} />;
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
          ends={ends}
        />
      ))}
    </ul>
  );
});

/** The handles edges attach to on this row (at most one per side). */
function RowHandles({
  column,
  ends,
  top,
}: {
  column: Column;
  ends: EdgeEndColumns;
  /** Absolute offset of the row's centre (skeleton block); rows otherwise centre them. */
  top?: number;
}) {
  const style = top === undefined ? undefined : { top };
  return (
    <>
      {ends.source.has(column.id) && (
        <Handle
          type="source"
          position={Position.Left}
          id={columnHandleId(column.id, "source")}
          className="column-handle"
          style={style}
          isConnectable={false}
        />
      )}
      {ends.target.has(column.id) && (
        <Handle
          type="target"
          position={Position.Right}
          id={columnHandleId(column.id, "target")}
          className="column-handle"
          style={style}
          isConnectable={false}
        />
      )}
    </>
  );
}

/** Rows at overview zoom: one block striped with a light bar per row, plus the edge handles. */
function SkeletonRows({ columns, ends }: { columns: readonly Column[]; ends: EdgeEndColumns }) {
  return (
    <div className="py-1.5" data-testid="skeleton-rows">
      <div
        className="skeleton-rows relative"
        style={{
          height: columns.length * NODE_ROW_HEIGHT,
          backgroundSize: `45% ${NODE_ROW_HEIGHT}px`,
        }}
      >
        {columns.map((column, i) => (
          <RowHandles
            key={column.id}
            column={column}
            ends={ends}
            top={i * NODE_ROW_HEIGHT + NODE_ROW_HEIGHT / 2}
          />
        ))}
      </div>
    </div>
  );
}

interface ColumnRowProps {
  column: Column;
  /** Found by search (P2-T07). */
  highlighted: boolean;
  /** Hidden by the node's collapse mode, shown only because it is highlighted. */
  revealed: boolean;
  ends: EdgeEndColumns;
}

function ColumnRow({ column, highlighted, revealed, ends }: ColumnRowProps) {
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
      <RowHandles column={column} ends={ends} />
    </li>
  );
}
