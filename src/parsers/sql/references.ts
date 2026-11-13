import type { DraftReference } from "@/domain/schema/draft";
import type { ReferentialAction } from "@/domain/schema/types";
import type { TokenStream } from "./token-stream";

export interface ParsedReference extends DraftReference {
  onDelete?: ReferentialAction;
  onUpdate?: ReferentialAction;
}

/** Parses what follows `REFERENCES`: table, optional column list, and actions in any order. */
export function parseReferences(ts: TokenStream): ParsedReference {
  const target = ts.readQualifiedName("referenced table");
  const ref: ParsedReference = { table: target.name };
  if (target.schemaName) ref.schemaName = target.schemaName;
  if (ts.isPunct("(")) {
    const cols = ts.readIdentifierList();
    if (cols && cols.length > 0) ref.columns = cols;
  }
  for (;;) {
    if (ts.acceptKeywords("ON", "DELETE")) ref.onDelete = readAction(ts);
    else if (ts.acceptKeywords("ON", "UPDATE")) ref.onUpdate = readAction(ts);
    else if (ts.acceptKeywords("MATCH")) ts.next();
    else if (ts.acceptKeywords("NOT", "DEFERRABLE") || ts.acceptKeywords("DEFERRABLE")) continue;
    else if (ts.acceptKeywords("INITIALLY")) ts.next();
    else return ref;
  }
}

function readAction(ts: TokenStream): ReferentialAction {
  if (ts.acceptKeywords("CASCADE")) return "cascade";
  if (ts.acceptKeywords("RESTRICT")) return "restrict";
  if (ts.acceptKeywords("SET", "NULL")) return "set null";
  if (ts.acceptKeywords("SET", "DEFAULT")) return "set default";
  if (ts.acceptKeywords("NO", "ACTION")) return "no action";
  return ts.fail("Expected a referential action");
}
