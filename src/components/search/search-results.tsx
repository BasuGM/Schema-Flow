"use client";

import { Columns3, KeyRound, Link2, Table2 } from "lucide-react";
import { memo } from "react";
import type { Range } from "@/domain/search/field";
import type { ColumnHit, TableHit } from "@/domain/search/search";
import { cn } from "@/lib/utils";

export type SearchOption = { kind: "table"; hit: TableHit } | { kind: "column"; hit: ColumnHit };

/** Text with the matched ranges wrapped in `<mark>` (also visible in forced-colors mode). */
export function Highlighted({ text, ranges }: { text: string; ranges: readonly Range[] }) {
  if (ranges.length === 0) return <>{text}</>;
  const merged: [number, number][] = [];
  for (const [s, e] of [...ranges].sort((a, b) => a[0] - b[0])) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const parts: React.ReactNode[] = [];
  let at = 0;
  for (const [s, e] of merged) {
    if (s > at) parts.push(text.slice(at, s));
    parts.push(
      <mark key={s} className="rounded-[2px] bg-brand/25 text-inherit">
        {text.slice(s, e)}
      </mark>,
    );
    at = e;
  }
  if (at < text.length) parts.push(text.slice(at));
  return <>{parts}</>;
}

interface OptionRowProps {
  option: SearchOption;
  index: number;
  id: string;
  active: boolean;
  /** Stable across arrow-key moves, so only the two rows whose `active` changes re-render. */
  onHover: (index: number) => void;
  onChoose: (index: number) => void;
}

export const OptionRow = memo(function OptionRow({
  option,
  index,
  id,
  active,
  onHover,
  onChoose,
}: OptionRowProps) {
  return (
    <div
      id={id}
      role="option"
      aria-selected={active}
      tabIndex={-1}
      onMouseMove={active ? undefined : () => onHover(index)}
      onClick={() => onChoose(index)}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm",
        active && "bg-accent text-accent-foreground",
      )}
      data-testid="search-option"
      data-kind={option.kind}
      data-id={option.hit.entry.id}
    >
      {option.kind === "table" ? (
        <TableOption hit={option.hit} />
      ) : (
        <ColumnOption hit={option.hit} />
      )}
    </div>
  );
});

function TableOption({ hit }: { hit: TableHit }) {
  const { entry, marks } = hit;
  return (
    <>
      <Table2 aria-hidden className="size-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0 truncate">
        {entry.showSchema && entry.schema && (
          <span className="text-muted-foreground">
            <Highlighted text={entry.schema.raw} ranges={marks.schema} />.
          </span>
        )}
        <span className="font-medium">
          <Highlighted text={entry.name.raw} ranges={marks.table} />
        </span>
      </span>
      <span className="ml-auto shrink-0 text-xs text-muted-foreground tabular-nums">
        {entry.columnCount} {entry.columnCount === 1 ? "column" : "columns"}
      </span>
    </>
  );
}

function ColumnOption({ hit }: { hit: ColumnHit }) {
  const { entry, marks } = hit;
  const Icon = entry.isPrimaryKey ? KeyRound : entry.isForeignKey ? Link2 : Columns3;
  const table = entry.table;
  return (
    <>
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0",
          entry.isPrimaryKey ? "text-pk" : entry.isForeignKey ? "text-fk" : "text-muted-foreground",
        )}
      />
      {(entry.isPrimaryKey || entry.isForeignKey) && (
        <span className="sr-only">{entry.isPrimaryKey ? "Primary key" : "Foreign key"} column</span>
      )}
      <span className="min-w-0 truncate">
        <span className="text-muted-foreground">
          {table.showSchema && table.schema && (
            <>
              <Highlighted text={table.schema.raw} ranges={marks.schema} />.
            </>
          )}
          <Highlighted text={table.name.raw} ranges={marks.table} />.
        </span>
        <span className="font-medium">
          <Highlighted text={entry.name.raw} ranges={marks.column} />
        </span>
      </span>
      <span className="ml-auto max-w-[40%] shrink-0 truncate font-mono text-xs text-muted-foreground">
        {entry.type}
      </span>
    </>
  );
}
