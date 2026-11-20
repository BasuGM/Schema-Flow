"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import type { ColumnName, RelationDetails, TableDetails } from "@/domain/schema/table-details";
import { navigateToRelated } from "@/stores/reveal";
import { PAGE_SIZE } from "./columns-tab";
import { focusInInspector } from "./focus-inspector";
import { Section } from "./keys-tab";
import { ShowMore } from "./show-more";

/** Outgoing ("References") and incoming ("Referenced by") relationships, 100 at a time. */
export function RelationsTab({ details }: { details: TableDetails }) {
  return (
    <div className="flex flex-col gap-3 px-4 pt-1 pb-3">
      <RelationList title="References" kind="outgoing" relations={details.outgoing} />
      <RelationList title="Referenced by" kind="incoming" relations={details.incoming} />
    </div>
  );
}

function RelationList({
  title,
  kind,
  relations,
}: {
  title: string;
  kind: "outgoing" | "incoming";
  relations: RelationDetails[];
}) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const empty = kind === "outgoing" ? "No foreign keys" : "Not referenced";
  return (
    <div data-testid={`inspector-${kind}`}>
      <Section title={title} empty={empty} count={relations.length}>
        {relations.slice(0, limit).map((r) => (
          <RelationRow key={r.id} relation={r} kind={kind} />
        ))}
      </Section>
      <ShowMore
        shown={Math.min(limit, relations.length)}
        total={relations.length}
        onMore={() => setLimit(limit + PAGE_SIZE)}
        testId={`inspector-${kind}-more`}
      />
    </div>
  );
}

const names = (cols: ColumnName[]) =>
  cols.length === 1 ? cols[0]!.name : `(${cols.map((c) => c.name).join(", ")})`;

function RelationRow({ relation: r, kind }: { relation: RelationDetails; kind: string }) {
  const from = r.pairs.map(([f]) => f);
  const to = r.pairs.map(([, t]) => t);
  // Navigating highlights the column at the other end: the referenced key, or the FK column.
  const otherColumn = kind === "outgoing" ? to[0] : from[0];
  const target = (
    <button
      type="button"
      onClick={(e) => {
        const button = e.currentTarget;
        navigateToRelated(r.other.tableId, otherColumn?.id);
        focusInInspector(button, "inspector-title");
      }}
      aria-label={`Show table ${r.other.table}`}
      className="rounded-sm font-medium text-brand underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      data-testid="inspector-relation-target"
    >
      {r.other.table}
    </button>
  );
  const actions = [
    r.onDelete && `ON DELETE ${r.onDelete}`,
    r.onUpdate && `ON UPDATE ${r.onUpdate}`,
  ].filter(Boolean);

  return (
    <li className="rounded-md border px-2 py-1.5 text-xs" data-testid="inspector-relation">
      <div className="flex flex-wrap items-baseline gap-x-1 font-mono">
        {kind === "outgoing" ? (
          <>
            <span>{names(from)}</span>
            <span aria-label="references">→</span>
            <span>
              {target}.{names(to)}
            </span>
          </>
        ) : (
          <>
            <span>
              {target}.{names(from)}
            </span>
            <span aria-label="references">→</span>
            <span>{names(to)}</span>
          </>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1">
        <Badge
          variant="outline"
          className="h-4 px-1 text-[10px]"
          title={r.cardinality}
          aria-label={r.cardinality}
        >
          {r.cardinality === "one-to-one" ? "1:1" : "N:1"}
        </Badge>
        {r.self && (
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            self
          </Badge>
        )}
        {r.implicit && (
          <Badge variant="outline" className="h-4 px-1 text-[10px]">
            Prisma implicit
          </Badge>
        )}
        {actions.length > 0 && (
          <span className="font-mono text-[11px] text-muted-foreground">{actions.join(" · ")}</span>
        )}
      </div>
      {r.name && (
        <div className="mt-0.5 truncate text-[11px] text-muted-foreground" title={r.name}>
          {r.name}
        </div>
      )}
    </li>
  );
}
