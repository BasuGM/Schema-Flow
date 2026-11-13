import type { Schema } from "@/domain/schema/types";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";

/** Resets all stores and optionally loads a schema (with layout), as the workspace does. */
export function resetStores(schema: Schema | null = createEcommerceSchema()): void {
  useSchemaStore.getState().clear();
  useLayoutStore.setState({ layouts: {}, version: 0 });
  useUiStore.getState().reset();
  if (!schema) return;
  useSchemaStore.getState().loadSchema(schema);
  const fp = useSchemaStore.getState().fingerprint;
  if (fp) useLayoutStore.getState().ensureLayout(schema, fp);
}
