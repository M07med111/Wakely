import { z } from "zod";

export const BACKUP_TABLES = [
  "clients",
  "cases",
  "sessions",
  "payments",
  "payment_installments",
  "documents",
  "case_activities",
] as const;

export type BackupTableName = (typeof BACKUP_TABLES)[number];

export type BackupSnapshot = {
  version: 1;
  created_at: string;
  user_id: string;
  tables: Record<BackupTableName, any[]>;
};

const MAX_ROWS_PER_TABLE = 10_000;
const RowSchema = z
  .record(z.string().min(1).max(128), z.any())
  .refine(
    (row) =>
      !("id" in row) || (typeof row.id === "string" && z.string().uuid().safeParse(row.id).success),
    { message: "row.id must be a valid UUID" },
  );

const SnapshotSchema = z.object({
  version: z.literal(1),
  created_at: z.string().min(1).max(64),
  user_id: z.string().uuid().optional().or(z.literal("")),
  tables: z.object(
    Object.fromEntries(
      BACKUP_TABLES.map((table) => [table, z.array(RowSchema).max(MAX_ROWS_PER_TABLE).optional()]),
    ) as Record<BackupTableName, z.ZodOptional<z.ZodArray<typeof RowSchema>>>,
  ),
});

export function validateSnapshot(raw: unknown): BackupSnapshot {
  const parsed = SnapshotSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error("Invalid backup file: " + parsed.error.issues[0]?.message);
  }

  const tables = {} as BackupSnapshot["tables"];
  for (const table of BACKUP_TABLES) {
    tables[table] = (parsed.data.tables as Partial<BackupSnapshot["tables"]>)[table] ?? [];
  }

  return {
    version: 1,
    created_at: parsed.data.created_at,
    user_id: String(parsed.data.user_id ?? ""),
    tables,
  };
}

export async function snapshotToXlsx(snapshot: BackupSnapshot): Promise<Blob> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();

  for (const table of BACKUP_TABLES) {
    const rows = snapshot.tables[table] ?? [];
    const worksheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(workbook, worksheet, table.slice(0, 31));
  }

  const output = XLSX.write(workbook, { type: "array", bookType: "xlsx" });
  return new Blob([output], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}
