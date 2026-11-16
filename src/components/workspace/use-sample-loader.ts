"use client";

import { useEffect } from "react";
import { createSample, parseSampleRequest } from "@/samples/resolve-sample";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/**
 * Loads the sample named by the URL (`?sample=synthetic&tables=N&seed=S`) or the default
 * e-commerce sample. Runs on the client after mount so the static HTML stays URL-independent.
 */
export function useSampleLoader(): void {
  useEffect(() => {
    if (useSchemaStore.getState().schema) return;
    const schema = createSample(parseSampleRequest(window.location.search));
    useSchemaStore.getState().loadSchema(schema);
    useUiStore.getState().resetForNewSchema();
    const { fingerprint } = useSchemaStore.getState();
    if (fingerprint) useLayoutStore.getState().ensureLayout(schema, fingerprint);
  }, []);
}
