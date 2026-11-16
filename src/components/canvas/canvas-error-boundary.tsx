"use client";

import type { ReactNode } from "react";
import { ErrorBoundary } from "@/components/errors/error-boundary";
import { useSchemaStore } from "@/stores/schema-store";

/** Keeps a rendering failure in the diagram from taking down the whole workspace. */
export function CanvasErrorBoundary({ children }: { children: ReactNode }) {
  const fingerprint = useSchemaStore((s) => s.fingerprint);
  return (
    <ErrorBoundary region="diagram" testId="canvas-error" resetKeys={[fingerprint]}>
      {children}
    </ErrorBoundary>
  );
}
