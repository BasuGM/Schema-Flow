// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { SchemaCanvas } from "@/components/canvas/schema-canvas";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toolbar } from "@/components/workspace/toolbar";
import { useEscapeToClear } from "@/components/workspace/use-escape-to-clear";
import { useLayoutStore } from "@/stores/layout-store";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";
import { BUSY_IMPORT_TABLES } from "./import-dialog";
import { loadParsers } from "./use-import-parse";

// jsdom: `import.meta.url` is not a file URL here, so resolve fixtures from the project root.
const fixture = (path: string) => readFileSync(join(process.cwd(), "tests/fixtures", path), "utf8");
const fileOf = (name: string, content: BlobPart) => new File([content], name);

function Harness() {
  useEscapeToClear();
  return (
    <TooltipProvider>
      <Toolbar />
      <div style={{ width: 1000, height: 700 }}>
        <SchemaCanvas />
      </div>
    </TooltipProvider>
  );
}

async function openDialog() {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByTestId("toolbar-import"));
  await screen.findByTestId("import-dialog");
  return user;
}

const paste = (text: string) =>
  fireEvent.input(screen.getByTestId("import-textarea"), { target: { value: text } });
const upload = (user: ReturnType<typeof userEvent.setup>, file: File) =>
  user.upload(screen.getByTestId("import-file-input"), file);
const status = () => screen.getByTestId("import-status");
const confirm = () => screen.getByTestId("import-confirm");
const nodeCount = () => document.querySelectorAll(".react-flow__node").length;

// The parsers are a lazily loaded chunk. Load them once up front, so a cold module transform under
// a loaded test run can't eat the 1 s `waitFor` of whichever test parses first.
beforeAll(() => loadParsers());
beforeEach(() => resetStores());

