// Floating case details modal — view & edit core info, plus tabs for related data.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Pencil,
  Save,
  X as XIcon,
  ExternalLink,
  Briefcase,
  Wallet,
  CalendarDays,
  FileText,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { DetailsModalShell } from "@/components/details-modal-shell";
import { CASE_CATEGORIES, formatCaseId } from "@/lib/case-format";

const EDIT_FIELDS = [
  { key: "case_number", label: "رقم القضية" },
  { key: "case_year", label: "السنة", type: "number" },
  { key: "case_category", label: "نوع القضية", select: CASE_CATEGORIES },
  { key: "court_location", label: "المحكمة / المركز" },
  { key: "court_name", label: "اسم المحكمة" },
  { key: "opponent_name", label: "الخصم" },
  { key: "status", label: "الحالة", select: ["active", "closed"] },
  { key: "next_session_date", label: "موعد الجلسة القادمة", type: "datetime-local" },
  { key: "notes", label: "ملاحظات", full: true },
];

export function CaseDetailsModal({
  caseId,
  onClose,
}: {
  caseId: string | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const open = !!caseId;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: c, isLoading } = useQuery({
    queryKey: ["case", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, clients(id, full_name, phone)")
        .eq("id", caseId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["case-sessions", caseId],
    enabled: !!caseId,
    queryFn: async () =>
      (
        await supabase
          .from("sessions")
          .select("*")
          .eq("case_id", caseId!)
          .order("session_date", { ascending: false })
      ).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["case-payments", caseId],
    enabled: !!caseId,
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*")
          .eq("case_id", caseId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["case-documents", caseId],
    enabled: !!caseId,
    queryFn: async () =>
      (
        await supabase
          .from("documents")
          .select("*")
          .eq("case_id", caseId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  useEffect(() => {
    if (c) {
      const f: any = { ...c };
      if (f.next_session_date)
        f.next_session_date = new Date(f.next_session_date).toISOString().slice(0, 16);
      setForm(f);
    }
    setEditing(false);
  }, [c]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      EDIT_FIELDS.forEach((f) => {
        let v = form[f.key];
        if (v === "") v = null;
        if (f.type === "number" && v != null) v = Number(v);
        payload[f.key] = v;
      });
      const { error } = await supabase.from("cases").update(payload).eq("id", caseId!);
      if (error) throw error;

      // If next_session_date changed and is set, ensure a session record exists for it
      if (payload.next_session_date) {
        const newDateIso = new Date(payload.next_session_date).toISOString();
        const exists = sessions.some(
          (s: any) => new Date(s.session_date).toISOString() === newDateIso,
        );
        if (!exists) {
          const { data: u } = await supabase.auth.getUser();
          if (u.user?.id) {
            await supabase.from("sessions").insert({
              user_id: u.user.id,
              case_id: caseId!,
              session_date: newDateIso,
              location: payload.court_name || payload.court_location || null,
            });
          }
        }
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      qc.invalidateQueries({ queryKey: ["case", caseId] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["case-sessions", caseId] });
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
      qc.invalidateQueries({ queryKey: ["client-sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const title = c ? formatCaseId(c) : isLoading ? "..." : "قضية";
  const subtitle = c?.clients?.full_name ? `الموكل: ${c.clients.full_name}` : undefined;

  const actions = c && (
    <>
      <Link
        to="/cases/$id"
        params={{ id: caseId! }}
        onClick={onClose}
        className="hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-[var(--gold)]"
      >
        <ExternalLink className="w-3.5 h-3.5" /> صفحة كاملة
      </Link>
      {!editing ? (
        <button
          onClick={() => setEditing(true)}
          className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-[var(--gold)]"
        >
          <Pencil className="w-3.5 h-3.5" /> تعديل
        </button>
      ) : (
        <>
          <button
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="btn-gold inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-semibold"
          >
            <Save className="w-3.5 h-3.5" /> {save.isPending ? "..." : "حفظ"}
          </button>
          <button
            onClick={() => {
              setForm(c);
              setEditing(false);
            }}
            className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border"
          >
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </>
  );

  return (
    <DetailsModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      actions={actions}
    >
      {isLoading || !c ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-muted/50 rounded-lg" />
          <div className="h-40 bg-muted/40 rounded-lg" />
        </div>
      ) : (
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full overflow-x-auto flex justify-start gap-1 bg-card border border-border p-1 h-auto rounded-xl">
            <TabsTrigger value="info" className="text-xs">
              <Briefcase className="w-3.5 h-3.5 ml-1" />
              البيانات
            </TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs">
              <CalendarDays className="w-3.5 h-3.5 ml-1" />
              الجلسات ({sessions.length})
            </TabsTrigger>
            <TabsTrigger value="payments" className="text-xs">
              <Wallet className="w-3.5 h-3.5 ml-1" />
              الأتعاب
            </TabsTrigger>
            <TabsTrigger value="documents" className="text-xs">
              <FileText className="w-3.5 h-3.5 ml-1" />
              المستندات
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {EDIT_FIELDS.map((f) => (
                <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                  <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
                  {editing ? (
                    f.select ? (
                      <select
                        value={form[f.key] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
                      >
                        {f.select.map((o) => (
                          <option key={o} value={o}>
                            {o === "active" ? "متداولة" : o === "closed" ? "منتهية" : o}
                          </option>
                        ))}
                      </select>
                    ) : f.full ? (
                      <textarea
                        rows={3}
                        value={form[f.key] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
                      />
                    ) : (
                      <input
                        type={f.type ?? "text"}
                        value={form[f.key] ?? ""}
                        onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                        className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
                      />
                    )
                  ) : (
                    <div className="text-sm font-medium bg-card/50 border border-border rounded-md px-3 py-2 min-h-[2.25rem]">
                      {f.key === "next_session_date" && (c as any)[f.key]
                        ? format(new Date((c as any)[f.key]), "yyyy/MM/dd HH:mm")
                        : f.key === "status"
                          ? (c as any)[f.key] === "closed"
                            ? "منتهية"
                            : "متداولة"
                          : (c as any)[f.key] || "—"}
                    </div>
                  )}
                </div>
              ))}
            </div>
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
                      <div className="font-semibold gold-text">
                        {format(new Date(s.session_date), "yyyy/MM/dd HH:mm")}
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
              <Empty msg="لا توجد أتعاب." />
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
        </Tabs>
      )}
    </DetailsModalShell>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-muted-foreground py-6 text-center">{msg}</p>;
}
