import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { ArrowRight, Archive, ArchiveRestore, UserCircle2, Phone, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { useState } from "react";
import { useRoles } from "@/hooks/use-role";
import { format } from "date-fns";
import { ArchivedClientDetailsModal } from "@/components/archived-client-details-modal";
import { PageError } from "@/components/page-feedback";

export const Route = createFileRoute("/_authenticated/clients/archived")({
  component: ArchivedClientsPage,
});

function ArchivedClientsPage() {
  const qc = useQueryClient();
  const { isAdmin } = useRoles();
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmHardDel, setConfirmHardDel] = useState<{
    id: string;
    name: string;
    step: 1 | 2;
  } | null>(null);

  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ["clients-archived"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("is_archived", true)
        .order("archived_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const restore = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت استعادة الموكل");
      qc.invalidateQueries({ queryKey: ["clients-archived"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const hardDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف النهائي");
      setConfirmHardDel(null);
      qc.invalidateQueries({ queryKey: ["clients-archived"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div>
      <TopBar />
      <Link
        to="/clients"
        className="text-sm text-muted-foreground hover:text-[var(--gold)] flex items-center gap-1 mb-4"
      >
        <ArrowRight className="w-4 h-4" /> رجوع للموكلين النشطين
      </Link>
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Archive className="w-7 h-7 text-[var(--gold)]" /> الموكلون المؤرشفون
        </h1>
        <p className="text-muted-foreground mt-1">
          يمكنك استعادة أي موكل لإعادته للقوائم الرئيسية.
        </p>
      </div>

      {error ? (
        <PageError message={(error as Error).message} />
      ) : isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-32 bg-muted/50 rounded-xl" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <EmptyState
          icon={Archive}
          title="لا يوجد موكلون مؤرشفون"
          description="جميع موكليك نشطون حالياً."
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients
            .filter((c: any) => c?.id)
            .map((c: any) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => setOpenId(c.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setOpenId(c.id);
                  }
                }}
                className="glass-card p-5 opacity-90 cursor-pointer hover:border-[var(--gold)] transition text-right"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-secondary grid place-items-center text-[var(--gold)]">
                    <UserCircle2 className="w-7 h-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate">{c.full_name}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {c.phone || "—"}
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                    مؤرشف
                  </span>
                </div>
                {c.archived_at && (
                  <div className="text-[11px] text-muted-foreground mb-3">
                    أُرشف في: {format(new Date(c.archived_at), "yyyy/MM/dd")}
                  </div>
                )}
                <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      restore.mutate(c.id);
                    }}
                    disabled={restore.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" /> استعادة الموكل
                  </button>
                  {isAdmin && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmHardDel({ id: c.id, name: c.full_name, step: 1 });
                      }}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold"
                      title="حذف نهائي (مسؤول فقط)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {confirmHardDel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 border-rose-500/40">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-lg font-bold text-rose-400">حذف نهائي</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              سيتم حذف الموكل <strong className="text-foreground">{confirmHardDel.name}</strong>{" "}
              وجميع القضايا والجلسات والمدفوعات والمستندات نهائياً ولا يمكن التراجع عن هذه العملية.
            </p>
            {confirmHardDel.step === 2 && (
              <div className="mb-4 p-3 rounded-md bg-rose-500/10 border border-rose-500/40 text-sm text-rose-300">
                تأكيد أخير: هل أنت متأكد تماماً؟
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmHardDel(null)}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                إلغاء
              </button>
              {confirmHardDel.step === 1 ? (
                <button
                  onClick={() => setConfirmHardDel({ ...confirmHardDel, step: 2 })}
                  className="px-4 py-2 rounded-md bg-rose-500/80 text-white text-sm font-semibold"
                >
                  متابعة
                </button>
              ) : (
                <button
                  disabled={hardDelete.isPending}
                  onClick={() => hardDelete.mutate(confirmHardDel.id)}
                  className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold"
                >
                  {hardDelete.isPending ? "..." : "حذف نهائي"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      <ArchivedClientDetailsModal clientId={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}
