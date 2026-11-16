/**
 * Copies text to the clipboard. The Clipboard API needs a secure context (HTTPS or localhost), and
 * the static build may be served from elsewhere, so it falls back to a hidden textarea and
 * `execCommand("copy")`. Returns "failed" (never throws) so the caller can tell the user.
 */
export async function copyText(text: string): Promise<"copied" | "failed"> {
  try {
    if (window.isSecureContext && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return "copied";
    }
  } catch {
    // Permission denied or not focused: try the fallback.
  }
  const area = document.createElement("textarea");
  try {
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    return document.execCommand("copy") ? "copied" : "failed";
  } catch {
    return "failed";
  } finally {
    area.remove();
  }
}
