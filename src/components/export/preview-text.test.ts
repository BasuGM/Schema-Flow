import { describe, expect, it } from "vitest";
import { PREVIEW_MAX_CHARS, PREVIEW_MAX_LINES, previewOf } from "./preview-text";

describe("previewOf", () => {
  it("returns short text whole and counts lines (a trailing newline is not a line)", () => {
    expect(previewOf("a\nb\n")).toEqual({ preview: "a\nb\n", totalLines: 2, truncated: false });
    expect(previewOf("")).toEqual({ preview: "", totalLines: 0, truncated: false });
  });

  it("cuts at the line limit and reports the total", () => {
    const text = Array.from({ length: PREVIEW_MAX_LINES + 50 }, (_, i) => `l${i}`).join("\n");
    const r = previewOf(text);
    expect(r.truncated).toBe(true);
    expect(r.totalLines).toBe(PREVIEW_MAX_LINES + 50);
    expect(r.preview.split("\n")).toHaveLength(PREVIEW_MAX_LINES);
  });

  it("cuts at the character limit for very long lines", () => {
    const r = previewOf("x".repeat(PREVIEW_MAX_CHARS * 2));
    expect(r.truncated).toBe(true);
    expect(r.preview).toHaveLength(PREVIEW_MAX_CHARS);
  });
});
