import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import {
  ArrowRight,
  Briefcase,
  Pencil,
  Save,
  Trash2,
  X,
  FileText,
  Wallet,
  CalendarDays,
  Activity,
  User,
  ScrollText,
  Archive,
  ArchiveRestore,
  ExternalLink,
} from "lucide-react";
import { useRoles } from "@/hooks/use-role";
import { StatusBadge } from "@/components/status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PageError } from "@/components/page-feedback";
import { ClientDocumentsPanel } from "@/components/client-documents-panel";

export const Route = createFileRoute("/_authenticated/clients_/$id")({
  component: ClientDetail,
});

const FIELDS: {
  key: string;
  label: string;
  type?: string;
  full?: boolean;
  group: "info" | "poa";
}[] = [
  { key: "full_name", label: "الاسم الكامل", group: "info" },
  { key: "phone", label: "الهاتف", group: "info" },
  { key: "email", label: "البريد الإلكتروني", group: "info" },
  { key: "national_id", label: "الرقم القومي", group: "info" },
  { key: "address", label: "العنوان", full: true, group: "info" },
  { key: "notes", label: "ملاحظات", full: true, group: "info" },
  { key: "poa_number", label: "رقم التوكيل", group: "poa" },
  { key: "poa_year", label: "سنة التوكيل", type: "number", group: "poa" },
  { key: "poa_letter", label: "حرف التوكيل", group: "poa" },
  { key: "poa_type", label: "نوع التوكيل", group: "poa" },
  { key: "client_role", label: "الصفة", group: "poa" },
  { key: "notarization_office", label: "مكتب التوثيق", group: "poa" },
];

