// @vitest-environment jsdom
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toolbar } from "@/components/workspace/toolbar";
import { generateSyntheticSchema } from "@/samples/synthetic";
import { createEcommerceSchema } from "@/samples/ecommerce";
import { useSchemaStore } from "@/stores/schema-store";
import { useUiStore } from "@/stores/ui-store";
import { resetStores } from "@/test/store-helpers";

const downloadBlob = vi.fn();
const copyText = vi.fn();
vi.mock("@/lib/download", () => ({ downloadBlob: (...a: unknown[]) => downloadBlob(...a) }));
vi.mock("@/lib/copy-text", () => ({ copyText: (...a: unknown[]) => copyText(...a) }));
vi.mock("@/lib/measure-text", async () => ({
  measureText: (await import("@/generators/export-palette")).approxMeasure,
}));

/** Lets a test hold the next generation until it calls `release()`. */
const gate = vi.hoisted(() => ({ hold: null as null | Promise<void> }));
vi.mock("@/lib/after-next-paint", () => ({
  afterNextPaint: () => {
    const held = gate.hold;
    gate.hold = null;
    return held ?? Promise.resolve();
  },
}));

function renderToolbar() {
  return render(
    <ThemeProvider attribute="class" defaultTheme="light">
      <TooltipProvider>
        <Toolbar />
      </TooltipProvider>
    </ThemeProvider>,
  );
}

const preview = () => screen.findByTestId("export-preview");

beforeEach(() => {
  downloadBlob.mockReset();
  copyText.mockReset();
  gate.hold = null;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  resetStores();
});

describe("Export dialog", () => {
  it("opens from the toolbar on SQL and shows a PostgreSQL preview with warnings info", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    expect(await preview()).toHaveTextContent("CREATE TABLE");
    expect(screen.getByTestId("export-tab-sql")).toHaveAttribute("data-state", "active");
    expect(screen.getByTestId("export-dialect-postgresql")).toBeChecked();
    expect(screen.getByTestId("export-text-size")).toHaveTextContent(/lines · [\d.]+ KB/);
    expect(screen.getByTestId("export-warnings")).toBeInTheDocument();
  });

  it("Settings → Export image… opens on the Image tab; Export… keeps the last tab", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-settings"));
    await user.click(await screen.findByTestId("settings-export-image"));
    expect(await screen.findByTestId("export-format-png")).toBeChecked();
    expect(screen.getByTestId("export-tab-image")).toHaveAttribute("data-state", "active");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.getByTestId("toolbar-settings")).toHaveFocus());
    await user.click(screen.getByTestId("toolbar-settings"));
    await user.click(await screen.findByTestId("settings-export"));
    expect(await screen.findByTestId("export-format-png")).toBeInTheDocument();
  });

  it("switches tabs with the arrow keys", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    screen.getByTestId("export-tab-sql").focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByTestId("export-tab-prisma")).toHaveAttribute("data-state", "active");
    expect(await preview()).toHaveTextContent("model");
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(await preview()).toHaveTextContent('"format"');
  });

  it("changes the SQL output with the dialect", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    await user.click(screen.getByTestId("export-dialect-mysql"));
    await waitFor(() =>
      expect(screen.getByTestId("export-preview")).toHaveTextContent("AUTO_INCREMENT"),
    );
    expect(screen.getByTestId("export-preview")).toHaveTextContent("(MySQL)");
  });

  it("defaults the dialect to the schema's source dialect", async () => {
    const base = createEcommerceSchema();
    resetStores({ ...base, source: { ...base.source, dialect: "mysql" } });
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    expect(screen.getByTestId("export-dialect-mysql")).toBeChecked();
  });

  it("lists warnings for a cross-dialect export", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    await user.click(screen.getByTestId("export-dialect-mysql"));
    await waitFor(() =>
      expect(screen.getByTestId("export-warnings")).toHaveTextContent(/\d+ warnings?/),
    );
  });

  it("Copy sends the full text; Download builds a named blob with the right type", async () => {
    copyText.mockResolvedValue("copied");
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    await user.click(screen.getByTestId("export-copy"));
    expect(copyText).toHaveBeenCalledTimes(1);
    expect(String(copyText.mock.calls[0]![0])).toContain("CREATE TABLE");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
    await user.click(screen.getByTestId("export-download-text"));
    const [blob, name] = downloadBlob.mock.calls[0] as [Blob, string];
    expect(name).toMatch(/\.postgresql\.sql$/);
    expect(blob.type).toMatch(/^application\/sql/);
    // The dialog stays open so several formats can be exported.
    expect(screen.getByTestId("export-dialog")).toBeInTheDocument();
  });

  it("reports a failed copy", async () => {
    copyText.mockResolvedValue("failed");
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    await user.click(screen.getByTestId("export-copy"));
    expect(await screen.findByText(/Copy failed/)).toBeInTheDocument();
  });

  it("keeps Copy and Download disabled until the text is ready", async () => {
    let release!: () => void;
    gate.hold = new Promise<void>((r) => (release = r));
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    expect(screen.getByTestId("export-copy")).toBeDisabled();
    expect(screen.getByTestId("export-download-text")).toBeDisabled();
    release();
    await preview();
    expect(screen.getByTestId("export-copy")).toBeEnabled();
  });

  it("truncates the preview of a large export but not what Copy sends", async () => {
    copyText.mockResolvedValue("copied");
    resetStores(generateSyntheticSchema({ tables: 400, seed: 1 }));
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    expect(await screen.findByTestId("export-preview-truncated")).toBeInTheDocument();
    await user.click(screen.getByTestId("export-copy"));
    const full = String(copyText.mock.calls[0]![0]);
    expect(full.length).toBeGreaterThan(screen.getByTestId("export-preview").textContent!.length);
  });

  it("shows new output after a re-import that changes only a default (cache keyed on revision)", async () => {
    const user = userEvent.setup();
    const a = createEcommerceSchema();
    resetStores(a);
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    const before = (await preview()).textContent;
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("export-dialog")).toBeNull());

    const b = structuredClone(a);
    const table = Object.values(b.tables).find((t) => t.columns.some((c) => !c.default))!;
    const column = table.columns.find((c) => !c.default)!;
    column.default = { kind: "literal", value: "'qa-changed-default'" };
    act(() => {
      useSchemaStore.getState().loadSchema(b);
    });
    await user.click(screen.getByTestId("toolbar-export"));
    await waitFor(() =>
      expect(screen.getByTestId("export-preview")).toHaveTextContent("qa-changed-default"),
    );
    expect(before).not.toContain("qa-changed-default");
  });

  it("never shows SQL text on the JSON tab when SQL finishes last", async () => {
    let release!: () => void;
    gate.hold = new Promise<void>((r) => (release = r));
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await user.click(screen.getByTestId("export-tab-json"));
    expect(await preview()).toHaveTextContent('"format"');
    await act(async () => {
      release();
      await new Promise((r) => setTimeout(r, 20));
    });
    const text = screen.getByTestId("export-preview").textContent!;
    expect(text).toContain('"format"');
    expect(text).not.toContain("CREATE TABLE");
    expect(useUiStore.getState().exportTab).toBe("json");
  });

  it("gives focus back to the toolbar button on Escape", async () => {
    const user = userEvent.setup();
    renderToolbar();
    await user.click(screen.getByTestId("toolbar-export"));
    await preview();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("export-dialog")).toBeNull());
    await waitFor(() => expect(screen.getByTestId("toolbar-export")).toHaveFocus());
  });
});
