import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  Wallet,
  Activity,
  Bot,
  Plus,
  Upload,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { format } from "date-fns";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { ActivityTimeline } from "@/components/activity-timeline";
import { CaseDocuments } from "@/components/case-documents";
import { CasePayments } from "@/components/case-payments";
import { PageError } from "@/components/page-feedback";

export const Route = createFileRoute("/_authenticated/cases/$id")({
  component: CaseDetail,
});

function CaseDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [confirmDel, setConfirmDel] = useState(false);

  const {
    data: c,
    isLoading: caseLoading,
    error: caseError,
  } = useQuery({
    queryKey: ["case", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("*, clients(id, full_name)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: sessions = [], error: sessionsError } = useQuery({
    queryKey: ["case-sessions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("case_id", id)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  useEffect(() => {
    if (c) setForm(c);
  }, [c]);

  const saveCase = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("معرّف القضية غير متاح");
      const payload: any = {};
      [
        "case_number",
        "court_name",
        "court_location",
        "opponent_name",
        "case_type",
        "case_category",
        "case_year",
        "status",
        "notes",
        "next_session_date",
      ].forEach((k) => {
        let v = form[k];
        if (v === "") v = null;
        if (k === "case_year" && v != null) v = Number(v);
        if (k === "next_session_date" && v) v = new Date(v).toISOString();
        payload[k] = v;
      });
      const { error } = await supabase.from("cases").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ التعديلات");
      qc.invalidateQueries({ queryKey: ["case", id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      setEditing(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const delCase = useMutation({
    mutationFn: async () => {
      if (!id) throw new Error("معرّف القضية غير متاح");
      const { error } = await supabase.from("cases").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف القضية");
      nav({ to: "/cases" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addSession = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      if (!id || !date) throw new Error("بيانات الجلسة غير مكتملة");
      const { error } = await supabase.from("sessions").insert({
        user_id: u.user.id,
        case_id: id,
        session_date: new Date(date).toISOString(),
        notes,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الجلسة");
      qc.invalidateQueries({ queryKey: ["case-sessions", id] });
      qc.invalidateQueries({ queryKey: ["case-activity", id] });
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
      qc.invalidateQueries({ queryKey: ["client-sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["upcoming-sessions"] });
      setDate("");
      setNotes("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (caseLoading)
    return (
      <div className="p-6 space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-muted rounded" />
        <div className="glass-card p-6 space-y-3">
          <div className="h-6 w-1/3 bg-muted rounded" />
          <div className="h-4 w-1/2 bg-muted rounded" />
        </div>
        <div className="glass-card p-6 h-40 bg-muted/40" />
      </div>
    );

  const pageError = caseError ?? sessionsError;
  if (pageError) return <PageError message={(pageError as Error).message} />;

  if (!c)
    return (
      <div className="p-6">
        <Link
          to="/cases"
          className="text-sm text-muted-foreground hover:text-[var(--gold)] flex items-center gap-1 mb-4"
        >
          <ArrowRight className="w-4 h-4" /> رجوع للقضايا
        </Link>
        <div className="glass-card p-8 text-center text-muted-foreground">
          لم يتم العثور على هذه القضية أو ليس لديك صلاحية الوصول.
        </div>
      </div>
    );

  return (
    <div>
      <TopBar />
      <Link
        to="/cases"
        className="text-sm text-muted-foreground hover:text-[var(--gold)] flex items-center gap-1 mb-4"
      >
        <ArrowRight className="w-4 h-4" /> رجوع للقضايا
      </Link>

      <div className="glass-card p-6 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">قضية #{c.case_number}</h1>
            {c.clients?.id ? (
              <Link
                to="/clients/$id"
                params={{ id: c.clients.id }}
                className="text-sm text-[var(--gold)] mt-1 inline-block"
              >
                {c.clients?.full_name}
              </Link>
            ) : (
              <span className="text-sm text-muted-foreground mt-1 inline-block">
                {c.clients?.full_name ?? "—"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={c.status} />
            {!editing ? (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="px-3 py-1.5 rounded-md border border-border hover:border-[var(--gold)] text-sm flex items-center gap-1.5"
                >
                  <Pencil className="w-3.5 h-3.5" /> تعديل
                </button>
                <button
                  onClick={() => setConfirmDel(true)}
                  className="px-3 py-1.5 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-sm flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" /> حذف
                </button>
              </>
            ) : (
              <>
                <button
                  disabled={saveCase.isPending}
                  onClick={() => saveCase.mutate()}
                  className="btn-gold px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" /> {saveCase.isPending ? "..." : "حفظ"}
                </button>
                <button
                  onClick={() => {
                    setForm(c);
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
      </div>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="w-full overflow-x-auto flex justify-start gap-1 bg-card border border-border p-1 h-auto rounded-xl">
          <Tab value="details" icon={FileText}>
            تفاصيل
          </Tab>
          <Tab value="sessions" icon={CalendarDays}>
            الجلسات
          </Tab>
          <Tab value="files" icon={Upload}>
            الملفات
          </Tab>
          <Tab value="payments" icon={Wallet}>
            المدفوعات
          </Tab>
          <Tab value="activity" icon={Activity}>
            السجل
          </Tab>
          <Tab value="ai" icon={Bot}>
            AI
          </Tab>
        </TabsList>

        <TabsContent value="details" className="mt-4">
          <div className="glass-card p-6">
            {editing ? (
              <div className="grid sm:grid-cols-2 gap-4 text-sm">
                <EditField
                  label="رقم القضية"
                  value={form.case_number}
                  onChange={(v) => setForm({ ...form, case_number: v })}
                />
                <EditField
                  label="سنة القضية"
                  type="number"
                  value={form.case_year}
                  onChange={(v) => setForm({ ...form, case_year: v })}
                />
                <EditField
                  label="المحكمة"
                  value={form.court_name}
                  onChange={(v) => setForm({ ...form, court_name: v })}
                />
                <EditField
                  label="مقر المحكمة"
                  value={form.court_location}
                  onChange={(v) => setForm({ ...form, court_location: v })}
                />
                <EditField
                  label="نوع القضية"
                  value={form.case_type}
                  onChange={(v) => setForm({ ...form, case_type: v })}
                />
                <EditField
                  label="تصنيف"
                  value={form.case_category}
                  onChange={(v) => setForm({ ...form, case_category: v })}
                />
                <EditField
                  label="الخصم"
                  value={form.opponent_name}
                  onChange={(v) => setForm({ ...form, opponent_name: v })}
                />
                <div>
                  <div className="text-xs text-muted-foreground mb-1">الحالة</div>
                  <select
                    value={form.status ?? "active"}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
                  >
                    <option value="active">نشطة</option>
                    <option value="pending">معلّقة</option>
                    <option value="closed">مغلقة</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">الجلسة القادمة</div>
                  <input
                    type="datetime-local"
                    value={
                      form.next_session_date
                        ? new Date(form.next_session_date).toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(e) => setForm({ ...form, next_session_date: e.target.value })}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="text-xs text-muted-foreground mb-1">ملاحظات</div>
                  <textarea
                    rows={4}
                    value={form.notes ?? ""}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="w-full bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-3 gap-4 text-sm">
                  <Info label="المحكمة" value={c.court_name} />
                  <Info label="الخصم" value={c.opponent_name} />
                  <Info label="نوع القضية" value={c.case_type} />
                  <Info
                    label="الجلسة القادمة"
                    value={
                      c.next_session_date
                        ? format(new Date(c.next_session_date), "yyyy/MM/dd HH:mm")
                        : null
                    }
                  />
                </div>
                {c.notes && <p className="mt-5 p-4 bg-muted/50 rounded-md text-sm">{c.notes}</p>}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="sessions" className="mt-4">
          <div className="glass-card p-5">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addSession.mutate();
              }}
              className="grid sm:grid-cols-[1fr_1fr_auto] gap-3 mb-6"
            >
              <input
                required
                type="datetime-local"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
              />
              <input
                placeholder="ملاحظات"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
              />
              <button className="btn-gold px-4 py-2 rounded-md font-semibold flex items-center gap-2">
                <Plus className="w-4 h-4" />
                إضافة
              </button>
            </form>
            <div className="space-y-3">
              {sessions
                .filter((s: any) => s?.id)
                .map((s: any) => (
                  <div key={s?.id} className="border-r-2 border-[var(--gold)] pr-4 py-2">
                    <div className="font-semibold text-sm">
                      {format(new Date(s.session_date), "yyyy/MM/dd — HH:mm")}
                    </div>
                    {s.notes && <div className="text-xs text-muted-foreground mt-1">{s.notes}</div>}
                  </div>
                ))}
              {sessions.length === 0 && (
                <p className="text-muted-foreground text-sm py-4 text-center">لا توجد جلسات بعد.</p>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="files" className="mt-4">
          <div className="glass-card p-5">
            <CaseDocuments caseId={id} />
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="glass-card p-5">
            {c.clients?.id ? (
              <CasePayments caseId={id} clientId={c.clients.id} />
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                لا يمكن عرض المدفوعات بدون موكل مرتبط.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <div className="glass-card p-5">
            <ActivityTimeline caseId={id} />
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-4">
          <div className="glass-card p-6 text-center">
            <Bot className="w-10 h-10 text-[var(--gold)] mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              افتح المساعد الذكي من الزر العائم لطلب تلخيص أو صياغة مذكرة لهذه القضية.
            </p>
          </div>
        </TabsContent>
      </Tabs>

      {confirmDel && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-2">تأكيد الحذف</h3>
            <p className="text-sm text-muted-foreground mb-5">
              سيتم حذف القضية #{c.case_number} نهائيًا مع كل الجلسات والمدفوعات والمستندات المرتبطة
              بها.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDel(false)}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                إلغاء
              </button>
              <button
                disabled={delCase.isPending}
                onClick={() => delCase.mutate()}
                className="px-4 py-2 rounded-md bg-rose-500 text-white text-sm font-semibold"
              >
                {delCase.isPending ? "..." : "حذف نهائي"}
              </button>
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

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5">{value || "—"}</div>
    </div>
  );
}

function EditField({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: any;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm"
      />
    </div>
  );
}
