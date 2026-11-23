"use client";

import { EyeOff, Link2, Search, X } from "lucide-react";
import { memo, useMemo } from "react";
import { getSubjectAreas } from "@/analysis/subject-areas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { displayTableName } from "@/domain/schema/selectors";
import type { TableId } from "@/domain/schema/types";
import { cn } from "@/lib/utils";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { AreaFilter } from "./area-filter";

/**
 * The table list. With `onClose` it is the phone sheet (ADR-021): it gets a close button, and
 * picking a table closes the sheet so the centred table is visible.
 */
export function TableList({ onClose }: { onClose?: () => void } = {}) {
  const schema = useSchemaStore((s) => s.schema);
  const filter = useUiStore((s) => s.tableFilter);
  const setFilter = useUiStore((s) => s.setTableFilter);

  const hiddenAreas = useUiStore((s) => s.hiddenAreas);
  const areas = useMemo(() => (schema ? getSubjectAreas(schema) : null), [schema]);

  const ids = useMemo(() => {
    if (!schema) return [];
    const q = filter.trim().toLowerCase();
    return q
      ? schema.tableOrder.filter((id) => {
          const table = schema.tables[id];
          return table ? displayTableName(schema, table).toLowerCase().includes(q) : false;
        })
      : schema.tableOrder;
  }, [schema, filter]);

  // Grouped under area headers (empty groups dropped) when the schema has areas.
  const groups = useMemo(() => {
    if (!areas) return null;
    const visible = new Set(ids);
    return areas.areas
      .map((a) => ({ area: a, ids: a.tableIds.filter((id) => visible.has(id)) }))
      .filter((g) => g.ids.length > 0);
  }, [areas, ids]);

  return (
    <aside aria-label="Tables" className="flex h-full flex-col bg-card" data-testid="table-list">
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Tables
        </h2>
        <div className="flex items-center gap-1">
          {schema && (
            <span
              className="text-xs text-muted-foreground tabular-nums"
              data-testid="table-list-count"
            >
              {ids.length === schema.tableOrder.length
                ? ids.length
                : `${ids.length} / ${schema.tableOrder.length}`}
            </span>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Close tables"
              onClick={onClose}
              data-testid="table-list-sheet-close"
            >
              <X aria-hidden />
            </Button>
          )}
        </div>
      </div>
      <div className="relative px-3 pb-2">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-5.5 size-3.5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tables"
          aria-label="Filter tables by name"
          className="h-8 pl-7 text-sm"
          data-testid="table-filter"
        />
      </div>
      {areas && <AreaFilter areas={areas} />}
      {schema && ids.length === 0 ? (
        <p
          className="px-3 py-6 text-center text-sm text-muted-foreground"
          data-testid="table-list-empty"
        >
          No tables match “{filter.trim()}”.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-2">
          {groups
            ? groups.map(({ area, ids: groupIds }) => (
                <li key={area.id} data-testid={`area-group-${area.id}`}>
                  <h3 className="flex items-center justify-between px-2 pt-2 pb-1 text-xs font-semibold text-muted-foreground">
                    <span className="truncate">{area.label}</span>
                    <span className="tabular-nums">{groupIds.length}</span>
                  </h3>
                  <ul>
                    {groupIds.map((id) => (
                      <TableListItem
                        key={id}
                        tableId={id}
                        closeOnPick={!!onClose}
                        hidden={hiddenAreas.has(area.id)}
                      />
                    ))}
                  </ul>
                </li>
              ))
            : ids.map((id) => <TableListItem key={id} tableId={id} closeOnPick={!!onClose} />)}
        </ul>
      )}
    </aside>
  );
}

const TableListItem = memo(function TableListItem({
  tableId,
  closeOnPick,
  hidden = false,
}: {
  tableId: TableId;
  closeOnPick: boolean;
  /** Its subject area is hidden on the canvas; picking it turns the area back on. */
  hidden?: boolean;
}) {
  const table = useSchemaStore((s) => s.schema?.tables[tableId]);
  const title = useSchemaStore((s) => {
    const t = s.schema?.tables[tableId];
    return s.schema && t ? displayTableName(s.schema, t) : "";
  });
  const selected = useUiStore((s) => s.selectedTableId === tableId);
  const focusTable = useUiStore((s) => s.focusTable);
  if (!table) return null;
  const hasForeignKeys = table.columns.some((c) => c.isForeignKey);

  return (
    <li>
      <button
        type="button"
        onClick={() => {
          focusTable(tableId);
          if (closeOnPick) useUiStore.getState().setPanelOpen("left", false);
        }}
        aria-current={selected || undefined}
        title={table.id}
        data-testid={`table-list-item-${title}`}
        className={cn(
          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected ? "bg-brand-muted font-medium text-foreground" : "hover:bg-accent",
          hidden && "text-muted-foreground",
        )}
      >
        <span className="min-w-0 flex-1 truncate">{title}</span>
        {hidden && (
          <EyeOff aria-label="hidden on canvas" className="size-3 shrink-0 text-muted-foreground" />
        )}
        {hasForeignKeys && (
          <Link2 aria-label="has foreign keys" className="size-3 shrink-0 text-fk" />
        )}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {table.columns.length}
        </span>
      </button>
    </li>
  );
});
