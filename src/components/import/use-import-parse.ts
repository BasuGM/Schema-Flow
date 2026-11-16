"use client";

import { useEffect, useState } from "react";
import type * as ParsersModule from "@/parsers";
import type { ImportFormatChoice, ParsedSchemaText } from "@/parsers";
import { MAX_IMPORT_BYTES, schemaNameForFile, type ImportDraft } from "./import-draft";

type Parsers = typeof ParsersModule;

let parsersPromise: Promise<Parsers> | undefined;

/** Loads the parsers on demand, in a separate chunk that isn't part of the initial bundle. */
export function loadParsers(): Promise<Parsers> {
  parsersPromise ??= import("@/parsers");
  return parsersPromise;
}

export type ImportParseState =
  | { status: "idle" }
  | { status: "parsing" }
  | { status: "too-large"; size: number }
  | { status: "binary" }
  | { status: "done"; parsed: ParsedSchemaText };

interface Settled {
  draft: ImportDraft;
  format: ImportFormatChoice;
  state: ImportParseState;
}

/**
 * Parses the draft whenever it or the chosen format changes. Synchronous outcomes (nothing to
 * parse, too large) are derived during render; only the asynchronous parse result is state, tagged
 * with the draft and format it belongs to so a stale result is never shown.
 */
export function useImportParse(draft: ImportDraft, format: ImportFormatChoice): ImportParseState {
  const [settled, setSettled] = useState<Settled | null>(null);
  const tooLarge = draft.kind === "file" && draft.size > MAX_IMPORT_BYTES;
  const needsParse = draft.kind !== "empty" && !tooLarge;

  useEffect(() => {
    if (!needsParse) return;
    let cancelled = false;
    void parseDraft(draft, format).then((state) => {
      if (!cancelled) setSettled({ draft, format, state });
    });
    return () => {
      cancelled = true;
    };
  }, [draft, format, needsParse]);

  if (draft.kind === "empty") return { status: "idle" };
  if (tooLarge) return { status: "too-large", size: draft.size };
  if (settled && settled.draft === draft && settled.format === format) return settled.state;
  return { status: "parsing" };
}

async function parseDraft(
  draft: ImportDraft,
  format: ImportFormatChoice,
): Promise<ImportParseState> {
  const parsers = await loadParsers();
  if (draft.kind === "empty") return { status: "idle" };
  let text: string;
  let name: string | undefined;
  if (draft.kind === "paste") text = draft.text;
  else {
    const source = draft.source;
    if (typeof source === "string") text = source;
    else {
      const decoded = parsers.decodeSchemaFile(new Uint8Array(await source.arrayBuffer()));
      if (!decoded.ok) return { status: "binary" };
      text = decoded.text;
      name = schemaNameForFile(draft.name);
    }
  }
  // Yield a frame so "Parsing…" paints before a large parse blocks the main thread.
  await new Promise((resolve) => setTimeout(resolve, 0));
  const parsed = parsers.parseSchemaText(text, { format, ...(name ? { name } : {}) });
  return { status: "done", parsed };
}