describe("Import dialog", () => {
  it("opens from the toolbar with focus in the textarea and states that nothing is uploaded", async () => {
    await openDialog();
    expect(screen.getByTestId("import-textarea")).toHaveFocus();
    expect(screen.getByTestId("import-dialog")).toHaveTextContent(
      "Parsed in your browser. Nothing is uploaded or executed.",
    );
    expect(screen.getByTestId("import-replace-note")).toHaveTextContent(
      "This replaces the current diagram.",
    );
    expect(status()).toHaveTextContent("Paste SQL DDL or a Prisma schema");
    expect(confirm()).toBeDisabled();
  });

  it("shows the Choose file… label's focus ring when the hidden input is keyboard-focused (QA-029)", async () => {
    await openDialog();
    // jsdom can't evaluate :has(:focus-visible); the computed ring is checked in e2e (bug-bash).
    const label = screen.getByTestId("import-file-input").closest("label");
    expect(label?.className).toContain("has-focus-visible:ring-3");
    expect(label?.className).toContain("has-focus-visible:ring-ring/50");
  });

  it("previews pasted SQL and replaces the diagram on import, then resets", async () => {
    const user = await openDialog();
    paste(fixture("sql/shop.mysql.sql"));
    await waitFor(() => expect(status()).toHaveTextContent("Parsed as MySQL SQL"));
    expect(screen.getByTestId("import-counts")).toHaveTextContent(
      "5 tables · 18 columns · 4 relationships",
    );
    expect(screen.getByTestId("import-issue-summary")).toHaveTextContent("No issues");
    expect(screen.getByTestId("import-format")).toHaveDisplayValue("Auto (detected: MySQL SQL)");
    expect(confirm()).toHaveTextContent("Import 5 tables");
    await user.click(confirm());
    await waitFor(() => expect(screen.queryByTestId("import-dialog")).toBeNull());
    expect(useSchemaStore.getState().schema?.tableOrder).toHaveLength(5);
    expect(screen.getByTestId("toolbar-schema-name")).toHaveTextContent("Pasted SQL");
    await waitFor(() => expect(nodeCount()).toBe(5));
    await user.click(screen.getByTestId("toolbar-import"));
    expect(await screen.findByTestId("import-textarea")).toHaveValue("");
  });

  it("shows a chosen file as a card (never in the textarea) and names the schema after it", async () => {
    const user = await openDialog();
    await upload(user, fileOf("blog.prisma", fixture("prisma/blog.prisma")));
    expect(screen.getByTestId("import-file-card")).toHaveTextContent("blog.prisma");
    expect(screen.queryByTestId("import-textarea")).toBeNull();
    expect(screen.getByTestId("import-format")).toHaveValue("prisma");
    await waitFor(() => expect(status()).toHaveTextContent("Parsed as Prisma schema"));
    expect(screen.getByTestId("import-counts")).toHaveTextContent(
      "9 tables · 31 columns · 11 relationships · 1 enum",
    );
    expect(screen.getByTestId("import-issue-summary")).toHaveTextContent("1 warning");
    await user.click(confirm());
    await waitFor(() =>
      expect(screen.getByTestId("toolbar-schema-name")).toHaveTextContent("blog"),
    );
  });

  it("allows importing with errors and lists issues with line badges, errors first", async () => {
    const user = await openDialog();
    await upload(user, fileOf("dump.ddl", fixture("sql/edge-cases.postgres.sql")));
    await waitFor(() => expect(confirm()).toHaveTextContent("Import 3 tables (1 error)"));
    expect(confirm()).toBeEnabled();
    expect(screen.getByTestId("import-issue-summary")).toHaveTextContent("1 error · 5 warnings");
    const issues = screen.getAllByTestId("import-issue");
    expect(issues).toHaveLength(6);
    expect(issues[0]).toHaveTextContent(/line 27.*Duplicate table/);
  });

  it("re-parses when the format changes", async () => {
    const user = await openDialog();
    paste("CREATE TABLE a (id int);");
    await waitFor(() => expect(status()).toHaveTextContent("Parsed as PostgreSQL SQL"));
    await user.selectOptions(screen.getByTestId("import-format"), "sqlite");
    await waitFor(() => expect(status()).toHaveTextContent("Parsed as SQLite SQL"));
    await user.selectOptions(screen.getByTestId("import-format"), "prisma");
    await waitFor(() => expect(status()).toHaveTextContent("Parsed as Prisma schema"));
    expect(screen.getByTestId("import-issues")).toHaveTextContent("No models were found.");
    expect(confirm()).toBeDisabled();
  });

  it("reads UTF-16 files and rejects binary or compressed ones", async () => {
    const user = await openDialog();
    const sql = "CREATE TABLE w (id int);";
    const utf16 = new Uint8Array([
      0xff,
      0xfe,
      ...Array.from(sql).flatMap((c) => [c.charCodeAt(0), 0]),
    ]);
    await upload(user, fileOf("ssms.sql", utf16));
    await waitFor(() => expect(confirm()).toHaveTextContent("Import 1 table"));

    await user.click(screen.getByTestId("import-file-remove"));
    await upload(user, fileOf("dump.sql.gz", new Uint8Array([0x1f, 0x8b, 8, 0, 0])));
    await waitFor(() =>
      expect(status()).toHaveTextContent("This looks like a binary or compressed file."),
    );
    expect(confirm()).toBeDisabled();

    await user.click(screen.getByTestId("import-file-remove"));
    await upload(user, fileOf("image", new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0])));
    await waitFor(() => expect(status()).toHaveTextContent("binary or compressed"));
  });

  it("says exact bytes when a file just over the limit would round to the limit (QA-024)", async () => {
    const user = await openDialog();
    const big = fileOf("edge.sql", "CREATE TABLE x (id int);");
    Object.defineProperty(big, "size", { value: 5 * 1024 * 1024 + 1 });
    await upload(user, big);
    expect(status()).toHaveTextContent("This file is 5,242,881 bytes; the limit is 5.0 MB.");
  });

  it("refuses files over 5 MB without reading them", async () => {
    const user = await openDialog();
    const big = fileOf("huge.sql", "CREATE TABLE x (id int);");
    Object.defineProperty(big, "size", { value: 6 * 1024 * 1024 });
    const read = vi.spyOn(big, "arrayBuffer");
    await upload(user, big);
    expect(status()).toHaveTextContent("This file is 6.0 MB; the limit is 5.0 MB.");
    expect(confirm()).toBeDisabled();
    expect(read).not.toHaveBeenCalled();
  });

  it("accepts a dropped file", async () => {
    await openDialog();
    const file = fileOf("schema.txt", fixture("sql/blog.sqlite.sql"));
    fireEvent.drop(screen.getByTestId("import-dropzone"), {
      dataTransfer: { files: [file], types: ["Files"] },
    });
    expect(screen.getByTestId("import-file-card")).toHaveTextContent("schema.txt");
    await waitFor(() => expect(confirm()).toHaveTextContent("Import 4 tables"));
  });

  it("turns a paste over 1 MB into a card instead of keeping it in the textarea", async () => {
    await openDialog();
    const big = `${"-- padding line\n".repeat(70_000)}CREATE TABLE p (id int);`;
    paste(big);
    expect(await screen.findByTestId("import-file-card")).toHaveTextContent("Pasted text");
    await waitFor(() => expect(confirm()).toHaveTextContent("Import 1 table"));
  });

  it("keeps the draft (even uncommitted typing) and the canvas selection on Cancel or Escape", async () => {
    const user = await openDialog();
    act(() => useUiStore.getState().selectTable("public.orders"));
    paste("CREATE TABLE draft (id int);");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("import-dialog")).toBeNull());
    expect(useUiStore.getState().selectedTableId).toBe("public.orders");

    await user.click(screen.getByTestId("toolbar-import"));
    expect(await screen.findByTestId("import-textarea")).toHaveValue(
      "CREATE TABLE draft (id int);",
    );
    await user.click(screen.getByTestId("import-cancel"));
    expect(useUiStore.getState().selectedTableId).toBe("public.orders");
    expect(useSchemaStore.getState().schema?.name).toBe("E-commerce sample");
  });

  it("clears selection, pinned edge and filter on import, and reuses the layout for the same file", async () => {
    const user = await openDialog();
    act(() => {
      useUiStore.getState().selectTable("public.orders");
      useUiStore.getState().setTableFilter("ord");
    });
    const clearRequest = useUiStore.getState().clearRequest;
    const importShop = async () => {
      await upload(user, fileOf("shop.sql", fixture("sql/shop.mysql.sql")));
      await waitFor(() => expect(confirm()).toHaveTextContent("Import 5 tables"));
      await user.click(confirm());
      await waitFor(() => expect(screen.queryByTestId("import-dialog")).toBeNull());
    };
    await importShop();
    const ui = useUiStore.getState();
    expect([ui.selectedTableId, ui.tableFilter, ui.clearRequest]).toEqual([
      null,
      "",
      clearRequest + 1,
    ]);
    const version = useLayoutStore.getState().version;

    await user.click(screen.getByTestId("toolbar-import"));
    await screen.findByTestId("import-dialog");
    await importShop();
    expect(useLayoutStore.getState().version).toBe(version);
  });

  it("does not show the Import tooltip when focus returns from the closed dialog (QA-015)", async () => {
    const user = await openDialog();
    await user.click(screen.getByTestId("import-cancel"));
    await waitFor(() => expect(screen.queryByTestId("import-dialog")).toBeNull());
    expect(screen.getByTestId("toolbar-import")).toHaveFocus();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(screen.queryByRole("tooltip")).toBeNull();

    // Keyboard focus still shows it afterwards.
    await user.tab();
    await user.tab({ shift: true });
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Import SQL or Prisma schema");
  });

  it("shows a busy state that paints before laying out a large schema", async () => {
    const user = await openDialog();
    const sql = Array.from(
      { length: BUSY_IMPORT_TABLES },
      (_, i) => `CREATE TABLE t${i} (id int);`,
    );
    await upload(user, fileOf("many.sql", sql.join("\n")));
    await waitFor(() => expect(confirm()).toHaveTextContent("Import 150 tables"));
    const before = useSchemaStore.getState().fingerprint;
    fireEvent.click(confirm());
    // The click itself only switches to the busy state; the layout runs after the next paint.
    expect(confirm()).toHaveTextContent("Laying out 150 tables…");
    expect(confirm()).toBeDisabled();
    expect(screen.getByTestId("import-cancel")).toBeDisabled();
    expect(screen.getByTestId("import-dialog")).toHaveAttribute("aria-busy", "true");
    expect(useSchemaStore.getState().fingerprint).toBe(before);
    await waitFor(() => expect(screen.queryByTestId("import-dialog")).toBeNull());
    expect(useSchemaStore.getState().schema?.tableOrder).toHaveLength(BUSY_IMPORT_TABLES);
  });
});
