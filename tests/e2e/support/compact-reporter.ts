import type { FullResult, Reporter, TestCase, TestResult } from "@playwright/test/reporter";

/** Prints one summary line plus one line per failure (title path and the first line of the error). */
export default class CompactReporter implements Reporter {
  private passed = 0;
  private failed = 0;
  private skipped = 0;
  private readonly failures: string[] = [];

  onTestEnd(test: TestCase, result: TestResult): void {
    if (result.status === "skipped") {
      this.skipped += 1;
    } else if (result.status === "passed") {
      this.passed += 1;
    } else {
      this.failed += 1;
      const first = firstLine(result.error?.message ?? result.status);
      this.failures.push(`  ✗ ${test.titlePath().slice(2).join(" › ")}\n      ${first}`);
    }
  }

  onEnd(result: FullResult): void {
    const head = `e2e: ${this.passed} passed, ${this.failed} failed, ${this.skipped} skipped`;
    const lines = [head, ...this.failures];
    if (result.status === "interrupted") lines.push("  (run interrupted)");
    console.log(lines.join("\n"));
  }

  printsToStdio(): boolean {
    return true;
  }
}

const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, "g");

/** One line: for failed expectations "Locator · Expected · Received", else the first line. */
function firstLine(message: string): string {
  const lines = message
    .replace(ANSI, "")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  const detail = lines.filter((l) => /^(Locator|Expected|Received)[a-z ]*:/i.test(l));
  const text = detail.length > 0 ? detail.join(" · ") : (lines[0] ?? "");
  return text.length > 240 ? `${text.slice(0, 237)}...` : text;
}
