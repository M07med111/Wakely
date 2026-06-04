import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Wallet, CheckCircle2, X } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";
import { StatusBadge } from "./status-badge";

export function CasePayments({ caseId, clientId }: { caseId: string; clientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [addInstallmentFor, setAddInstallmentFor] = useState<any>(null);

  const { data: payments = [] } = useQuery({
    queryKey: ["case-payments", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase.from("payments").select("*").eq("case_id", caseId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: installments = [] } = useQuery({
    queryKey: ["case-installments", caseId],
    queryFn: async () => {
      if (payments.length === 0) return [];
      const ids = payments.map((p: any) => p?.id).filter(Boolean);
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from("payment_installments").select("*").in("payment_id", ids).order("paid_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: payments.length > 0,
  });

  const createPayment = useMutation({
    mutationFn: async (form: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      const { data: payment, error } = await supabase.from("payments").insert({
        user_id: u.user.id,
        client_id: clientId,
        case_id: caseId,
        total_amount: Number(form.total_amount),
        amount: Number(form.total_amount),
        currency: "EGP",
        status: "pending",
        notes: form.notes,
      }).select("id").maybeSingle();
      if (error) throw error;
      if (!payment?.id) throw new Error("تعذّر استرجاع بيانات الأتعاب بعد الحفظ");
      await supabase.from("case_activities").insert({
        user_id: u.user.id,
        case_id: caseId,
        type: "payment_created",
        description: `تم تسجيل أتعاب بإجمالي ${Number(form.total_amount).toLocaleString()} ج.م`,
      });
    },
    onSuccess: () => {
      toast.success("تم");
      qc.invalidateQueries({ queryKey: ["case-payments", caseId] });
      qc.invalidateQueries({ queryKey: ["case-activity", caseId] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addInstallment = useMutation({
    mutationFn: async ({ payment, amount, notes }: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      if (!payment?.id) throw new Error("بيانات الأتعاب غير متاحة");
      const { error } = await supabase.from("payment_installments").insert({
        user_id: u.user.id,
        payment_id: payment?.id,
        amount: Number(amount),
        notes,
      });
      if (error) throw error;

      // Recompute paid + status
      const { data: ins } = await supabase.from("payment_installments").select("amount").eq("payment_id", payment?.id);
      const paid = (ins ?? []).reduce((s: number, i: any) => s + Number(i.amount), 0);
      const total = Number(payment.total_amount ?? payment.amount ?? 0);
      const status = total > 0 && paid >= total ? "paid" : paid > 0 ? "partial" : "pending";
      await supabase.from("payments").update({
        status,
        paid_at: status === "paid" ? new Date().toISOString() : null,
      }).eq("id", payment?.id);

      await supabase.from("case_activities").insert({
        user_id: u.user.id,
        case_id: caseId,
        type: "installment_paid",
        description: `تم تسجيل دفعة ${Number(amount).toLocaleString()} ج.م`,
      });
    },
    onSuccess: () => {
      toast.success("تم تسجيل الدفعة");
      qc.invalidateQueries({ queryKey: ["case-payments", caseId] });
      qc.invalidateQueries({ queryKey: ["case-installments", caseId] });
      qc.invalidateQueries({ queryKey: ["case-activity", caseId] });
      setAddInstallmentFor(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const summary = (p: any) => {
    const total = Number(p.total_amount ?? p.amount ?? 0);
    const paid = installments.filter((i: any) => i.payment_id === p.id).reduce((s: number, i: any) => s + Number(i.amount), 0);
    const remaining = Math.max(0, total - paid);
    const pct = total > 0 ? Math.min(100, (paid / total) * 100) : 0;
    return { total, paid, remaining, pct };
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => setOpen(true)} className="btn-gold px-4 py-2 rounded-md font-semibold flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> أتعاب جديدة
        </button>
      </div>

      {payments.length === 0 ? (
        <p className="text-muted-foreground text-sm py-6 text-center">لا توجد أتعاب مسجّلة على هذه القضية.</p>
      ) : (
        <div className="space-y-3">
            {payments.filter((p: any) => p?.id).map((p: any) => {
            const s = summary(p);
            const pInstallments = installments.filter((i: any) => i.payment_id === p.id);
            return (
              <div key={p?.id} className="bg-card/60 border border-border rounded-xl p-4">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-[var(--gold)]" />
                    <div className="font-bold text-lg">{s.total.toLocaleString()} ج.م</div>
                  </div>
                  <StatusBadge status={p.status === "paid" ? "paid" : p.status === "partial" ? "partial" : "pending"} label={p.status === "pending" ? "بانتظار الدفع" : undefined} />
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                  <div className="bg-muted/40 rounded-md p-2"><div className="text-muted-foreground">المدفوع</div><div className="font-bold text-emerald-400">{s.paid.toLocaleString()}</div></div>
                  <div className="bg-muted/40 rounded-md p-2"><div className="text-muted-foreground">المتبقي</div><div className="font-bold text-amber-300">{s.remaining.toLocaleString()}</div></div>
                  <div className="bg-muted/40 rounded-md p-2"><div className="text-muted-foreground">النسبة</div><div className="font-bold gold-text">{s.pct.toFixed(0)}%</div></div>
                </div>

                <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-gradient-to-r from-[var(--gold)] to-emerald-500 transition-all" style={{ width: `${s.pct}%` }} />
                </div>

                {pInstallments.length > 0 && (
                  <div className="space-y-1 mb-3">
                    {pInstallments.map((i: any) => (
                      <div key={i?.id} className="flex items-center justify-between text-xs px-2 py-1 bg-muted/30 rounded">
                        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3 h-3 text-emerald-400" />{Number(i.amount).toLocaleString()} ج.م</span>
                        <span className="text-muted-foreground">{format(new Date(i.paid_at), "yyyy/MM/dd")}</span>
                      </div>
                    ))}
                  </div>
                )}

                {s.remaining > 0 && (
                  <button onClick={() => setAddInstallmentFor(p)} className="text-xs text-[var(--gold)] hover:underline flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5" /> تسجيل دفعة
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {open && (
        <Modal title="أتعاب جديدة" onClose={() => setOpen(false)} onSubmit={(f: any) => createPayment.mutate(f)} loading={createPayment.isPending}
          fields={[{ name: "total_amount", label: "إجمالي الأتعاب (ج.م)", type: "number", required: true }, { name: "notes", label: "ملاحظات", type: "text" }]} />
      )}
      {addInstallmentFor && (
        <Modal title={`تسجيل دفعة (المتبقي ${summary(addInstallmentFor).remaining.toLocaleString()} ج.م)`}
          onClose={() => setAddInstallmentFor(null)}
          onSubmit={(f: any) => addInstallment.mutate({ payment: addInstallmentFor, ...f })}
          loading={addInstallment.isPending}
          fields={[{ name: "amount", label: "المبلغ (ج.م)", type: "number", required: true }, { name: "notes", label: "ملاحظات", type: "text" }]} />
      )}
    </div>
  );
}

function Modal({ title, onClose, onSubmit, loading, fields }: any) {
  const [form, setForm] = useState<any>({});
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-3">
          {fields.map((f: any) => (
            <label key={f.name} className="block text-sm">{f.label}
              <input required={f.required} type={f.type} step="0.01" value={form[f.name] ?? ""}
                onChange={(e) => setForm({ ...form, [f.name]: e.target.value })}
                className="w-full mt-1 bg-input border border-border rounded-md px-3 py-2 outline-none focus:border-[var(--gold)] text-sm" />
            </label>
          ))}
          <button disabled={loading} className="btn-gold w-full py-2.5 rounded-md font-bold">{loading ? "..." : "حفظ"}</button>
        </form>
      </div>
    </div>
  );
}
