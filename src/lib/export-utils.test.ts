import { beforeEach, describe, expect, it, vi } from "vitest";

const xlsxCalls = vi.hoisted(() => ({
  bookNew: vi.fn(),
  jsonToSheet: vi.fn(),
  bookAppendSheet: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: xlsxCalls.bookNew,
    json_to_sheet: xlsxCalls.jsonToSheet,
    book_append_sheet: xlsxCalls.bookAppendSheet,
  },
  writeFile: xlsxCalls.writeFile,
}));

describe("export-utils", () => {
  beforeEach(() => {
    xlsxCalls.bookNew.mockReturnValue({ sheets: [] });
    xlsxCalls.jsonToSheet.mockReturnValue({});
  });

  it("exports sheets as RTL Excel workbooks", async () => {
    const { exportToExcel } = await import("./export-utils");

    await exportToExcel("report", [
      {
        name: "Very long sheet name that should be trimmed after thirty one characters",
        rows: [{ name: "أحمد", amount: 100 }],
      },
    ]);

    expect(xlsxCalls.bookNew).toHaveBeenCalledOnce();
    expect(xlsxCalls.jsonToSheet).toHaveBeenCalledWith([{ name: "أحمد", amount: 100 }]);
    expect(xlsxCalls.bookAppendSheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ "!views": [{ RTL: true }] }),
      "Very long sheet name that shoul",
    );
    expect(xlsxCalls.writeFile).toHaveBeenCalledWith(expect.any(Object), "report.xlsx");
  });
});
