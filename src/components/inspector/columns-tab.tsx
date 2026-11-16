"use client";

import { KeyRound, Link2 } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ColumnDetails, TableDetails } from "@/domain/schema/table-details";
import type { TableId } from "@/domain/schema/types";
import { cn } from "@/lib/utils";
import { revealTable } from "@/stores/reveal";
import { useUiStore } from "@/stores/ui-store";
import { ColumnLink } from "./column-link";
import { LongText } from "./long-text";
import { ShowMore } from "./show-more";

export const PAGE_SIZE = 100;
const ENUM_PREVIEW = 8;

/**
 * Columns with type, default, FK targets, comment and enum values. 100 rows at a time; a column
 * highlighted beyond that (search, a link) is still rendered and scrolled into view.
 */
export function ColumnsTab({ details }: { details: TableDetails }) {
  const tableId = details.table.id;
  const highlighted = useUiStore((s) =>
    s.highlightedColumn?.tableId === tableId ? s.highlightedColumn.columnId : null,
  );
  const [limit, setLimit] = useState(PAGE_SIZE);
  const highlightIndex = highlighted
    ? details.columns.findIndex((c) => c.column.id === highlighted)
    : -1;
  const shown = Math.max(limit, highlightIndex + 1);
  const highlightRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (highlighted) highlightRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [highlighted]);

  return (
    <>
      <ul className="px-2 pb-2" data-testid="inspector-columns">
        {details.columns.slice(0, shown).map((item) => (
          <ColumnRow
            key={item.column.id}
            item={item}
            tableId={tableId}
            highlighted={item.column.id === highlighted}
            rowRef={item.column.id === highlighted ? highlightRef : undefined}
          />
        ))}
      </ul>
      <ShowMore
        shown={shown}
        total={details.columns.length}
        onMore={() => setLimit(shown + PAGE_SIZE)}
        testId="inspector-columns-more"
      />
    </>
  );
}

interface ColumnRowProps {
  item: ColumnDetails;
  tableId: TableId;
  highlighted: boolean;
  rowRef?: React.Ref<HTMLLIElement>;
}

const ColumnRow = memo(function ColumnRow({ item, tableId, highlighted, rowRef }: ColumnRowProps) {
  const { column } = item;
  return (
    <li
      ref={rowRef}
      aria-current={highlighted || undefined}
      className={cn(
        "rounded-md px-2 py-1.5 text-sm",
        highlighted ? "bg-brand-muted ring-2 ring-brand ring-inset" : "hover:bg-accent/60",
      )}
      data-testid={`inspector-column-${column.name}`}
    >
      {/* Reading through columns: highlight on the canvas, pan only if the row is off-screen. */}
      <button
        type="button"
        className="grid w-full grid-cols-[0.875rem_minmax(0,1fr)_auto] items-center gap-x-2 rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Highlight on the canvas"
        onClick={() => revealTable(tableId, column.id, { mode: "ensure-visible" })}
      >
        <span className="flex w-3.5 shrink-0 justify-center" aria-hidden>
          {column.isPrimaryKey ? (
            <KeyRound className="size-3 text-pk" />
          ) : column.isForeignKey ? (
            <Link2 className="size-3 text-fk" />
          ) : null}
        </span>
        <span className={cn("truncate", column.isPrimaryKey && "font-semibold")}>
          {column.name}
        </span>
        <ColumnBadges item={item} />
        <span className="col-span-2 col-start-2 flex min-w-0 flex-wrap items-baseline gap-x-2 font-mono text-xs text-muted-foreground">
          <span
            className="truncate"
            title={column.dataType.raw}
            data-testid="inspector-column-type"
          >
            {column.dataType.raw}
          </span>
          {item.default && (
            <span
              className="flex min-w-0 items-baseline gap-1"
              data-testid="inspector-column-default"
            >
              {item.default.auto ? (
                <span className="font-sans">auto-increment</span>
              ) : (
                <>
                  {/* Inside the row button, so no nested toggle: 2 lines, full text in title. */}={" "}
                  <span className="line-clamp-2 break-all" title={item.default.text}>
                    {item.default.text}
                  </span>
                  {item.default.db && (
                    <span
                      className="ml-1 font-sans text-[10px] uppercase"
                      title="Computed by the database (dbgenerated)"
                    >
                      db
                    </span>
                  )}
                </>
              )}
            </span>
          )}
        </span>
      </button>
      <ColumnExtras item={item} />
    </li>
  );
});

function ColumnBadges({ item }: { item: ColumnDetails }) {
  const { column } = item;
  const badge = "h-4 px-1 text-[10px]";
  return (
    <span className="flex justify-end gap-1">
      {column.isPrimaryKey && (
        <Badge variant="outline" className={cn(badge, "text-pk")}>
          PK
        </Badge>
      )}
      {column.isForeignKey && (
        <Badge variant="outline" className={cn(badge, "text-fk")}>
          FK
        </Badge>
      )}
      {column.isUnique && (
        <Badge variant="outline" className={badge}>
          UQ
        </Badge>
      )}
      {column.nullable && (
        <Badge variant="outline" className={cn(badge, "text-muted-foreground")}>
          NULL
        </Badge>
      )}
    </span>
  );
}

function ColumnExtras({ item }: { item: ColumnDetails }) {
  const [allValues, setAllValues] = useState(false);
  const values = item.enumValues ?? [];
  const visible = allValues ? values : values.slice(0, ENUM_PREVIEW);
  if (!item.references.length && !item.column.comment && !values.length) return null;
  return (
    <div className="mt-0.5 flex flex-col gap-1 pl-5.5 text-xs">
      {item.references.map((target) => (
        <span key={`${target.tableId}:${target.column.id}`} className="text-muted-foreground">
          →{" "}
          <ColumnLink
            tableId={target.tableId}
            table={target.table}
            column={target.column}
            testId="inspector-column-fk"
          />
        </span>
      ))}
      {item.column.comment && (
        <LongText
          text={item.column.comment}
          className="text-muted-foreground italic"
          testId="inspector-column-comment"
        />
      )}
      {values.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-1"
          aria-label={`Enum ${item.enumName} values`}
          data-testid="inspector-column-enum"
        >
          {visible.map((v) => (
            <Badge key={v} variant="secondary" className="h-4 px-1 font-mono text-[10px]">
              {v}
            </Badge>
          ))}
          {values.length > ENUM_PREVIEW && (
            <button
              type="button"
              className="text-[11px] text-brand underline-offset-2 hover:underline"
              aria-expanded={allValues}
              onClick={() => setAllValues((a) => !a)}
              data-testid="inspector-enum-more"
            >
              {allValues ? "Show fewer" : `+${values.length - ENUM_PREVIEW} more`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
