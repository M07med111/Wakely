import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { format } from "date-fns";
import { CalendarDays, ArchiveRestore, Trash2, ArrowRight } from "lucide-react";
import { useState } from "react";
import { formatCaseId } from "@/lib/case-format";
import { PageError } from "@/components/page-feedback";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/sessions_/archived")({
  component: ArchivedSessionsPage,
});

function ArchivedSessionsPage() {
  const qc = useQueryClient();
  const { data: archivedSessions = [], error, isLoading } = useQuery({
    queryKey: ["archived-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select(
          "*, cases(id, case_number, case_year, case_category, court_location, court_name, status, clients(id, full_name))",
        )
        .eq("is_archived", true)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [confirmRestoreId, setConfirmRestoreId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const restoreMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("sessions")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت استعادة الجلسة بنجاح");
      setConfirmRestoreId(null);
      qc.invalidateQueries({ queryKey: ["archived-sessions"] });
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الجلسة بنجاح");
      setConfirmDeleteId(null);
      qc.invalidateQueries({ queryKey: ["archived-sessions"] });
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (error) return <PageError message={(error as Error).message} />;

  return (
    <div>
      <TopBar />
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <ArchiveRestore className="w-8 h-8 text-[var(--gold)]" /> الجلسات المؤرشفة
          </h1>
          <p className="text-muted-foreground mt-1">سجل الجلسات التي تمت أرشفتها</p>
        </div>
        <Link
          to="/sessions"
          className="flex items-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted text-sm font-medium transition"
        >
          <ArrowRight className="w-4 h-4" /> العودة للجلسات
        </Link>
      </div>

      <div className="glass-card p-6 mb-6">
        <h2 className="font-bold mb-4">
          الجلسات المؤرشفة ({archivedSessions.length})
        </h2>
        {isLoading ? (
          <div className="space-y-3 animate-pulse">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded-xl" />
            ))}
          </div>
        ) : archivedSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">لا توجد جلسات مؤرشفة.</p>
        ) : (
          <div className="space-y-2">
            {archivedSessions.map((s: any) => (
              <div
                key={s?.id}
                className="p-4 rounded-md border border-border opacity-80 hover:opacity-100 transition"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="font-semibold text-muted-foreground">
                    {format(new Date(s.session_date), "EEEE — yyyy/MM/dd HH:mm")}
                  </div>
                  <div className="text-sm">
                    {s.cases?.id ? (
                      <Link
                        to="/cases/$id"
                        params={{ id: s.cases.id }}
                        className="hover:text-[var(--gold)]"
                      >
                        {formatCaseId(s.cases ?? {})}
                      </Link>
                    ) : (
                      formatCaseId(s.cases ?? {})
                    )}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {s.cases?.clients?.id ? (
                    <Link
                      to="/clients/$id"
                      params={{ id: s.cases.clients.id }}
                      className="hover:text-[var(--gold)]"
                    >
                      {s.cases.clients.full_name}
                    </Link>
                  ) : (
                    s.cases?.clients?.full_name
                  )}{" "}
                  • {s.cases?.court_name ?? s.cases?.court_location ?? "—"}
                </div>
                <div className="flex justify-between items-end mt-3">
                  <div className="text-xs text-muted-foreground">
                    {s.notes && <span className="block mb-1">{s.notes}</span>}
                    {s.archived_at && (
                      <span className="italic">
                        تاريخ الأرشفة: {format(new Date(s.archived_at), "yyyy/MM/dd")}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmRestoreId(s.id)}
                      title="استعادة الجلسة"
                      className="p-2 rounded-md border border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 flex items-center gap-1 text-xs"
                    >
                      <ArchiveRestore className="w-4 h-4" /> استعادة
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(s.id)}
                      title="حذف نهائي"
                      className="p-2 rounded-md border border-rose-500/40 text-rose-500 hover:bg-rose-500/10 flex items-center gap-1 text-xs"
                    >
                      <Trash2 className="w-4 h-4" /> حذف نهائي
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Restore Modal */}
      {confirmRestoreId && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6">
            <h3 className="text-lg font-bold mb-2">تأكيد الاستعادة</h3>
            <p className="text-sm text-muted-foreground mb-6">
              هل أنت متأكد من رغبتك في استعادة هذه الجلسة إلى قائمة الجلسات النشطة؟
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmRestoreId(null)}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                إلغاء
              </button>
              <button
                disabled={restoreMutation.isPending}
                onClick={() => restoreMutation.mutate(confirmRestoreId)}
                className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-semibold"
              >
                {restoreMutation.isPending ? "جاري الاستعادة..." : "تأكيد الاستعادة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 border-rose-500/40">
            <h3 className="text-lg font-bold text-rose-400 mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-muted-foreground mb-6">
              هل أنت متأكد من رغبتك في حذف هذه الجلسة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                إلغاء
              </button>
              <button
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(confirmDeleteId)}
                className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold"
              >
                {deleteMutation.isPending ? "جاري الحذف..." : "تأكيد الحذف"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
