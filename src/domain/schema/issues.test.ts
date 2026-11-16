import { describe, expect, it } from "vitest";
import { countIssues, issuesToText, sortIssues } from "./issues";
import type { ImportIssue } from "./types";

const w = (message: string, line?: number): ImportIssue =>
  line === undefined ? { severity: "warning", message } : { severity: "warning", message, line };
const e = (message: string, line?: number): ImportIssue => ({
  ...w(message, line),
  severity: "error",
});

describe("issue helpers", () => {
  it("sorts errors first, then by line, lineless last, stable", () => {
    const issues = [w("w9", 9), w("summary"), e("e27", 27), w("w2", 2), w("w2b", 2), e("e-none")];
    expect(sortIssues(issues).map((i) => i.message)).toEqual([
      "e27",
      "e-none",
      "w2",
      "w2b",
      "w9",
      "summary",
    ]);
    expect(issues[0]?.message).toBe("w9"); // not mutated
  });

  it("counts and formats issues as plain text", () => {
    const issues = [e("Duplicate table", 27), w("Skipped 3 statements")];
    expect(countIssues(issues)).toEqual({ errors: 1, warnings: 1 });
    expect(issuesToText(issues)).toBe(
      "ERROR   line 27   Duplicate table\nWARNING           Skipped 3 statements",
    );
  });
});
