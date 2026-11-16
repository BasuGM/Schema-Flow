"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const LIMIT = 120;

/** Text over 120 characters is cut with a "Show more" toggle; the full text is in `title`. */
export function LongText({
  text,
  className,
  testId,
}: {
  text: string;
  className?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const long = text.length > LIMIT;
  return (
    <span className={cn("break-words", className)} title={text} data-testid={testId}>
      {long && !open ? `${text.slice(0, LIMIT)}…` : text}
      {long && (
        <button
          type="button"
          className="ml-1 font-sans text-[11px] text-brand underline-offset-2 hover:underline"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          data-testid="inspector-show-more"
        >
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </span>
  );
}
