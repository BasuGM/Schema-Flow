"use client";

import { createLineIndex, excerpt } from "@/lib/source-excerpt";
import { cn } from "@/lib/utils";
import { useSchemaStore } from "@/stores/schema-store";

/** One line index per source text: built on the first expanded row, reused by the others. */
let cache: { text: string; index: Int32Array } | null = null;
function lineIndex(text: string): Int32Array {
  if (cache?.text !== text) cache = { text, index: createLineIndex(text) };
  return cache.index;
}

/**
 * Source lines around an issue. The only component that reads `sourceText` (up to 5 MB), and only
 * while a row is expanded.
 */
export function IssueExcerpt({
  id,
  line,
  statement,
}: {
  id: string;
  line: number;
  statement: string | undefined;
}) {
  const source = useSchemaStore((s) => s.sourceText);
  const lines = source ? excerpt(source, lineIndex(source), line) : [];

  return (
    <div
      id={id}
      className="mt-1.5 ml-6 overflow-x-auto rounded-md border bg-muted/40"
      data-testid="issue-excerpt"
    >
      {lines.length > 0 ? (
        <pre className="py-1 font-mono text-[11px] leading-5">
          {lines.map((l) => (
            <div
              key={l.number}
              className={cn("flex", l.current && "bg-amber-500/15 font-semibold")}
              data-testid={l.current ? "issue-excerpt-current" : undefined}
              aria-current={l.current || undefined}
            >
              <span className="w-12 shrink-0 pr-3 text-right text-muted-foreground tabular-nums select-none">
                {l.number}
              </span>
              <span className="pr-3 whitespace-pre">
                {l.text}
                {l.truncated > 0 && (
                  <span className="text-muted-foreground">
                    {" "}
                    … ({l.truncated.toLocaleString("en-US")} more characters)
                  </span>
                )}
              </span>
            </div>
          ))}
        </pre>
      ) : (
        <p className="px-3 py-2 font-mono text-[11px] whitespace-pre-wrap text-muted-foreground">
          {statement ?? "The source text is not available."}
        </p>
      )}
    </div>
  );
}
