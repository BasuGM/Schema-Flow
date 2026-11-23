"use client";

import { ArrowLeft, MousePointerClick, X } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { detailCounts, getTableDetails } from "@/domain/schema/table-details";
import { inspectorGoBack } from "@/stores/reveal";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore, type InspectorTab } from "@/stores/ui-store";
import { CollapseModeControl } from "./collapse-mode-control";
import { ColumnsTab } from "./columns-tab";
import { focusInInspector } from "./focus-inspector";
import { KeysTab } from "./keys-tab";
import { PathTab } from "./path-tab";
import { RelationsTab } from "./relations-tab";

/**
 * The selected table's details (P2-T08): header, counts and three tabs. With `sheet`, it is the
 * phone overlay and its × closes the panel instead of clearing the selection.
 */
export function Inspector({ sheet = false }: { sheet?: boolean }) {
  const schema = useSchemaStore((s) => s.schema);
  const selectedId = useUiStore((s) => s.selectedTableId);
  const tab = useUiStore((s) => s.inspectorTab);
  const setTab = useUiStore((s) => s.setInspectorTab);
  const back = useUiStore((s) => s.inspectorBack);
  const details = useMemo(
    () => (schema && selectedId ? getTableDetails(schema, selectedId) : null),
    [schema, selectedId],
  );
  const close = sheet ? <ClosePanel /> : null;

  if (!schema || !details) {
    return (
      <aside
        aria-label="Inspector"
        data-testid="inspector"
        className="flex h-full flex-col bg-card"
      >
        {close && <div className="flex justify-end px-2 pt-2">{close}</div>}
        <div
          data-testid="inspector-empty"
          tabIndex={-1}
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

  const { table } = details;
  const counts = detailCounts(details);
  const backName = back ? schema.tables[back.tableId]?.name : undefined;

  return (
    <aside aria-label="Inspector" data-testid="inspector" className="flex h-full flex-col bg-card">
      {back && backName && (
        <button
          type="button"
          onClick={(e) => {
            const button = e.currentTarget;
            inspectorGoBack();
            focusInInspector(button, "inspector-title");
          }}
          className="flex items-center gap-1 border-b px-4 py-1.5 text-left text-xs text-brand outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="inspector-back"
        >
          <ArrowLeft aria-hidden className="size-3.5" />
          Back to {backName}
        </button>
      )}
      <div className="flex items-start gap-2 border-b px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2
            tabIndex={-1}
            className="truncate rounded-sm text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
            data-testid="inspector-title"
          >
            {table.name}
          </h2>
          {details.showSchema && (
            <p className="text-xs text-muted-foreground" data-testid="inspector-schema">
              schema {table.schemaName}
            </p>
          )}
          {table.origin === "implicit" && (
            <p className="text-xs text-muted-foreground">
              Implicit join table (Prisma many-to-many)
            </p>
          )}
          {table.partitions && (
            <details className="text-xs text-muted-foreground" data-testid="inspector-partitions">
              <summary className="cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Partitioned · {table.partitions.length} partition
                {table.partitions.length === 1 ? "" : "s"} folded in
              </summary>
              <p className="mt-1 max-h-24 overflow-y-auto font-mono break-all">
                {table.partitions.join(", ")}
              </p>
            </details>
          )}
        </div>
        {close ?? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Clear selection"
            onClick={(e) => {
              const button = e.currentTarget;
              useUiStore.getState().selectTable(null);
              focusInInspector(button, "inspector-empty");
            }}
            data-testid="inspector-close"
          >
            <X aria-hidden />
          </Button>
        )}
      </div>
      {table.comment && (
        <p className="border-b px-4 py-2 text-xs text-muted-foreground">{table.comment}</p>
      )}
      <CollapseModeControl tableId={table.id} />
      <dl className="grid grid-cols-3 border-b text-center" data-testid="inspector-counts">
        <Stat label="Columns" value={table.columns.length} testId="inspector-column-count" />
        <Stat label="Outgoing" value={details.outgoing.length} testId="inspector-outgoing-count" />
        <Stat label="Incoming" value={details.incoming.length} testId="inspector-incoming-count" />
      </dl>
      <Tabs value={tab} onValueChange={(v) => setTab(v as InspectorTab)} className="min-h-0 flex-1">
        <TabsList className="mx-3 mt-2 mb-1 flex" aria-label="Table details">
          <TabTrigger value="columns" label="Columns" count={counts.columns} />
          <TabTrigger value="keys" label="Keys" count={counts.keys} />
          <TabTrigger value="relations" label="Relations" count={counts.relations} />
          <TabTrigger value="path" label="Path" />
        </TabsList>
        {/* Keyed by table so "Show more" limits and toggles reset when the selection changes. */}
        <TabsContent value="columns" className="overflow-y-auto">
          <ColumnsTab key={table.id} details={details} />
        </TabsContent>
        <TabsContent value="keys" className="overflow-y-auto">
          <KeysTab key={table.id} details={details} />
        </TabsContent>
        <TabsContent value="relations" className="overflow-y-auto">
          <RelationsTab key={table.id} details={details} />
        </TabsContent>
        <TabsContent value="path" className="overflow-y-auto">
          <PathTab key={table.id} tableId={table.id} sheet={sheet} />
        </TabsContent>
      </Tabs>
    </aside>
  );
}

function TabTrigger({
  value,
  label,
  count,
}: {
  value: InspectorTab;
  label: string;
  count?: number;
}) {
  return (
    <TabsTrigger value={value} data-testid={`inspector-tab-${value}`}>
      {label}
      {count !== undefined && (
        <span className="text-[10px] text-muted-foreground tabular-nums">{count}</span>
      )}
    </TabsTrigger>
  );
}

function ClosePanel() {
  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label="Close inspector"
      onClick={() => useUiStore.getState().setPanelOpen("right", false)}
      data-testid="inspector-sheet-close"
    >
      <X aria-hidden />
    </Button>
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
