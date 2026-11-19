"use client";

import { useEffect } from "react";
import { applyRestoredSchema } from "@/components/import/apply-import";
import { loadParsers } from "@/components/import/use-import-parse";
import { afterNextPaint } from "@/lib/after-next-paint";
import { hasSessionBackend } from "@/lib/session-db";
import { createSample, parseSampleRequest } from "@/samples/resolve-sample";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { clearSession, listenForClears, loadSession } from "@/stores/session-persistence";
import { startSessionUiSync } from "@/stores/session-ui-sync";
import { useUiStore } from "@/stores/ui-store";

function loadSample(search: string): void {
  const schema = createSample(parseSampleRequest(search));
  useSchemaStore.getState().loadSchema(schema);
  useUiStore.getState().resetForNewSchema();
  const { fingerprint } = useSchemaStore.getState();
  if (fingerprint) useLayoutStore.getState().ensureLayout(schema, fingerprint);
}

/**
 * Decides what a fresh page shows (P3-T06, ADR-030):
 * 1. `?sample=…` loads that sample and leaves the saved session alone.
 * 2. Otherwise the last imported schema is re-parsed from IndexedDB behind a "Restoring…" status.
 * 3. Anything else (no session, no IndexedDB, a corrupt record, a failed parse, a slow read)
 *    falls back to the default sample. A restore that finishes after the user already loaded
 *    something else is dropped.
 */
export function useSessionRestore(): void {
  useEffect(() => {
    listenForClears();
    const stopSync = startSessionUiSync();
    if (useSchemaStore.getState().schema) return stopSync;
    const { search } = window.location;
    if (new URLSearchParams(search).has("sample") || !hasSessionBackend()) {
      loadSample(search);
      return stopSync;
    }

    const schemaStore = useSchemaStore.getState();
    const revision = schemaStore.revision;
    const superseded = () => useSchemaStore.getState().revision !== revision;
    void (async () => {
      const { record, invalid } = await loadSession();
      if (superseded()) return;
      if (!record) {
        if (invalid) void clearSession();
        return loadSample(search);
      }
      schemaStore.setRestoring({ name: record.name });
      const parsers = await loadParsers();
      await afterNextPaint();
      if (superseded()) return schemaStore.setRestoring(null);
      const parsed = parsers.parseSchemaText(record.text, {
        format: record.format,
        name: record.name,
      });
      schemaStore.setRestoring(null);
      const { schema } = parsed.result;
      if (!schema || schema.tableOrder.length === 0) {
        void clearSession();
        return loadSample(search);
      }
      applyRestoredSchema(schema, record.text);
    })();
    return stopSync;
  }, []);
}
