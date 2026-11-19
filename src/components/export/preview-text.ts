export const PREVIEW_MAX_LINES = 2000;
export const PREVIEW_MAX_CHARS = 200_000;

export interface TextPreview {
  preview: string;
  totalLines: number;
  truncated: boolean;
}

/**
 * The part of `text` shown in the dialog: at most 2,000 lines and 200 KB, so a GitLab-sized export
 * stays responsive. Copy and Download always use the full text.
 */
export function previewOf(text: string): TextPreview {
  let totalLines = text.length === 0 ? 0 : 1;
  let cut = -1;
  for (let i = text.indexOf("\n"); i !== -1; i = text.indexOf("\n", i + 1)) {
    // A trailing newline ends the last line; it doesn't start another.
    if (i < text.length - 1) totalLines++;
    if (cut === -1 && totalLines > PREVIEW_MAX_LINES) cut = i;
  }
  const limit = cut === -1 ? text.length : cut;
  const end = Math.min(limit, PREVIEW_MAX_CHARS);
  return {
    preview: end < text.length ? text.slice(0, end) : text,
    totalLines,
    truncated: end < text.length && text.slice(end).trim().length > 0,
  };
}
