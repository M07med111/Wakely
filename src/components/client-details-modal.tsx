// Floating client details modal — view & edit core info, plus tabs for related data.
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Pencil, Save, X as XIcon, ExternalLink, Briefcase, Wallet, CalendarDays, FileText, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { DetailsModalShell } from "@/components/details-modal-shell";

const EDIT_FIELDS = [
  { key: "full_name", label: "الاسم الكامل" },
  { key: "phone", label: "الهاتف" },
  { key: "email", label: "البريد الإلكتروني" },
  { key: "national_id", label: "الرقم القومي" },
  { key: "address", label: "العنوان", full: true },
  { key: "poa_number", label: "رقم التوكيل" },
  { key: "poa_year", label: "سنة التوكيل", type: "number" },
  { key: "poa_letter", label: "حرف التوكيل" },
  { key: "poa_type", label: "نوع التوكيل" },
  { key: "notes", label: "ملاحظات", full: true },
];

export function ClientDetailsModal({ clientId, onClose }: { clientId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const open = !!clientId;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  const { data: client, isLoading } = useQuery({
    queryKey: ["client", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", clientId!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["client-cases", clientId],
    enabled: !!clientId,
    queryFn: async () => (await supabase.from("cases").select("*").eq("client_id", clientId!).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: payments = [] } = useQuery({
    queryKey: ["client-payments", clientId],
    enabled: !!clientId,
    queryFn: async () => (await supabase.from("payments").select("*").eq("client_id", clientId!).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: documents = [] } = useQuery({
    queryKey: ["client-documents", clientId],
    enabled: !!clientId,
    queryFn: async () => (await supabase.from("documents").select("*").eq("client_id", clientId!).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: sessions = [] } = useQuery({
    queryKey: ["client-sessions", clientId, cases.length],
    enabled: !!clientId && cases.length > 0,
    queryFn: async () => {
      const ids = cases.map((c: any) => c?.id).filter(Boolean);
      if (!ids.length) return [];
      const { data } = await supabase.from("sessions").select("*, cases(case_number)").in("case_id", ids).order("session_date", { ascending: false });
      return data ?? [];
    },
  });

  useEffect(() => { if (client) setForm(client); setEditing(false); }, [client]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {};
      EDIT_FIELDS.forEach((f) => {
        let v = form[f.key];
        if (v === "") v = null;
        if (f.type === "number" && v != null) v = Number(v);
        payload[f.key] = v;
      });
      const { error } = await supabase.from("clients").update(payload).eq("id", clientId!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      qc.invalidateQueries({ queryKey: ["client", clientId] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const title = client?.full_name ?? (isLoading ? "..." : "موكل");
  const subtitle = client ? [client.phone, client.email].filter(Boolean).join(" · ") : undefined;

  const actions = client && (
    <>
      <Link to="/clients/$id" params={{ id: clientId! }} onClick={onClose} className="hidden md:inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-[var(--gold)]">
        <ExternalLink className="w-3.5 h-3.5" /> صفحة كاملة
      </Link>
      {!editing ? (
        <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border hover:border-[var(--gold)]">
          <Pencil className="w-3.5 h-3.5" /> تعديل
        </button>
      ) : (
        <>
          <button disabled={save.isPending} onClick={() => save.mutate()} className="btn-gold inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md font-semibold">
            <Save className="w-3.5 h-3.5" /> {save.isPending ? "..." : "حفظ"}
          </button>
          <button onClick={() => { setForm(client); setEditing(false); }} className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md border border-border">
            <XIcon className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </>
  );

  return (
    <DetailsModalShell open={open} onClose={onClose} title={title} subtitle={subtitle} actions={actions}>
      {isLoading || !client ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-muted/50 rounded-lg" />
          <div className="h-40 bg-muted/40 rounded-lg" />
        </div>
      ) : (
        <Tabs defaultValue="info" className="w-full">
          <TabsList className="w-full overflow-x-auto flex justify-start gap-1 bg-card border border-border p-1 h-auto rounded-xl">
            <TabsTrigger value="info" className="text-xs"><User className="w-3.5 h-3.5 ml-1" />البيانات</TabsTrigger>
            <TabsTrigger value="cases" className="text-xs"><Briefcase className="w-3.5 h-3.5 ml-1" />القضايا ({cases.length})</TabsTrigger>
            <TabsTrigger value="payments" className="text-xs"><Wallet className="w-3.5 h-3.5 ml-1" />الأتعاب</TabsTrigger>
            <TabsTrigger value="sessions" className="text-xs"><CalendarDays className="w-3.5 h-3.5 ml-1" />الجلسات</TabsTrigger>
            <TabsTrigger value="documents" className="text-xs"><FileText className="w-3.5 h-3.5 ml-1" />المستندات</TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <div className="grid sm:grid-cols-2 gap-3">
              {EDIT_FIELDS.map((f) => (
                <div key={f.key} className={f.full ? "sm:col-span-2" : ""}>
                  <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
                  {editing ? (
                    <input
                      type={f.type ?? "text"}
                      value={form[f.key] ?? ""}
                      onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                      className="w-full bg-input border border-border rounded-md px-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
                    />
                  ) : (
                    <div className="text-sm font-medium bg-card/50 border border-border rounded-md px-3 py-2 min-h-[2.25rem]">
                      {(client as any)[f.key] || "—"}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="cases" className="mt-4">
            {cases.length === 0 ? <Empty msg="لا توجد قضايا." /> : (
              <div className="grid sm:grid-cols-2 gap-3">
                {cases.filter((c: any) => c?.id).map((c: any) => (
                  <Link key={c.id} to="/cases/$id" params={{ id: c.id }} onClick={onClose} className="glass-card p-3 hover:border-[var(--gold)] transition">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm">قضية #{c.case_number}</span>
                      <StatusBadge status={c.status} />
                    </div>
                    <div className="text-xs text-muted-foreground">{c.court_name || c.court_location || "—"}</div>
                    {c.next_session_date && (
                      <div className="text-[11px] text-[var(--gold)] mt-1">جلسة: {format(new Date(c.next_session_date), "yyyy/MM/dd")}</div>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            {payments.length === 0 ? <Empty msg="لا توجد أتعاب." /> : (
              <div className="space-y-2">
                {payments.filter((p: any) => p?.id).map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between border border-border rounded-md p-3 text-sm">
                    <div className="font-bold">{Number(p.total_amount ?? p.amount ?? 0).toLocaleString()} ج.م</div>
                    <StatusBadge status={p.status} />
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="mt-4">
            {sessions.length === 0 ? <Empty msg="لا توجد جلسات." /> : (
              <div className="space-y-2">
                {sessions.filter((s: any) => s?.id).map((s: any) => (
                  <div key={s.id} className="border border-border rounded-md p-3 text-sm">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="font-semibold gold-text">{format(new Date(s.session_date), "yyyy/MM/dd HH:mm")}</div>
                      <div className="text-xs text-muted-foreground">قضية #{s.cases?.case_number ?? "—"}</div>
                    </div>
                    {s.notes && <div className="text-xs text-muted-foreground mt-1">{s.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="documents" className="mt-4">
            {documents.length === 0 ? <Empty msg="لا توجد مستندات." /> : (
              <div className="grid sm:grid-cols-2 gap-3">
                {documents.filter((d: any) => d?.id).map((d: any) => (
                  <div key={d.id} className="border border-border rounded-md p-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[var(--gold)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{d.name}</div>
                      <div className="text-[11px] text-muted-foreground">{format(new Date(d.created_at), "yyyy/MM/dd")}</div>
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
