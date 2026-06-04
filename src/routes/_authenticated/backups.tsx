import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { useRoles } from "@/hooks/use-role";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Database, Download, RefreshCw, Trash2, Upload, FileSpreadsheet,
  FileJson, ShieldAlert, ArrowRight, HardDriveDownload, Clock, User as UserIcon,
} from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import * as XLSX from "xlsx";
import { z } from "zod";

export const Route = createFileRoute("/_authenticated/backups")({
  component: BackupsPage,
});

// Tables included in the backup snapshot (all RLS-scoped to current user)
const TABLES = [
  "clients",
  "cases",
  "sessions",
  "payments",
  "payment_installments",
  "documents",
  "case_activities",
] as const;

type TableName = (typeof TABLES)[number];

type Snapshot = {
  version: 1;
  created_at: string;
  user_id: string;
  tables: Record<TableName, any[]>;
};

/** Strict Zod schema for restore payloads: bounded sizes, UUIDs validated. */
const MAX_ROWS_PER_TABLE = 10_000;
const RowSchema = z.record(z.string().min(1).max(128), z.any()).refine(
  (r) => !("id" in r) || (typeof r.id === "string" && z.string().uuid().safeParse(r.id).success),
  { message: "row.id must be a valid UUID" },
);
const SnapshotSchema = z.object({
  version: z.literal(1),
  created_at: z.string().min(1).max(64),
  user_id: z.string().uuid().optional().or(z.literal("")),
  tables: z.object(
    Object.fromEntries(TABLES.map((t) => [t, z.array(RowSchema).max(MAX_ROWS_PER_TABLE).optional()])) as Record<TableName, z.ZodOptional<z.ZodArray<typeof RowSchema>>>,
  ),
});

function validateSnapshot(raw: unknown): Snapshot {
  const parsed = SnapshotSchema.safeParse(raw);
  if (!parsed.success) throw new Error("ملف غير صالح: " + parsed.error.issues[0]?.message);
  const tables = {} as Snapshot["tables"];
  for (const t of TABLES) tables[t] = (parsed.data.tables as any)[t] ?? [];
  return { version: 1, created_at: parsed.data.created_at, user_id: String(parsed.data.user_id ?? ""), tables };
}

