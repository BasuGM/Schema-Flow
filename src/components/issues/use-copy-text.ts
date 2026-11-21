import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/copy-text";

export type CopyState = "idle" | "copied" | "failed";

/**
 * Copy-to-clipboard state for a panel's Copy button: "copied" resets after 2 s; on "failed" the
 * fallback textarea (attach `fallbackRef`) gets its text selected so the user can copy by hand.
 */
export function useCopyText(getText: () => string) {
  const [copy, setCopy] = useState<CopyState>("idle");
  const fallbackRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (copy === "failed") fallbackRef.current?.select();
    if (copy !== "copied") return;
    const timer = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copy]);

  return { copy, fallbackRef, onCopy: async () => setCopy(await copyText(getText())) };
}
