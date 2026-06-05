import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BACKUP_TABLES,
  snapshotToXlsx,
  validateSnapshot,
  type BackupSnapshot,
} from "./backup-utils";

const xlsxCalls = vi.hoisted(() => ({
  bookNew: vi.fn(),
  jsonToSheet: vi.fn(),
  bookAppendSheet: vi.fn(),
  write: vi.fn(),
}));

vi.mock("xlsx", () => ({
  utils: {
    book_new: xlsxCalls.bookNew,
    json_to_sheet: xlsxCalls.jsonToSheet,
    book_append_sheet: xlsxCalls.bookAppendSheet,
  },
  write: xlsxCalls.write,
}));

function validSnapshot(overrides: Partial<BackupSnapshot> = {}): BackupSnapshot {
  const tables = BACKUP_TABLES.reduce(
    (acc, table) => {
      acc[table] = [];
      return acc;
    },
    {} as BackupSnapshot["tables"],
  );

  return {
    version: 1,
    created_at: "2026-06-05T12:00:00.000Z",
    user_id: "11111111-1111-4111-8111-111111111111",
    tables,
    ...overrides,
  };
}

describe("backup-utils", () => {
  beforeEach(() => {
    xlsxCalls.bookNew.mockReturnValue({ sheets: [] });
    xlsxCalls.jsonToSheet.mockReturnValue({});
    xlsxCalls.write.mockReturnValue(new Uint8Array([1, 2, 3]));
  });

  it("normalizes optional backup tables to empty arrays", () => {
    const snapshot = validateSnapshot({
      version: 1,
      created_at: "2026-06-05T12:00:00.000Z",
      user_id: "",
      tables: {
        clients: [{ id: "11111111-1111-4111-8111-111111111111", full_name: "أحمد" }],
      },
    });

    expect(snapshot.tables.clients).toHaveLength(1);
    expect(snapshot.tables.cases).toEqual([]);
    expect(snapshot.tables.case_activities).toEqual([]);
  });

  it("rejects restore rows with invalid UUID ids", () => {
    expect(() =>
      validateSnapshot({
        version: 1,
        created_at: "2026-06-05T12:00:00.000Z",
        user_id: "",
        tables: {
          clients: [{ id: "not-a-uuid", full_name: "أحمد" }],
        },
      }),
    ).toThrow("valid UUID");
  });

  it("creates one Excel worksheet per backup table", async () => {
    const blob = await snapshotToXlsx(
      validSnapshot({
        tables: {
          ...validSnapshot().tables,
          clients: [{ full_name: "أحمد" }],
        },
      }),
    );

    expect(blob.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    expect(xlsxCalls.bookNew).toHaveBeenCalledOnce();
    expect(xlsxCalls.bookAppendSheet).toHaveBeenCalledTimes(BACKUP_TABLES.length);
    expect(xlsxCalls.bookAppendSheet).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      "clients",
    );
  });
});