function fmtBytes(n: number) {
  if (!n) return "0 KB";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

async function buildSnapshot(userId: string): Promise<Snapshot> {
  const tables: Record<string, any[]> = {};
  for (const t of TABLES) {
    const { data, error } = await supabase.from(t).select("*");
    if (error) throw new Error(`فشل قراءة ${t}: ${error.message}`);
    tables[t] = data ?? [];
  }
  return {
    version: 1,
    created_at: new Date().toISOString(),
    user_id: userId,
    tables: tables as Snapshot["tables"],
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function snapshotToXlsx(snap: Snapshot): Blob {
  const wb = XLSX.utils.book_new();
  for (const t of TABLES) {
    const rows = snap.tables[t] ?? [];
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
    XLSX.utils.book_append_sheet(wb, ws, t.slice(0, 31));
  }
  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

function BackupsPage() {
  const { isAdmin } = useRoles();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [restoreFor, setRestoreFor] = useState<{ id: string; file_path: string } | null>(null);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  const { data: backups = [], isLoading } = useQuery({
    queryKey: ["backups"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("backups")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // --- Create backup (uploads JSON to storage + records history row) ---
  const createBackup = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("انتهت الجلسة");
      setBusy("create");
      const snap = await buildSnapshot(user.id);
      const json = JSON.stringify(snap, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      const path = `${user.id}/backup-${stamp}.json`;

      const { error: upErr } = await supabase.storage.from("backups").upload(path, blob, {
        contentType: "application/json",
        upsert: false,
      });
      if (upErr) throw upErr;

      const counts: Record<string, number> = {};
      for (const t of TABLES) counts[t] = snap.tables[t]?.length ?? 0;

      const { error: insErr } = await supabase.from("backups").insert({
        user_id: user.id,
        created_by_name: (user as any).user_metadata?.full_name || user.email || null,
        file_path: path,
        size_bytes: blob.size,
        record_counts: counts,
      });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("تم إنشاء النسخة الاحتياطية");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  // --- Quick export (live snapshot, no history row) ---
  const exportLive = async (kind: "json" | "xlsx") => {
    if (!user?.id) return;
    try {
      setBusy(`export-${kind}`);
      const snap = await buildSnapshot(user.id);
      const stamp = format(new Date(), "yyyy-MM-dd-HHmm");
      if (kind === "json") {
        downloadBlob(new Blob([JSON.stringify(snap, null, 2)], { type: "application/json" }), `backup-${stamp}.json`);
      } else {
        downloadBlob(snapshotToXlsx(snap), `backup-${stamp}.xlsx`);
      }
      toast.success("تم التصدير");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  // --- Download a stored backup (JSON or Excel) ---
  const downloadStored = async (path: string, kind: "json" | "xlsx") => {
    try {
      setBusy(`dl-${path}-${kind}`);
      const { data, error } = await supabase.storage.from("backups").download(path);
      if (error) throw error;
      const text = await data.text();
      const snap = validateSnapshot(JSON.parse(text));
      const name = path.split("/").pop()?.replace(/\.json$/, "") || "backup";
      if (kind === "json") downloadBlob(new Blob([text], { type: "application/json" }), `${name}.json`);
      else downloadBlob(snapshotToXlsx(snap), `${name}.xlsx`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  // --- Delete a backup ---
  const del = useMutation({
    mutationFn: async (b: { id: string; file_path: string }) => {
      await supabase.storage.from("backups").remove([b.file_path]);
      const { error } = await supabase.from("backups").delete().eq("id", b.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف النسخة");
      qc.invalidateQueries({ queryKey: ["backups"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // --- Restore from a backup ---
  async function runRestore(snap: Snapshot) {
    if (!user?.id) throw new Error("انتهت الجلسة");
    // Insert in dependency order, rewrite user_id to current user, upsert by id
    const order: TableName[] = ["clients", "cases", "payments", "payment_installments", "sessions", "documents", "case_activities"];
    for (const t of order) {
      const rows = (snap.tables[t] ?? []).map((r: any) => ({ ...r, user_id: user.id }));
      if (!rows.length) continue;
      const { error } = await supabase.from(t).upsert(rows, { onConflict: "id" });
      if (error) throw new Error(`فشل استعادة ${t}: ${error.message}`);
    }
  }

  const restoreStored = useMutation({
    mutationFn: async (b: { file_path: string }) => {
      setBusy("restore");
      const { data, error } = await supabase.storage.from("backups").download(b.file_path);
      if (error) throw error;
      const snap = validateSnapshot(JSON.parse(await data.text()));
      await runRestore(snap);
    },
    onSuccess: () => {
      toast.success("تمت استعادة البيانات بنجاح");
      setRestoreFor(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  const restoreFromFile = useMutation({
    mutationFn: async (file: File) => {
      setBusy("restore-file");
      const text = await file.text();
      const snap = validateSnapshot(JSON.parse(text));
      await runRestore(snap);
    },
    onSuccess: () => {
      toast.success("تمت الاستعادة من الملف");
      setRestoreFile(null);
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message),
    onSettled: () => setBusy(null),
  });

  if (!isAdmin) {
    return (
      <div>
        <TopBar />
        <div className="glass-card p-8 text-center max-w-md mx-auto mt-10">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-1">صلاحية مسؤول مطلوبة</h2>
          <p className="text-sm text-muted-foreground mb-4">صفحة النسخ الاحتياطي متاحة للمسؤولين فقط.</p>
          <Link to="/dashboard" className="text-sm text-[var(--gold)] inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4" /> العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <TopBar />
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Database className="w-7 h-7 text-[var(--gold)]" /> النسخ الاحتياطي
        </h1>
        <p className="text-muted-foreground mt-1">إنشاء واستعادة نسخ احتياطية كاملة لبيانات المكتب.</p>
      </div>

      {/* Actions */}
      <div className="grid md:grid-cols-3 gap-3 mb-6">
        <button
          disabled={busy === "create"}
          onClick={() => createBackup.mutate()}
          className="btn-gold rounded-xl p-4 flex items-center gap-3 font-semibold disabled:opacity-60"
        >
          <HardDriveDownload className="w-5 h-5" />
          <div className="text-right">
            <div className="text-sm">{busy === "create" ? "جارٍ الإنشاء..." : "إنشاء نسخة احتياطية"}</div>
            <div className="text-[11px] opacity-80 font-normal">حفظ + إضافة للسجل</div>
          </div>
        </button>
        <button
          disabled={busy === "export-xlsx"}
          onClick={() => exportLive("xlsx")}
          className="glass-card hover:border-[var(--gold)] rounded-xl p-4 flex items-center gap-3 transition"
        >
          <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
          <div className="text-right">
            <div className="text-sm font-semibold">{busy === "export-xlsx" ? "..." : "تصدير Excel"}</div>
            <div className="text-[11px] text-muted-foreground">تنزيل فوري بدون حفظ</div>
          </div>
        </button>
        <button
          disabled={busy === "export-json"}
          onClick={() => exportLive("json")}
          className="glass-card hover:border-[var(--gold)] rounded-xl p-4 flex items-center gap-3 transition"
        >
          <FileJson className="w-5 h-5 text-sky-400" />
          <div className="text-right">
            <div className="text-sm font-semibold">{busy === "export-json" ? "..." : "تصدير JSON"}</div>
            <div className="text-[11px] text-muted-foreground">تنزيل فوري بدون حفظ</div>
          </div>
        </button>
      </div>

      {/* Restore from file */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-semibold flex items-center gap-2"><Upload className="w-4 h-4 text-[var(--gold)]" /> استعادة من ملف JSON</div>
            <div className="text-xs text-muted-foreground mt-1">ارفع ملف نسخة احتياطية (.json) لاستعادته.</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => setRestoreFile(e.target.files?.[0] ?? null)}
              className="text-xs file:ml-2 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-foreground"
            />
            <button
              disabled={!restoreFile || busy === "restore-file"}
              onClick={() => restoreFile && restoreFromFile.mutate(restoreFile)}
              className="px-3 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" /> {busy === "restore-file" ? "..." : "استعادة"}
            </button>
          </div>
        </div>
      </div>

      {/* History */}
      <h2 className="text-lg font-bold mb-3">سجل النسخ الاحتياطية</h2>
      {isLoading ? (
        <div className="grid gap-3 animate-pulse">
          {[0, 1, 2].map((i) => <div key={i} className="h-20 bg-muted/50 rounded-xl" />)}
        </div>
      ) : backups.length === 0 ? (
        <EmptyState icon={Database} title="لا توجد نسخ بعد" description="أنشئ أول نسخة احتياطية لحفظ بيانات المكتب." />
      ) : (
        <div className="grid gap-3">
          {backups.map((b: any) => {
            const counts = b.record_counts || {};
            const total = Object.values(counts).reduce((s: number, n: any) => s + Number(n || 0), 0);
            return (
              <div key={b.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-semibold text-sm flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[var(--gold)]" />
                        {format(new Date(b.created_at), "yyyy/MM/dd — HH:mm")}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                        {fmtBytes(b.size_bytes)}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                        {total} سجل
                      </span>
                    </div>
                    {b.created_by_name && (
                      <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <UserIcon className="w-3 h-3" /> {b.created_by_name}
                      </div>
                    )}
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(counts).map(([k, v]: any) => (
                        <span key={k} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground border border-border">
                          {k}: {v}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => downloadStored(b.file_path, "xlsx")}
                      disabled={busy === `dl-${b.file_path}-xlsx`}
                      className="px-2.5 py-1.5 rounded-md border border-border hover:border-[var(--gold)] text-xs flex items-center gap-1"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel
                    </button>
                    <button
                      onClick={() => downloadStored(b.file_path, "json")}
                      disabled={busy === `dl-${b.file_path}-json`}
                      className="px-2.5 py-1.5 rounded-md border border-border hover:border-[var(--gold)] text-xs flex items-center gap-1"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" /> JSON
                    </button>
                    <button
                      onClick={() => setRestoreFor({ id: b.id, file_path: b.file_path })}
                      className="px-2.5 py-1.5 rounded-md border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-xs flex items-center gap-1 font-semibold"
                    >
                      <RefreshCw className="w-3.5 h-3.5" /> استعادة
                    </button>
                    <button
                      onClick={() => del.mutate({ id: b.id, file_path: b.file_path })}
                      className="px-2.5 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Restore confirmation */}
      {restoreFor && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 border-amber-500/40">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-5 h-5 text-amber-300" />
              <h3 className="text-lg font-bold text-amber-300">تأكيد الاستعادة</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              سيتم استعادة جميع السجلات من النسخة الاحتياطية ودمجها مع البيانات الحالية (سيتم تحديث السجلات المطابقة بنفس المعرّف).
            </p>
            <p className="text-xs text-rose-400 mb-4">تحذير: قد يتم استبدال بيانات حالية إذا كانت معرفاتها مطابقة.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setRestoreFor(null)} className="px-4 py-2 rounded-md border border-border text-sm">إلغاء</button>
              <button
                disabled={busy === "restore"}
                onClick={() => restoreStored.mutate(restoreFor)}
                className="px-4 py-2 rounded-md bg-amber-500 text-black text-sm font-semibold"
              >
                {busy === "restore" ? "جارٍ الاستعادة..." : "نعم، استعادة"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
