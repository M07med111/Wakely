import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { Plus, Wallet, X, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { StatusBadge } from "@/components/status-badge";
import { differenceInDays, format } from "date-fns";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
});

function PaymentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ["payments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*, clients(id, full_name), cases(id, case_number)").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name").order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const totalPaid = payments.filter((p: any) => p.status === "paid").reduce((s: number, p: any) => s + Number(p.amount), 0);
  const totalPending = payments.filter((p: any) => p.status === "pending").reduce((s: number, p: any) => s + Number(p.amount), 0);

  const create = useMutation({
    mutationFn: async (form: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      const { data, error } = await supabase.from("payments").insert({ ...form, user_id: u.user.id }).select("id").maybeSingle();
      if (error) throw error;
      if (!data?.id) throw new Error("تعذّر استرجاع بيانات الدفعة بعد الحفظ");
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["payments"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const togglePaid = useMutation({
    mutationFn: async (p: any) => {
      if (!p?.id) throw new Error("بيانات الدفعة غير متاحة");
      const next = p.status === "paid" ? "pending" : "paid";
      const { error } = await supabase.from("payments").update({ status: next, paid_at: next === "paid" ? new Date().toISOString() : null }).eq("id", p?.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payments"] }),
  });

  if (isLoading) return <div className="p-6 space-y-3 animate-pulse"><div className="h-8 w-48 bg-muted rounded" /><div className="h-28 bg-muted/40 rounded-xl" /></div>;
  if (error) return <div className="glass-card p-8 text-center text-sm text-muted-foreground">حدث خطأ أثناء تحميل البيانات: {(error as Error).message}</div>;

  return (
    <div>
      <TopBar>
        <button onClick={() => setOpen(true)} className="btn-gold px-4 py-2 rounded-md font-semibold flex items-center gap-2">
          <Plus className="w-4 h-4" /> دفعة جديدة
        </button>
      </TopBar>

      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-3"><Wallet className="w-8 h-8 text-[var(--gold)]" />المدفوعات والأتعاب</h1>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div className="glass-card p-5"><div className="text-xs text-muted-foreground">إجمالي المحصّل</div><div className="text-3xl font-bold gold-text mt-2">{totalPaid.toLocaleString()} ج.م</div></div>
        <div className="glass-card p-5"><div className="text-xs text-muted-foreground">إجمالي المعلّق</div><div className="text-3xl font-bold mt-2 text-amber-300">{totalPending.toLocaleString()} ج.م</div></div>
      </div>

      {payments.length === 0 ? (
        <EmptyState icon={Wallet} title="لا توجد مدفوعات" description="سجّل أتعاب القضايا والمدفوعات هنا." actionLabel="دفعة جديدة" onAction={() => setOpen(true)} />
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {payments.filter((p: any) => p?.id).map((p: any) => {
              const overdue = p.status === "pending" && p.due_date && differenceInDays(new Date(), new Date(p.due_date)) > 0;
              return (
                <div key={p?.id} className={`glass-card p-4 ${overdue ? "border-rose-500/40" : ""}`}>
                  <div className="flex items-center justify-between mb-1">
                    {p.clients?.id ? (
                      <Link to="/clients/$id" params={{ id: p.clients.id }} className="font-semibold text-sm truncate hover:text-[var(--gold)]">{p.clients.full_name}</Link>
                    ) : (
                      <div className="font-semibold text-sm truncate">{p.clients?.full_name ?? "—"}</div>
                    )}
                    <StatusBadge status={overdue ? "overdue" : (p.status === "paid" ? "paid" : "pending")} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.cases?.id ? (
                      <Link to="/cases/$id" params={{ id: p.cases.id }} className="hover:text-[var(--gold)]">#{p.cases.case_number}</Link>
                    ) : "—"}
                    {p.due_date && ` · ${format(new Date(p.due_date), "yyyy/MM/dd")}`}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-base font-bold gold-text">{Number(p.amount).toLocaleString()} {p.currency}</div>
                    <button onClick={() => togglePaid.mutate(p)} className="text-xs text-[var(--gold)] flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />{p.status === "paid" ? "تراجع" : "تحديد كمدفوع"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          <div className="glass-card overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr><th className="text-right p-3">الموكل</th><th className="text-right p-3">القضية</th><th className="text-right p-3">المبلغ</th><th className="text-right p-3">الحالة</th><th className="p-3"></th></tr>
              </thead>
              <tbody>
                {payments.filter((p: any) => p?.id).map((p: any) => {
                  const overdue = p.status === "pending" && p.due_date && differenceInDays(new Date(), new Date(p.due_date)) > 0;
                  return (
                    <tr key={p?.id} className="border-t border-border">
                      <td className="p-3">{p.clients?.id ? <Link to="/clients/$id" params={{ id: p.clients.id }} className="hover:text-[var(--gold)]">{p.clients.full_name}</Link> : (p.clients?.full_name ?? "—")}</td>
                      <td className="p-3">{p.cases?.id ? <Link to="/cases/$id" params={{ id: p.cases.id }} className="hover:text-[var(--gold)]">#{p.cases.case_number}</Link> : (p.cases?.case_number ? `#${p.cases.case_number}` : "—")}</td>
                      <td className="p-3 font-bold">{Number(p.amount).toLocaleString()} {p.currency}</td>
                      <td className="p-3"><StatusBadge status={overdue ? "overdue" : (p.status === "paid" ? "paid" : "pending")} /></td>
                      <td className="p-3 text-left">
                        <button onClick={() => togglePaid.mutate(p)} className="text-xs text-[var(--gold)] hover:underline flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />{p.status === "paid" ? "تراجع" : "تحديد كمدفوع"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && <NewPaymentModal clients={clients} onClose={() => setOpen(false)} onSubmit={(f: any) => create.mutate(f)} loading={create.isPending} />}
    </div>
  );
}

function NewPaymentModal({ clients, onClose, onSubmit, loading }: any) {
  const [form, setForm] = useState({ client_id: "", amount: 0, currency: "EGP", status: "pending", notes: "" });
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">دفعة جديدة</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit({ ...form, amount: Number(form.amount) }); }} className="space-y-3">
          <label className="block text-sm">الموكل
            <select required value={form.client_id} onChange={(e) => setForm({ ...form, client_id: e.target.value })} className="input mt-1">
              <option value="">اختر</option>
              {clients.filter((c: any) => c?.id).map((c: any) => <option key={c?.id} value={c?.id}>{c.full_name}</option>)}
            </select>
          </label>
          <label className="block text-sm">المبلغ
            <input required type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value as any })} className="input mt-1" />
          </label>
          <label className="block text-sm">الحالة
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="input mt-1">
              <option value="pending">معلّقة</option><option value="paid">مدفوعة</option>
            </select>
          </label>
          <label className="block text-sm">ملاحظات
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="input mt-1" />
          </label>
          <button disabled={loading} className="btn-gold w-full py-2.5 rounded-md font-bold">{loading ? "..." : "حفظ"}</button>
        </form>
        <style>{`.input{width:100%;background:var(--input);border:1px solid var(--border);border-radius:.5rem;padding:.55rem .75rem;color:var(--foreground);outline:none;font-size:.875rem}.input:focus{border-color:var(--gold)}`}</style>
      </div>
    </div>
  );
}
