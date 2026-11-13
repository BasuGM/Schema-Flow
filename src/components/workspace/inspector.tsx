"use client";

import { KeyRound, Link2, MousePointerClick, X } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getIncomingRelationships, getOutgoingRelationships } from "@/domain/schema/selectors";
import type { Column } from "@/domain/schema/types";
import { cn } from "@/lib/utils";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

export function Inspector() {
  const schema = useSchemaStore((s) => s.schema);
  const selectedId = useUiStore((s) => s.selectedTableId);
  const selectTable = useUiStore((s) => s.selectTable);
  const table = selectedId ? schema?.tables[selectedId] : undefined;

  const counts = useMemo(
    () =>
      schema && table
        ? {
            incoming: getIncomingRelationships(schema, table.id).length,
            outgoing: getOutgoingRelationships(schema, table.id).length,
          }
        : null,
    [schema, table],
  );

  if (!table || !counts) {
    return (
      <aside
        aria-label="Inspector"
        data-testid="inspector"
        className="flex h-full flex-col bg-card"
      >
        <div
          data-testid="inspector-empty"
          className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center"
        >
          <MousePointerClick aria-hidden className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">Select a table to inspect it</p>
          <p className="text-xs text-muted-foreground">
            Click a table on the canvas or in the table list.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside aria-label="Inspector" data-testid="inspector" className="flex h-full flex-col bg-card">
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold" data-testid="inspector-title">
            {table.name}
          </h2>
          {table.schemaName && (
            <p className="text-xs text-muted-foreground">schema {table.schemaName}</p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Clear selection"
          onClick={() => selectTable(null)}
          data-testid="inspector-close"
        >
          <X aria-hidden />
        </Button>
      </div>
      {table.comment && (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">{table.comment}</p>
      )}
      <dl className="grid grid-cols-3 border-b text-center" data-testid="inspector-counts">
        <Stat label="Columns" value={table.columns.length} testId="inspector-column-count" />
        <Stat label="Outgoing" value={counts.outgoing} testId="inspector-outgoing-count" />
        <Stat label="Incoming" value={counts.incoming} testId="inspector-incoming-count" />
      </dl>
      <h3 className="px-4 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Columns
      </h3>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-3" data-testid="inspector-columns">
        {table.columns.map((c) => (
          <ColumnItem key={c.id} column={c} />
        ))}
      </ul>
    </aside>
  );
}

function Stat({ label, value, testId }: { label: string; value: number; testId: string }) {
  return (
    <div className="px-2 py-2.5 not-last:border-r">
      <dt className="text-[11px] text-muted-foreground">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

function ColumnItem({ column }: { column: Column }) {
  return (
    <li
      className="grid grid-cols-[0.875rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
      data-testid={`inspector-column-${column.name}`}
    >
      <span className="flex w-3.5 shrink-0 justify-center" aria-hidden>
        {column.isPrimaryKey ? (
          <KeyRound className="size-3 text-pk" />
        ) : column.isForeignKey ? (
          <Link2 className="size-3 text-fk" />
        ) : null}
      </span>
      <span className={cn("truncate", column.isPrimaryKey && "font-semibold")} title={column.name}>
        {column.name}
      </span>
      <span className="flex justify-end gap-1">
        {column.isPrimaryKey && (
          <Badge variant="outline" className="h-4 px-1 text-[10px] text-pk">
            PK
          </Badge>
        )}
        {column.isForeignKey && (
          <Badge variant="outline" className="h-4 px-1 text-[10px] text-fk">
            FK
          </Badge>
        )}
        {column.isUnique && (
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            UQ
          </Badge>
        )}
        {column.nullable && (
          <Badge variant="outline" className="h-4 px-1 text-[10px] text-muted-foreground">
            NULL
          </Badge>
        )}
      </span>
      <span
        className="col-span-2 col-start-2 truncate font-mono text-xs text-muted-foreground"
        title={column.dataType.raw}
        data-testid="inspector-column-type"
      >
        {column.dataType.raw}
      </span>
    </li>
  );
}
