"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";
import { ChevronRight, ChevronsDownUp, ChevronsUpDown, Table2 } from "lucide-react";
import { memo } from "react";
import type { CollapseMode } from "@/domain/schema/types";
import { displayTableName } from "@/domain/schema/selectors";
import { edgeEndColumns, headerHandleId, type EdgeEndColumns } from "@/graph/handles";
import { NODE_HEADER_HEIGHT, NODE_WIDTH, renderedColumns } from "@/graph/node-metrics";
import type { TableFlowNode } from "@/graph/types";
import { cn } from "@/lib/utils";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { ColumnRows } from "./column-rows";

const NEXT_MODE: Record<CollapseMode, CollapseMode> = {
  full: "keys",
  keys: "header",
  header: "full",
};
const MODE_LABEL: Record<CollapseMode, string> = {
  full: "all columns",
  keys: "keys only",
  header: "header only",
};
const MODE_ICON = { full: ChevronsDownUp, keys: ChevronsUpDown, header: ChevronRight } as const;

/** Cycles the table's collapse mode. Mouse-only; the keyboard path is the inspector control. */
function cycleMode(tableId: string, mode: CollapseMode) {
  const fingerprint = useSchemaStore.getState().fingerprint;
  if (fingerprint) useLayoutStore.getState().setCollapse(fingerprint, tableId, NEXT_MODE[mode]);
}

const NO_ENDS: EdgeEndColumns = { source: new Set(), target: new Set() };

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
  const onPath = useUiStore((s) => s.activePath?.tables.has(id) ?? false);
  // A primitive per node: only the node that owns the highlighted column re-renders.
  const highlighted = useUiStore((s) =>
    s.highlightedColumn?.tableId === id ? s.highlightedColumn.columnId : null,
  );
  // Zoomed-out large schema (ADR-023): rows as skeletons, so the overview stays cheap to restyle.
  const skeleton = useUiStore((s) => s.canvasZoomedOut);
  // Shared, cached per schema: which rows edges attach to (only those rows get handles).
  const ends = useSchemaStore((s) => (s.schema ? edgeEndColumns(s.schema) : NO_ENDS));
  if (!table) return null;
  const shown = renderedColumns(table, data.mode, highlighted).length;
  const hasRows = shown > 0;
  const total = table.columns.length;
  const ModeIcon = MODE_ICON[data.mode];

  return (
    <div
      data-testid={`table-node-${title}`}
      data-selected={selected}
      data-dimmed={dimmed || undefined}
      data-on-path={onPath || undefined}
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
        {!skeleton && <Table2 aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />}
        <span className="truncate text-sm font-semibold" title={table.id}>
          {title}
        </span>
        {!skeleton && (
          <span
            className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums"
            data-testid="node-column-count"
            {...(data.mode !== "full" && { "aria-label": `${shown} of ${total} columns shown` })}
          >
            {data.mode === "full" ? total : `${shown} / ${total}`}
          </span>
        )}
        {!skeleton && (
          <button
            type="button"
            tabIndex={-1}
            aria-label={`Collapse mode: ${MODE_LABEL[data.mode]} (click to change)`}
            data-testid="node-collapse-toggle"
            // Not a node drag, a pan or a selection click.
            className="nodrag nopan -mr-1 shrink-0 rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation();
              cycleMode(table.id, data.mode);
            }}
          >
            <ModeIcon aria-hidden className="size-3.5" />
          </button>
        )}
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
      {hasRows && (
        <ColumnRows
          table={table}
          mode={data.mode}
          highlighted={highlighted}
          skeleton={skeleton}
          ends={ends}
        />
      )}
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
