"use client";

import { useMemo } from "react";
import { analyzeSchema } from "@/analysis/health";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore, type BottomTab } from "@/stores/ui-store";
import { HealthPanel } from "./health-panel";
import { IssuesPanel } from "./issues-panel";

/**
 * The bottom panel (docked or sheet): Issues | Health tabs (P4-T01). It is mounted only while the
 * panel is open, so the health analysis runs once per schema and only when someone can see it.
 * Remount it (key) when the schema changes.
 */
export function BottomPanel() {
  const tab = useUiStore((s) => s.issuesPanelTab);
  const setTab = useUiStore((s) => s.setIssuesPanelTab);
  const schema = useSchemaStore((s) => s.schema);
  const issueCount = useSchemaStore((s) => s.issues.length);
  const findings = useMemo(() => (schema ? analyzeSchema(schema) : []), [schema]);

  return (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as BottomTab)}
      className="h-full min-h-0 gap-0 bg-card"
    >
      <div className="border-b px-2 py-1">
        <TabsList aria-label="Issues and health checks" className="w-fit">
          <TabsTrigger value="issues" data-testid="bottom-tab-issues">
            Issues <span className="tabular-nums">{issueCount}</span>
          </TabsTrigger>
          <TabsTrigger value="health" data-testid="bottom-tab-health">
            Health <span className="tabular-nums">{findings.length}</span>
          </TabsTrigger>
        </TabsList>
      </div>
      <TabsContent value="issues" className="flex flex-col">
        <IssuesPanel />
      </TabsContent>
      <TabsContent value="health" className="flex flex-col">
        <HealthPanel findings={findings} />
      </TabsContent>
    </Tabs>
  );
}
