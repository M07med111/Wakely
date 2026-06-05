import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { useState } from "react";
import { Plus, UserCircle2, Phone, X, Users, Mail, FileText, Archive } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { NewCaseModal } from "@/components/new-case-modal";
import { ClientDetailsModal } from "@/components/client-details-modal";
import { ArchiveModal } from "@/components/archive-modal";

export const Route = createFileRoute("/_authenticated/clients")({
  component: ClientsPage,
});

function ClientsPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [newCaseClientId, setNewCaseClientId] = useState<string | null>(null);
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; name: string } | null>(null);

  const {
    data: clients = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["clients", q],
    queryFn: async () => {
      let query = supabase
        .from("clients")
        .select("*")
        .eq("is_archived", false)
        .order("created_at", { ascending: false });
      if (q) query = query.ilike("full_name", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("clients")
        .update({ is_archived: true, archived_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت أرشفة الموكل");
      setConfirmArchive(null);
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["clients-archived"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      const userId = u.user.id;

      // upload POA file if provided
      let poa_file_path: string | null = null;
      if (form._poaFile) {
        const f: File = form._poaFile;
        const path = `${userId}/poa/${Date.now()}-${f.name}`;
        const { error: upErr } = await supabase.storage.from("case-documents").upload(path, f);
        if (upErr) throw upErr;
        poa_file_path = path;
      }

      const payload: any = {
        user_id: userId,
        full_name: form.full_name,
        national_id: form.national_id || null,
        phone: form.phone || null,
        email: form.email || null,
        address: form.address || null,
        notes: form.notes || null,
        poa_number: form.poa_number || null,
        poa_year: form.poa_year ? Number(form.poa_year) : null,
        poa_letter: form.poa_letter || null,
        poa_type: form.poa_type || null,
        poa_file_path,
      };
      const { data, error } = await supabase
        .from("clients")
        .insert(payload)
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("تعذّر استرجاع بيانات الموكل بعد الحفظ");
      return data;
    },
    onSuccess: (created) => {
      toast.success("تمت إضافة الموكل — يمكنك الآن إنشاء قضية");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
      if (created?.id) setNewCaseClientId(created.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <PageLoading />;
  if (error) return <PageError message={(error as Error).message} />;

  return (
    <div>
      <TopBar>
        <button
          onClick={() => setArchiveOpen(true)}
          className="px-3 py-2 rounded-md border border-border hover:border-[var(--gold)] text-sm flex items-center gap-1.5"
        >
          <Archive className="w-4 h-4" /> الأرشيف
        </button>
        <button
          onClick={() => setOpen(true)}
          className="btn-gold px-4 py-2 rounded-md font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> موكل جديد
        </button>
      </TopBar>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">الموكلون</h1>
        <p className="text-muted-foreground mt-1">إدارة جميع موكلي المكتب</p>
      </div>

      <div className="mb-5">
        <input
          placeholder="ابحث بالاسم..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full md:max-w-sm bg-card border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-[var(--gold)]"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {clients
          .filter((c: any) => c?.id)
          .map((c, i) => (
            <motion.div
              key={c?.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="relative"
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDetailsClientId(c?.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setDetailsClientId(c?.id);
                }}
                className="glass-card p-5 block w-full text-right hover:border-[var(--gold)] transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-secondary grid place-items-center text-[var(--gold)]">
                    <UserCircle2 className="w-7 h-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold truncate flex items-center gap-2">
                      {c.full_name}
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        نشط
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Phone className="w-3 h-3" />
                      {c.phone || "—"}
                    </div>
                  </div>
                </div>
                {(c as any).email && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-2 truncate">
                    <Mail className="w-3 h-3" />
                    {(c as any).email}
                  </div>
                )}
                {(c as any).poa_number && (
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                    <FileText className="w-3 h-3" />
                    توكيل {(c as any).poa_number}/{(c as any).poa_year ?? "—"}{" "}
                    {(c as any).poa_letter ?? ""} ({(c as any).poa_type ?? "—"})
                  </div>
                )}
                {c.address && (
                  <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{c.address}</p>
                )}
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmArchive({ id: c.id, name: c.full_name });
                }}
                title="أرشفة الموكل"
                className="absolute top-3 left-3 p-1.5 rounded-md border border-border bg-card/80 backdrop-blur hover:border-[var(--gold)] text-muted-foreground hover:text-[var(--gold)]"
              >
                <Archive className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        {clients.length === 0 && (
          <div className="col-span-full">
            <EmptyState
              icon={Users}
              title="لا يوجد موكلون بعد"
              description="ابدأ بإضافة أول موكل لمكتبك."
              actionLabel="موكل جديد"
              onAction={() => setOpen(true)}
            />
          </div>
        )}
      </div>

      {confirmArchive && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
          <div className="glass-card w-full max-w-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <Archive className="w-5 h-5 text-[var(--gold)]" />
              <h3 className="text-lg font-bold">أرشفة الموكل</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-5">
              هل تريد أرشفة <strong className="text-foreground">{confirmArchive.name}</strong>؟
              سيختفي من القوائم الرئيسية مع الاحتفاظ بجميع البيانات وإمكانية استعادته لاحقاً.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmArchive(null)}
                className="px-4 py-2 rounded-md border border-border text-sm"
              >
                لا، إلغاء
              </button>
              <button
                disabled={archive.isPending}
                onClick={() => archive.mutate(confirmArchive.id)}
                className="btn-gold px-4 py-2 rounded-md text-sm font-semibold"
              >
                {archive.isPending ? "..." : "نعم، أرشفة"}
              </button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <NewClientModal
          onClose={() => setOpen(false)}
          onSubmit={(f: any) => create.mutate(f)}
          loading={create.isPending}
        />
      )}
      {newCaseClientId && (
        <NewCaseModal
          presetClientId={newCaseClientId}
          onClose={() => setNewCaseClientId(null)}
          onSuccess={() => {
            setNewCaseClientId(null);
            qc.invalidateQueries({ queryKey: ["cases"] });
          }}
        />
      )}
      <ClientDetailsModal clientId={detailsClientId} onClose={() => setDetailsClientId(null)} />
      <ArchiveModal open={archiveOpen} onClose={() => setArchiveOpen(false)} />
    </div>
  );
}

function NewClientModal({ onClose, onSubmit, loading }: any) {
  const [form, setForm] = useState<any>({
    full_name: "",
    national_id: "",
    phone: "",
    email: "",
    address: "",
    notes: "",
    poa_number: "",
    poa_year: "",
    poa_letter: "",
    poa_type: "",
    _poaFile: null,
  });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">إضافة موكل جديد</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="space-y-3"
        >
          <div className="grid md:grid-cols-2 gap-3">
            <Field label="الاسم الكامل" required>
              <input
                required
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                className="cinput"
              />
            </Field>
            <Field label="الرقم القومي">
              <input
                value={form.national_id}
                onChange={(e) => setForm({ ...form, national_id: e.target.value })}
                className="cinput"
              />
            </Field>
            <Field label="رقم الهاتف">
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="cinput"
              />
            </Field>
            <Field label="البريد الإلكتروني (Gmail)">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="cinput"
              />
            </Field>
          </div>
          <Field label="العنوان">
            <input
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="cinput"
            />
          </Field>

          <div className="border-t border-border pt-3 mt-3">
            <div className="text-sm font-bold text-[var(--gold)] mb-2">بيانات التوكيل</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Field label="رقم التوكيل">
                <input
                  value={form.poa_number}
                  onChange={(e) => setForm({ ...form, poa_number: e.target.value })}
                  className="cinput"
                />
              </Field>
              <Field label="سنة التوكيل">
                <input
                  type="number"
                  min="1900"
                  max="2100"
                  value={form.poa_year}
                  onChange={(e) => setForm({ ...form, poa_year: e.target.value })}
                  className="cinput"
                />
              </Field>
              <Field label="حرف التوكيل">
                <input
                  value={form.poa_letter}
                  onChange={(e) => setForm({ ...form, poa_letter: e.target.value })}
                  className="cinput"
                />
              </Field>
              <Field label="نوع التوكيل">
                <select
                  value={form.poa_type}
                  onChange={(e) => setForm({ ...form, poa_type: e.target.value })}
                  className="cinput"
                >
                  <option value="">—</option>
                  <option value="عام">عام</option>
                  <option value="خاص">خاص</option>
                </select>
              </Field>
            </div>
            <Field label="إرفاق صورة/ملف التوكيل">
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setForm({ ...form, _poaFile: e.target.files?.[0] ?? null })}
                className="cinput"
              />
            </Field>
          </div>

          <Field label="ملاحظات">
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="cinput"
            />
          </Field>

          <button disabled={loading} className="btn-gold w-full py-2.5 rounded-md font-bold">
            {loading ? "..." : "حفظ ومتابعة لإنشاء قضية"}
          </button>
        </form>
        <style>{`.cinput{width:100%;background:var(--input);border:1px solid var(--border);border-radius:.5rem;padding:.55rem .75rem;color:var(--foreground);outline:none;font-size:.875rem}.cinput:focus{border-color:var(--gold)}`}</style>
      </div>
    </div>
  );
}

function Field({ label, children, required }: any) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground mb-1 block">
        {label}
        {required && <span className="text-[var(--gold)]"> *</span>}
      </span>
      {children}
    </label>
  );
}

function PageLoading() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      <div className="h-8 w-40 bg-muted rounded" />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 bg-muted/50 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

function PageError({ message }: { message: string }) {
  return (
    <div className="glass-card p-8 text-center text-sm text-muted-foreground">
      حدث خطأ أثناء تحميل البيانات: {message}
    </div>
  );
}
