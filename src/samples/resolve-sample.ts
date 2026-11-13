import type { Schema } from "@/domain/schema/types";
import { createEcommerceSchema } from "./ecommerce";
import { generateSyntheticSchema } from "./synthetic";

export type SampleRequest =
  { kind: "ecommerce" } | { kind: "synthetic"; tables: number; seed: number };

/** Parses `?sample=synthetic&tables=200&seed=7`. Anything else means the default e-commerce sample. */
export function parseSampleRequest(search: string): SampleRequest {
  const params = new URLSearchParams(search);
  if (params.get("sample") !== "synthetic") return { kind: "ecommerce" };
  const tables = Number.parseInt(params.get("tables") ?? "", 10);
  const seed = Number.parseInt(params.get("seed") ?? "", 10);
  return {
    kind: "synthetic",
    tables: Number.isFinite(tables) ? tables : 50,
    seed: Number.isFinite(seed) ? seed : 1,
  };
}

export function createSample(request: SampleRequest): Schema {
  return request.kind === "synthetic"
    ? generateSyntheticSchema({ tables: request.tables, seed: request.seed })
    : createEcommerceSchema();
}
