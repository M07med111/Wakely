// Archived client details modal — read-only view with summary, tabs, restore & admin hard-delete.
import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  ExternalLink,
  Briefcase,
  Wallet,
  CalendarDays,
  FileText,
  User,
  Archive,
  ArchiveRestore,
  Trash2,
  Activity,
  ScrollText,
  CalendarPlus,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { DetailsModalShell } from "@/components/details-modal-shell";
import { useRoles } from "@/hooks/use-role";

const INFO_FIELDS: { key: string; label: string; full?: boolean }[] = [
  { key: "full_name", label: "الاسم الكامل" },
  { key: "phone", label: "الهاتف" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "national_id", label: "الرقم القومي" },
  { key: "address", label: "العنوان", full: true },
  { key: "notes", label: "ملاحظات", full: true },
];

const POA_FIELDS: { key: string; label: string }[] = [
  { key: "poa_number", label: "رقم التوكيل" },
  { key: "poa_year", label: "سنة التوكيل" },
  { key: "poa_letter", label: "حرف التوكيل" },
  { key: "poa_type", label: "نوع التوكيل" },
  { key: "client_role", label: "الصفة" },
  { key: "notarization_office", label: "مكتب التوثيق" },
];

export function ArchivedClientDetailsModal({
  clientId,
  onClose,
}: {
  clientId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { isAdmin } = useRoles();
  const open = !!clientId;
  const [confirmHardDel, setConfirmHardDel] = useState<1 | 2 | null>(null);

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["client-cases", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("cases")
          .select("*")
          .eq("client_id", clientId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*")
          .eq("client_id", clientId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", clientId],
    enabled: !!clientId,
    queryFn: async () =>
      (
        await supabase
          .from("documents")
          .select("*")
          .eq("client_id", clientId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["client-sessions", clientId, cases.length],
    enabled: !!clientId && cases.length > 0,
    queryFn: async () => {
      const ids = cases.map((c: any) => c?.id).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("sessions")
        .select("*, cases(case_number)")
        .in("case_id", ids)
        .order("session_date", { ascending: false });
      return data ?? [];
    },
  });

  const totals = useMemo(() => {
    const total = payments.reduce(
      (a: number, p: any) => a + Number(p.total_amount ?? p.amount ?? 0),
      0,
    );
    const paid = payments
      .filter((p: any) => p.status === "paid")
      .reduce((a: number, p: any) => a + Number(p.total_amount ?? p.amount ?? 0), 0);
    return { total, paid, remaining: Math.max(0, total - paid) };
  }, [payments]);

  const activity = useMemo(() => {
    const out: { id: string; date: string; title: string; hint?: string; icon: any }[] = [];
    sessions.forEach((s: any) =>
      out.push({
        id: `s-${s.id}`,
        date: s.created_at ?? s.session_date,
        icon: CalendarPlus,
        title: "تمت إضافة جلسة",
        hint: format(new Date(s.session_date), "yyyy/MM/dd HH:mm"),
      }),
    );
    documents.forEach((d: any) =>
      out.push({
        id: `d-${d.id}`,
        date: d.created_at,
        icon: FileText,
        title: "تم رفع مستند",
        hint: d.name,
      }),
    );
    payments.forEach((p: any) =>
      out.push({
        id: `p-${p.id}`,
        date: p.paid_at ?? p.created_at,
        icon: Wallet,
        title: p.status === "paid" ? "تم تسجيل دفعة مدفوعة" : "تم إضافة دفعة معلّقة",
        hint: `${Number(p.total_amount ?? p.amount ?? 0).toLocaleString()} ج.م`,
      }),
    );
    cases.forEach((c: any) =>
      out.push({
        id: `c-${c.id}`,
        date: c.created_at,
        icon: Briefcase,
        title: "تم فتح القضية",
        hint: `قضية #${c.case_number}`,
      }),
    );
    if (client?.archived_at)
      out.push({
        id: "arch",
        date: client.archived_at,
        icon: Archive,
        title: "تمت أرشفة الموكل",
      });
    return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
  }, [sessions, documents, payments, cases, client]);

  const restore = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("clients")
        .update({ is_archived: false, archived_at: null })
        .eq("id", clientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت استعادة الموكل");
      qc.invalidateQueries({ queryKey: ["clients-archived"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const hardDelete = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", clientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف النهائي");
      setConfirmHardDel(null);
      qc.invalidateQueries({ queryKey: ["clients-archived"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const title = (
    <span className="flex items-center gap-2">
      <span className="truncate">{client?.full_name ?? (isLoading ? "..." : "موكل")}</span>
      <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border shrink-0">
        <Archive className="w-3 h-3 inline ml-1" /> موكل مؤرشف
      </span>
    </span>
  );
  const subtitle = client ? [client.phone, client.email].filter(Boolean).join(" · ") : undefined;

  const actions = client && (
    <Link
      to="/clients/$id"
      params={{ id: clientId! }}
      onClick={onClose}
      className="hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-[var(--gold)]"
    >
      <ExternalLink className="w-3.5 h-3.5" /> صفحة كاملة
    </Link>
  );

  return (
    <DetailsModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {isLoading || !client ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-muted/50 rounded-lg" />
          <div className="h-40 bg-muted/40 rounded-lg" />
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            <SummaryCard label="القضايا" value={cases.length} />
            <SummaryCard label="الجلسات" value={sessions.length} />
            <SummaryCard label="المستندات" value={documents.length} />
            <SummaryCard
              label="إجمالي الأتعاب"
              value={`${totals.total.toLocaleString()} ج.م`}
              small
            />
            <SummaryCard
              label="المدفوع"
              value={`${totals.paid.toLocaleString()} ج.م`}
              small
              accent="emerald"
            />
            <SummaryCard
              label="المتبقي"
              value={`${totals.remaining.toLocaleString()} ج.م`}
              small
              accent="rose"
            />
          </div>

          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full overflow-x-auto flex justify-start gap-1 bg-card border border-border p-1 h-auto rounded-xl">
              <TabsTrigger value="info" className="text-xs">
                <User className="w-3.5 h-3.5 ml-1" />
                البيانات
              </TabsTrigger>
              <TabsTrigger value="poa" className="text-xs">
                <ScrollText className="w-3.5 h-3.5 ml-1" />
                التوكيل
              </TabsTrigger>
              <TabsTrigger value="cases" className="text-xs">
                <Briefcase className="w-3.5 h-3.5 ml-1" />
                القضايا ({cases.length})
              </TabsTrigger>
              <TabsTrigger value="sessions" className="text-xs">
                <CalendarDays className="w-3.5 h-3.5 ml-1" />
                الجلسات
              </TabsTrigger>
              <TabsTrigger value="payments" className="text-xs">
                <Wallet className="w-3.5 h-3.5 ml-1" />
                المدفوعات
              </TabsTrigger>
              <TabsTrigger value="documents" className="text-xs">
                <FileText className="w-3.5 h-3.5 ml-1" />
                المستندات
              </TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">
                <Activity className="w-3.5 h-3.5 ml-1" />
                السجل
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              <ReadOnlyGrid fields={INFO_FIELDS} data={client} />
            </TabsContent>

            <TabsContent value="poa" className="mt-4">
              <ReadOnlyGrid fields={POA_FIELDS} data={client} />
            </TabsContent>

            <TabsContent value="cases" className="mt-4">
              {cases.length === 0 ? (
                <Empty msg="لا توجد قضايا." />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {cases
                    .filter((c: any) => c?.id)
                    .map((c: any) => (
                      <Link
                        key={c.id}
                        to="/cases/$id"
                        params={{ id: c.id }}
                        onClick={onClose}
                        className="glass-card p-3 hover:border-[var(--gold)] transition"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-sm">قضية #{c.case_number}</span>
                          <StatusBadge status={c.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {c.court_name || c.court_location || "—"}
                        </div>
                      </Link>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="sessions" className="mt-4">
              {sessions.length === 0 ? (
                <Empty msg="لا توجد جلسات." />
              ) : (
                <div className="space-y-2">
                  {sessions
                    .filter((s: any) => s?.id)
                    .map((s: any) => (
                      <div key={s.id} className="border border-border rounded-md p-3 text-sm">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="font-semibold gold-text">
                            {format(new Date(s.session_date), "yyyy/MM/dd HH:mm")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            قضية #{s.cases?.case_number ?? "—"}
                          </div>
                        </div>
                        {s.notes && (
                          <div className="text-xs text-muted-foreground mt-1">{s.notes}</div>
                        )}
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              {payments.length === 0 ? (
                <Empty msg="لا توجد مدفوعات." />
              ) : (
                <div className="space-y-2">
                  {payments
                    .filter((p: any) => p?.id)
                    .map((p: any) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between border border-border rounded-md p-3 text-sm"
                      >
                        <div className="font-bold">
                          {Number(p.total_amount ?? p.amount ?? 0).toLocaleString()} ج.م
                        </div>
                        <StatusBadge status={p.status} />
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="documents" className="mt-4">
              {documents.length === 0 ? (
                <Empty msg="لا توجد مستندات." />
              ) : (
                <div className="grid sm:grid-cols-2 gap-3">
                  {documents
                    .filter((d: any) => d?.id)
                    .map((d: any) => (
                      <div
                        key={d.id}
                        className="border border-border rounded-md p-3 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4 text-[var(--gold)]" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold truncate">{d.name}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {format(new Date(d.created_at), "yyyy/MM/dd")}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              {activity.length === 0 ? (
                <Empty msg="لا يوجد نشاط." />
              ) : (
                <ul className="space-y-2">
                  {activity.map((e) => {
                    const Icon = e.icon;
                    return (
                      <li
                        key={e.id}
                        className="flex items-start gap-3 border border-border rounded-md p-3"
                      >
                        <Icon className="w-4 h-4 text-[var(--gold)] mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{e.title}</div>
                          {e.hint && (
                            <div className="text-xs text-muted-foreground truncate">{e.hint}</div>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground shrink-0">
                          {format(new Date(e.date), "yyyy/MM/dd")}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </TabsContent>
          </Tabs>

          {/* Sticky action bar */}
          <div className="sticky bottom-0 -mx-4 md:-mx-6 -mb-4 md:-mb-6 mt-4 px-4 md:px-6 py-3 bg-background/80 backdrop-blur border-t border-border flex flex-wrap gap-2 justify-end">
            <Link
              to="/clients/$id"
              params={{ id: clientId! }}
              onClick={onClose}
              className="md:hidden inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-md border border-border"
            >
              <ExternalLink className="w-3.5 h-3.5" /> فتح الصفحة الكاملة
            </Link>
            <button
              onClick={() => restore.mutate()}
              disabled={restore.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs font-semibold"
            >
              <ArchiveRestore className="w-3.5 h-3.5" />{" "}
              {restore.isPending ? "..." : "استعادة الموكل"}
            </button>
            {isAdmin && (
              <button
                onClick={() => setConfirmHardDel(1)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-xs font-semibold"
              >
                <Trash2 className="w-3.5 h-3.5" /> حذف نهائي
              </button>
            )}
          </div>
        </div>
      )}

      {confirmHardDel && (
        <div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setConfirmHardDel(null)}
        >
          <div
            className="glass-card w-full max-w-md p-6 border-rose-500/40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-lg font-bold text-rose-400">حذف نهائي</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              سيتم حذف الموكل <strong className="text-foreground">{client?.full_name}</strong> وجميع
              القضايا والجلسات والمدفوعات والمستندات نهائياً ولا يمكن التراجع عن هذه العملية.
            </p>
            {confirmHardDel === 2 && (
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
              {confirmHardDel === 1 ? (
                <button
                  onClick={() => setConfirmHardDel(2)}
                  className="px-4 py-2 rounded-md bg-rose-500/80 text-white text-sm font-semibold"
                >
                  متابعة
                </button>
              ) : (
                <button
                  disabled={hardDelete.isPending}
                  onClick={() => hardDelete.mutate()}
                  className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold"
                >
                  {hardDelete.isPending ? "..." : "حذف نهائي"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </DetailsModalShell>
  );
}

function SummaryCard({
  label,
  value,
  small,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  small?: boolean;
  accent?: "emerald" | "rose";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "rose"
        ? "text-rose-400"
        : "text-[var(--gold)]";
  return (
    <div className="glass-card p-2.5 text-center">
      <div className={`font-bold ${small ? "text-xs" : "text-lg"} ${color} truncate`}>{value}</div>
      <div className="text-[10px] text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

function ReadOnlyGrid({
  fields,
  data,
}: {
  fields: { key: string; label: string; full?: boolean }[];
  data: any;
}) {
  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {fields.map((f) => (
        <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
          <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
          <div className="text-sm font-medium bg-card/50 border border-border rounded-md px-3 py-2 min-h-[2.25rem]">
            {data?.[f.key] || "—"}
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{msg}</p>;
}
