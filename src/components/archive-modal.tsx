import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Archive,
  ArchiveRestore,
  Phone,
  Search,
  Trash2,
  UserCircle2,
  X,
  Calendar,
  Briefcase,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { useRoles } from "@/hooks/use-role";
import { ArchivedClientDetailsModal } from "@/components/archived-client-details-modal";

export function ArchiveModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { isAdmin } = useRoles();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [confirmHardDel, setConfirmHardDel] = useState<{
    id: string;
    name: string;
    step: 1 | 2;
  } | null>(null);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["clients-archived"],
    enabled: open,
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

  const ids = useMemo(() => clients.map((c: any) => c.id), [clients]);
  const { data: caseCounts = {} } = useQuery({
    queryKey: ["clients-archived-case-counts", ids],
    enabled: open && ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("client_id").in("client_id", ids);
      if (error) throw error;
      const map: Record<string, number> = {};
      (data ?? []).forEach((r: any) => {
        map[r.client_id] = (map[r.client_id] ?? 0) + 1;
      });
      return map;
    },
  });

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return clients;
    return clients.filter(
      (c: any) =>
        (c.full_name ?? "").toLowerCase().includes(term) ||
        (c.phone ?? "").toLowerCase().includes(term),
    );
  }, [clients, q]);

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

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:grid md:place-items-center md:p-4 flex items-end md:items-center">
        <div className="glass-card w-full md:max-w-3xl md:rounded-xl rounded-t-2xl md:max-h-[90vh] max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <Archive className="w-5 h-5 text-[var(--gold)] shrink-0" />
              <h3 className="text-lg font-bold truncate">الأرشيف</h3>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0">
                {clients.length} موكل
              </span>
            </div>
            <button onClick={onClose} className="p-2 rounded-md hover:bg-card" aria-label="إغلاق">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Search */}
          <div className="p-4 border-b border-border shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="ابحث بالاسم أو الهاتف..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full bg-input border border-border rounded-md pr-10 pl-3 py-2.5 text-sm outline-none focus:border-[var(--gold)]"
              />
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-4">
            {isLoading ? (
              <div className="space-y-3 animate-pulse">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 bg-muted/50 rounded-xl" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-12 text-sm text-muted-foreground">
                {clients.length === 0 ? "لا يوجد موكلون مؤرشفون" : "لا نتائج للبحث"}
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((c: any) => (
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
                    className="glass-card p-3 cursor-pointer hover:border-[var(--gold)] transition text-right"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-secondary grid place-items-center text-[var(--gold)] shrink-0">
                        <UserCircle2 className="w-6 h-6" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold truncate text-sm">{c.full_name}</div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {c.phone || "—"}
                          </span>
                          {c.archived_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(c.archived_at), "yyyy/MM/dd")}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" />
                            {caseCounts[c.id] ?? 0} قضية
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            restore.mutate(c.id);
                          }}
                          disabled={restore.isPending}
                          title="استعادة"
                          className="p-2 rounded-md border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmHardDel({ id: c.id, name: c.full_name, step: 1 });
                            }}
                            title="حذف نهائي"
                            className="p-2 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmHardDel && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 border-rose-500/40">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-lg font-bold text-rose-400">حذف نهائي</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              سيتم حذف الموكل <strong className="text-foreground">{confirmHardDel.name}</strong>{" "}
              وجميع القضايا والجلسات والمدفوعات والمستندات نهائياً ولا يمكن التراجع.
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
    </>
  );
}