async function openStorageFile(path: string) {
  const { data, error } = await supabase.storage
    .from("case-documents")
    .createSignedUrl(path, 60);
  if (error || !data?.signedUrl) {
    toast.error(error?.message ?? "تعذر فتح الملف");
    return;
  }
  window.open(data.signedUrl, "_blank");
}

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { isAdmin } = useRoles();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDel, setConfirmDel] = useState<0 | 1 | 2>(0);

  const {
    data: client,
    isLoading: clientLoading,
    error: clientError,
  } = useQuery({
    queryKey: ["client", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: cases = [], error: casesError } = useQuery({
    queryKey: ["client-cases", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: payments = [], error: paymentsError } = useQuery({
    queryKey: ["client-payments", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: installments = [], error: installmentsError } = useQuery({
    queryKey: ["client-installments", id, payments.length],
    enabled: payments.length > 0,
    queryFn: async () => {
      const ids = payments.map((p: any) => p?.id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("payment_installments")
        .select("*")
        .in("payment_id", ids);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: documents = [], error: documentsError } = useQuery({
    queryKey: ["client-documents", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: sessions = [], error: sessionsError } = useQuery({
    queryKey: ["client-sessions", id, cases.length],
    enabled: cases.length > 0,
    queryFn: async () => {
      const ids = cases.map((c: any) => c?.id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("sessions")
        .select("*, cases(case_number)")
        .in("case_id", ids)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (client) setForm(client);
  }, [client]);

  const save = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("معرّف الموكل غير متاح");
      const payload: any = {};
      FIELDS.forEach((f) => {
        let v = form[f.key];
        if (v === "") v = null;
        if (f.type === "number" && v != null) v = Number(v);
        payload[f.key] = v;
      });
      const { error } = await supabase.from("clients").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      qc.invalidateQueries({ queryKey: ["client", id] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("معرّف الموكل غير متاح");
      const { error } = await supabase
        .from("clients")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت أرشفة الموكل");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-archived"] });
      qc.invalidateQueries({ queryKey: ["client", id] });
      nav({ to: "/clients" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const restore = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("معرّف الموكل غير متاح");
      const { error } = await supabase
        .from("clients")
        .update({ is_archived: false, archived_at: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت استعادة الموكل");
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-archived"] });
      qc.invalidateQueries({ queryKey: ["client", id] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("معرّف الموكل غير متاح");
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف النهائي");
      nav({ to: "/clients" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (clientLoading)
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="glass-card p-6 space-y-3">
          <div className="h-6 w-1/3 bg-muted rounded" />
          <div className="h-4 w-2/3 bg-muted rounded" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted/60 rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );

  const pageError =
    clientError ??
    casesError ??
    paymentsError ??
    installmentsError ??
    documentsError ??
    sessionsError;
  if (pageError) return <PageError message={(pageError as Error).message} />;

  if (!client)
    return (
      <div className="p-6">
        <Link
          to="/clients"
          className="text-sm text-muted-foreground hover:text-[var(--gold)] flex items-center gap-1 mb-4"
        >
          <ArrowRight className="w-4 h-4" /> رجوع للموكلين
        </Link>
        <div className="glass-card p-8 text-center">
          <p className="text-muted-foreground">
            لم يتم العثور على هذا الموكل أو ليس لديك صلاحية الوصول.
          </p>
        </div>
      </div>
    );

  const totalFees = payments.reduce(
    (s: number, p: any) => s + Number(p.total_amount ?? p.amount ?? 0),
    0,
  );
  const paidTotal = installments.reduce((s: number, i: any) => s + Number(i.amount), 0);
  const remaining = Math.max(0, totalFees - paidTotal);
  const upcoming = sessions.filter((s: any) => new Date(s.session_date) >= new Date());
  const past = sessions.filter((s: any) => new Date(s.session_date) < new Date());

  const infoFields = FIELDS.filter((f) => f.group === "info");
  const poaFields = FIELDS.filter((f) => f.group === "poa");

  return (
    <div>
      <TopBar />
      <Link
        to="/clients"
        className="text-sm text-muted-foreground hover:text-[var(--gold)] flex items-center gap-1 mb-4"
      >
        <ArrowRight className="w-4 h-4" /> رجوع للموكلين
      </Link>

      <div className="glass-card p-6 mb-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[var(--gold)]/15 grid place-items-center text-[var(--gold)] font-bold text-xl">
              {client.full_name?.[0] ?? <User className="w-6 h-6" />}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.full_name}</h1>
              <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {client.phone && <span>{client.phone}</span>}
                {client.email && <span>{client.email}</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            {!editing ? (
              <>
                <span
                  className={`text-[10px] px-2 py-1 rounded-full self-center ${client.is_archived ? "bg-muted text-muted-foreground border border-border" : "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"}`}
                >
                  {client.is_archived ? "مؤرشف" : "نشط"}
                </span>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 rounded-md border border-border hover:border-[var(--gold)] text-sm flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> تعديل
                </button>
                {client.is_archived ? (
                  <button
                    onClick={() => restore.mutate()}
                    disabled={restore.isPending}
                    className="px-3 py-1.5 rounded-md border border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-sm flex items-center gap-1.5"
                  >
                    <ArchiveRestore className="w-3.5 h-3.5" /> استعادة
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmArchive(true)}
                    className="px-3 py-1.5 rounded-md border border-border hover:border-[var(--gold)] text-sm flex items-center gap-1.5"
                  >
                    <Archive className="w-3.5 h-3.5" /> أرشفة
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setConfirmDel(1)}
                    className="px-3 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-sm flex items-center gap-1.5"
                    title="حذف نهائي (مسؤول فقط)"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> حذف نهائي
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                  className="btn-gold px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" /> {save.isPending ? "جارٍ الحفظ..." : "حفظ"}
                </button>
                <button
                  onClick={() => {
                    setForm(client);
                    setEditing(false);
                  }}
                  className="px-3 py-1.5 rounded-md border border-border text-sm flex items-center gap-1.5"
                >
                  <X className="w-3.5 h-3.5" /> إلغاء
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          <Stat label="عدد القضايا" value={cases.length} />
          <Stat label="إجمالي الأتعاب" value={`${totalFees.toLocaleString()} ج.م`} />
          <Stat label="المدفوع" value={`${paidTotal.toLocaleString()} ج.م`} accent="emerald" />
          <Stat label="المتبقي" value={`${remaining.toLocaleString()} ج.م`} accent="amber" />
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="w-full overflow-x-auto flex justify-start gap-1 bg-card border border-border p-1 h-auto rounded-xl">
          <Tab value="overview" icon={User}>
            نظرة عامة
          </Tab>
          <Tab value="poa" icon={ScrollText}>
            التوكيل
          </Tab>
          <Tab value="cases" icon={Briefcase}>
            القضايا ({cases.length})
          </Tab>
          <Tab value="payments" icon={Wallet}>
            المدفوعات
          </Tab>
          <Tab value="documents" icon={FileText}>
            المستندات
          </Tab>
          <Tab value="sessions" icon={CalendarDays}>
            الجلسات
          </Tab>
          <Tab value="activity" icon={Activity}>
            السجل
          </Tab>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="glass-card p-6 grid sm:grid-cols-2 gap-4 text-sm">
            {infoFields.map((f) => (
              <Field
                key={f.key}
                f={f}
                editing={editing}
                form={form}
                setForm={setForm}
                value={(client as any)[f.key]}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="poa" className="mt-4">
          <div className="glass-card p-6 grid sm:grid-cols-2 gap-4 text-sm">
            {poaFields.map((f) => (
              <Field
                key={f.key}
                f={f}
                editing={editing}
                form={form}
                setForm={setForm}
                value={(client as any)[f.key]}
              />
            ))}
            {client.poa_file_path && (
              <div className="sm:col-span-2 flex items-center justify-between gap-3 rounded-md border border-border bg-card/50 p-3">
                <div>
                  <div className="text-sm font-semibold">ملف التوكيل مرفق</div>
                  <div className="text-xs text-muted-foreground">يمكنك فتح ملف PDF أو الصورة من هنا.</div>
                </div>
                <button
                  type="button"
                  onClick={() => openStorageFile(client.poa_file_path!)}
                  className="inline-flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs hover:border-[var(--gold)]"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> فتح الملف
                </button>
              </div>
            )}
            <div className="sm:col-span-2 text-xs text-muted-foreground">
              {client.poa_file_path
                ? "تم إرفاق نسخة من التوكيل."
                : "لا توجد مرفقات. ارفع التوكيل من تبويب المستندات."}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            {cases
              .filter((c: any) => c?.id)
              .map((c: any) => (
                <Link
                  key={c?.id}
                  to="/cases/$id"
                  params={{ id: c?.id }}
                  className="glass-card p-4 hover:border-[var(--gold)] transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold">قضية #{c.case_number}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="text-sm text-muted-foreground mt-2">{c.court_name || "—"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    الخصم: {c.opponent_name || "—"}
                  </div>
                  {c.next_session_date && (
                    <div className="text-xs text-[var(--gold)] mt-2">
                      الجلسة القادمة: {format(new Date(c.next_session_date), "yyyy/MM/dd")}
                    </div>
                  )}
                </Link>
              ))}
            {cases.length === 0 && (
              <div className="text-muted-foreground text-sm">لا توجد قضايا.</div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="glass-card p-5 space-y-3">
            {payments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">
                لا توجد أتعاب مسجّلة لهذا الموكل.
              </p>
            ) : (
              payments
                .filter((p: any) => p?.id)
                .map((p: any) => {
                  const total = Number(p.total_amount ?? p.amount ?? 0);
                  const paid = installments
                    .filter((i: any) => i.payment_id === p.id)
                    .reduce((s: number, i: any) => s + Number(i.amount), 0);
                  const rem = Math.max(0, total - paid);
                  const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
                  const caseRef = cases.find((c: any) => c.id === p.case_id);
                  return (
                    <div key={p?.id} className="bg-card/60 border border-border rounded-xl p-4">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                        <div className="font-bold">{total.toLocaleString()} ج.م</div>
                        <StatusBadge status={p.status} />
                      </div>
                      {caseRef && (
                        <Link
                          to="/cases/$id"
                          params={{ id: caseRef?.id }}
                          className="text-xs text-[var(--gold)] hover:underline"
                        >
                          قضية #{caseRef.case_number}
                        </Link>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-center text-xs mt-3">
                        <div className="bg-muted/40 rounded-md p-2">
                          <div className="text-muted-foreground">المدفوع</div>
                          <div className="font-bold text-emerald-400">{paid.toLocaleString()}</div>
                        </div>
                        <div className="bg-muted/40 rounded-md p-2">
                          <div className="text-muted-foreground">المتبقي</div>
                          <div className="font-bold text-amber-300">{rem.toLocaleString()}</div>
                        </div>
                        <div className="bg-muted/40 rounded-md p-2">
                          <div className="text-muted-foreground">النسبة</div>
                          <div className="font-bold gold-text">{pct.toFixed(0)}%</div>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden mt-2">
                        <div
                          className="h-full bg-gradient-to-r from-[var(--gold)] to-emerald-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            )}
            <p className="text-xs text-muted-foreground text-center pt-2">
              لإضافة أتعاب أو تسجيل دفعة، افتح صفحة القضية المعنية.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="documents" className="mt-4">
          <div className="glass-card p-5">
            <ClientDocumentsPanel
              clientId={client.id}
              documents={documents}
              poaFilePath={client.poa_file_path}
            />
            <div className="hidden">
            {documents.length === 0 ? (
              <p className="text-muted-foreground text-sm py-6 text-center">لا توجد مستندات.</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {documents
                  .filter((d: any) => d?.id)
                  .map((d: any) => (
                    <div
                      key={d?.id}
                      className="border border-border rounded-lg p-3 flex items-center gap-3"
                    >
                      <FileText className="w-5 h-5 text-[var(--gold)] shrink-0" />
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
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <div className="glass-card p-5 space-y-5">
            <div>
              <h3 className="text-sm font-bold mb-2 text-[var(--gold)]">
                الجلسات القادمة ({upcoming.length})
              </h3>
              {upcoming.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا جلسات قادمة.</p>
              ) : (
                <div className="space-y-2">
                  {upcoming
                    .filter((s: any) => s?.id)
                    .map((s: any) => (
                      <SessionRow key={s?.id} s={s} />
                    ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="text-sm font-bold mb-2">الجلسات السابقة ({past.length})</h3>
              {past.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا جلسات سابقة.</p>
              ) : (
                <div className="space-y-2">
                  {past
                    .filter((s: any) => s?.id)
                    .map((s: any) => (
                      <SessionRow key={s?.id} s={s} />
                    ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="glass-card p-5">
            <ol className="relative border-r-2 border-border mr-3 space-y-4">
              <TimelineItem date={client.created_at} title="تم إنشاء الموكل" icon={User} />
              {cases.map((c: any) => (
                <TimelineItem
                  key={`c-${c.id}`}
                  date={c.created_at}
                  title={`تمت إضافة قضية #${c.case_number}`}
                  icon={Briefcase}
                />
              ))}
              {sessions.map((s: any) => (
                <TimelineItem
                  key={`s-${s.id}`}
                  date={s.created_at}
                  title="تمت إضافة جلسة"
                  hint={format(new Date(s.session_date), "yyyy/MM/dd HH:mm")}
                  icon={CalendarDays}
                />
              ))}
              {documents.map((d: any) => (
                <TimelineItem
                  key={`d-${d.id}`}
                  date={d.created_at}
                  title="تم رفع مستند"
                  hint={d.name}
                  icon={FileText}
                />
              ))}
              {payments.map((p: any) => (
                <TimelineItem
                  key={`p-${p.id}`}
                  date={p.created_at}
                  title="تم تسجيل أتعاب"
                  hint={`${Number(p.total_amount ?? p.amount).toLocaleString()} ج.م`}
                  icon={Wallet}
                />
              ))}
            </ol>
          </div>
        </TabsContent>
      </Tabs>

      {confirmArchive && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <Archive className="w-5 h-5 text-[var(--gold)]" />
              <h3 className="text-lg font-bold">أرشفة الموكل</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              هل تريد أرشفة <strong className="text-foreground">{client.full_name}</strong>؟ سيختفي
              من القوائم الرئيسية مع الاحتفاظ بجميع البيانات وإمكانية استعادته لاحقاً.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmArchive(false)}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                لا، إلغاء
              </button>
              <button
                disabled={archive.isPending}
                onClick={() => archive.mutate()}
                className="btn-gold px-4 py-2 rounded-md text-sm font-semibold"
              >
                {archive.isPending ? "..." : "نعم، أرشفة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDel !== 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-md p-6 border-rose-500/40">
            <div className="flex items-center gap-2 mb-2">
              <Trash2 className="w-5 h-5 text-rose-400" />
              <h3 className="text-lg font-bold text-rose-400">حذف نهائي</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              سيتم حذف الموكل <strong className="text-foreground">{client.full_name}</strong> وجميع
              القضايا والجلسات والمدفوعات والمستندات نهائياً ولا يمكن التراجع عن هذه العملية.
            </p>
            {confirmDel === 2 && (
              <div className="mb-4 p-3 rounded-md bg-rose-500/10 border border-rose-500/40 text-sm text-rose-300">
                تأكيد أخير: هل أنت متأكد تماماً؟
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDel(0)}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                إلغاء
              </button>
              {confirmDel === 1 ? (
                <button
                  onClick={() => setConfirmDel(2)}
                  className="px-4 py-2 rounded-md bg-rose-500/80 text-white text-sm font-semibold"
                >
                  متابعة
                </button>
              ) : (
                <button
                  disabled={del.isPending}
                  onClick={() => del.mutate()}
                  className="px-4 py-2 rounded-md bg-rose-600 text-white text-sm font-semibold"
                >
                  {del.isPending ? "..." : "حذف نهائي"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Tab({
  value,
  icon: Icon,
  children,
}: {
  value: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <TabsTrigger
      value={value}
      className="data-[state=active]:bg-[var(--gold)]/15 data-[state=active]:text-[var(--gold)] flex items-center gap-1.5 rounded-lg whitespace-nowrap"
    >
      <Icon className="w-3.5 h-3.5" /> {children}
    </TabsTrigger>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: any;
  accent?: "emerald" | "amber";
}) {
  const color =
    accent === "emerald"
      ? "text-emerald-400"
      : accent === "amber"
        ? "text-amber-300"
        : "text-foreground";
  return (
    <div className="bg-card/60 border border-border rounded-lg p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-lg font-bold mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function Field({ f, editing, form, setForm, value }: any) {
  return (
    <div className={f.full ? "sm:col-span-2" : ""}>
      <div className="text-xs text-muted-foreground mb-1">{f.label}</div>
      {editing ? (
        f.full ? (
          <textarea
            rows={3}
            value={form[f.key] ?? ""}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            className="w-full bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
          />
        ) : (
          <input
            type={f.type || "text"}
            value={form[f.key] ?? ""}
            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
            className="w-full bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
          />
        )
      ) : (
        <div className="py-1">{value || <span className="text-muted-foreground">—</span>}</div>
      )}
    </div>
  );
}

function SessionRow({ s }: { s: any }) {
  if (!s?.case_id) {
    return (
      <div className="block border-r-2 border-border pr-3 py-2 rounded">
        <div className="text-sm font-semibold">
          {s?.session_date ? format(new Date(s.session_date), "yyyy/MM/dd — HH:mm") : "—"}
        </div>
        <div className="text-xs text-muted-foreground">
          قضية غير مرتبطة {s?.notes ? `— ${s.notes}` : ""}
        </div>
      </div>
    );
  }
  return (
    <Link
      to="/cases/$id"
      params={{ id: s.case_id }}
      className="block border-r-2 border-[var(--gold)] pr-3 py-2 hover:bg-muted/30 rounded"
    >
      <div className="text-sm font-semibold">
        {format(new Date(s.session_date), "yyyy/MM/dd — HH:mm")}
      </div>
      <div className="text-xs text-muted-foreground">
        قضية #{s.cases?.case_number} {s.notes ? `— ${s.notes}` : ""}
      </div>
    </Link>
  );
}

function TimelineItem({ date, title, hint, icon: Icon }: any) {
  return (
    <li className="pr-6 relative">
      <span className="absolute -right-[11px] top-1 w-5 h-5 rounded-full bg-card border-2 border-[var(--gold)] grid place-items-center">
        <Icon className="w-2.5 h-2.5 text-[var(--gold)]" />
      </span>
      <div className="text-sm font-semibold">{title}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
      <div className="text-[10px] text-muted-foreground mt-0.5">
        {format(new Date(date), "yyyy/MM/dd HH:mm")}
      </div>
    </li>
  );
}
