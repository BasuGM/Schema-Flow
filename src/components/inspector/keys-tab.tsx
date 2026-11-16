"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { ColumnName, TableDetails } from "@/domain/schema/table-details";
import type { TableId } from "@/domain/schema/types";
import { ColumnLink } from "./column-link";
import { LongText } from "./long-text";

/** Primary key, unique constraints, indexes and checks, each with an empty state. */
export function KeysTab({ details }: { details: TableDetails }) {
  const tableId = details.table.id;
  const pk = details.primaryKey;
  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-3">
      <Section title="Primary key" empty="No primary key" count={pk ? 1 : 0}>
        {pk && (
          <Item testId="inspector-pk" name={pk.name}>
            <Columns tableId={tableId} columns={pk.columns} ordinals={pk.columns.length > 1} />
          </Item>
        )}
      </Section>
      <Section title="Unique" empty="No unique constraints" count={details.uniques.length}>
        {details.uniques.map((u, i) => (
          <Item key={i} testId="inspector-unique" name={u.name}>
            <Columns tableId={tableId} columns={u.columns} />
          </Item>
        ))}
      </Section>
      <Section title="Indexes" empty="No indexes" count={details.indexes.length}>
        {details.indexes.map((ix, i) => (
          <Item
            key={i}
            testId="inspector-index"
            name={ix.name}
            badge={
              ix.unique && (
                <Badge variant="outline" className="h-4 px-1 text-[10px]">
                  unique
                </Badge>
              )
            }
          >
            <Columns tableId={tableId} columns={ix.columns} />
          </Item>
        ))}
      </Section>
      <Section title="Checks" empty="No check constraints" count={details.checks.length}>
        {details.checks.map((c, i) => (
          <Item key={i} testId="inspector-check" name={c.name}>
            <LongText text={c.expression} className="font-mono text-xs" />
          </Item>
        ))}
      </Section>
    </div>
  );
}

export function Section({
  title,
  empty,
  count,
  children,
}: {
  title: string;
  empty: string;
  count: number;
  children: ReactNode;
}) {
  return (
    <section aria-label={title}>
      <h3 className="pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {count === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">{children}</ul>
      )}
    </section>
  );
}

function Item({
  name,
  badge,
  testId,
  children,
}: {
  name?: string;
  badge?: ReactNode;
  testId: string;
  children: ReactNode;
}) {
  return (
    <li className="rounded-md border px-2 py-1.5" data-testid={testId}>
      <div className="flex items-center gap-1.5 text-xs">
        <span className="min-w-0 truncate font-medium" title={name}>
          {name ?? <span className="text-muted-foreground italic">unnamed</span>}
        </span>
        {badge}
      </div>
      <div className="mt-0.5">{children}</div>
    </li>
  );
}

function Columns({
  tableId,
  columns,
  ordinals = false,
}: {
  tableId: TableId;
  columns: ColumnName[];
  ordinals?: boolean;
}) {
  return (
    <ol className="flex flex-wrap gap-x-2 gap-y-0.5">
      {columns.map((c, i) => (
        <li key={c.id} className="flex items-baseline gap-1">
          {ordinals && (
            <span className="text-[10px] text-muted-foreground tabular-nums">{i + 1}</span>
          )}
          <ColumnLink tableId={tableId} column={c} />
        </li>
      ))}
    </ol>
  );
}
