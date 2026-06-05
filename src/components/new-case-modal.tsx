// Reusable "new case" modal with structured case number + category dropdown.
// Used from clients flow (auto-open after creating client) and cases page.
import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CASE_CATEGORIES, formatCaseId } from "@/lib/case-format";

export function NewCaseModal({
  presetClientId,
  onClose,
  onSuccess,
}: {
  presetClientId?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}) {
  const qc = useQueryClient();
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [form, setForm] = useState<any>({
    client_id: presetClientId || "",
    case_number: "",
    case_year: new Date().getFullYear(),
    case_category: "مدني",
    court_location: "",
    court_name: "",
    opponent_name: "",
    status: "active",
    next_session_date: "",
    notes: "",
  });

  useEffect(() => {
    if (presetClientId) setForm((f: any) => ({ ...f, client_id: presetClientId }));
  }, [presetClientId]);

  const create = useMutation({
    mutationFn: async (data: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      const payload = {
        ...data,
        user_id: u.user.id,
        case_year: data.case_year ? Number(data.case_year) : null,
        next_session_date: data.next_session_date || null,
      };
      const { data: created, error } = await supabase
        .from("cases")
        .insert(payload)
        .select("id, client_id, next_session_date")
        .maybeSingle();
      if (error) throw error;
      if (!created?.id) throw new Error("تعذّر استرجاع بيانات القضية بعد الحفظ");

      // Auto-create linked session record when a next session date is provided
      if (created.next_session_date) {
        const { error: sErr } = await supabase.from("sessions").insert({
          user_id: u.user.id,
          case_id: created.id,
          session_date: created.next_session_date,
          location: data.court_name || data.court_location || null,
        });
        if (sErr) console.warn("[case] session auto-create failed", sErr.message);
      }
      return created;
    },
    onSuccess: () => {
      toast.success("تمت إضافة القضية");
      qc.invalidateQueries({ queryKey: ["cases"] });
      qc.invalidateQueries({ queryKey: ["all-sessions"] });
      qc.invalidateQueries({ queryKey: ["client-sessions"] });
      qc.invalidateQueries({ queryKey: ["case-sessions"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["upcoming-sessions"] });
      onSuccess?.();
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const preview = formatCaseId(form);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card w-full max-w-2xl p-6 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold">قضية جديدة</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            create.mutate(form);
          }}
          className="space-y-3"
        >
          <Field label="الموكل" required>
            <select
              required
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="cinput"
            >
              <option value="">اختر موكلاً</option>
              {clients
                .filter((c: any) => c?.id)
                .map((c: any) => (
                  <option key={c?.id} value={c?.id}>
                    {c.full_name}
                  </option>
                ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Field label="رقم القضية" required>
              <input
                required
                value={form.case_number}
                onChange={(e) => setForm({ ...form, case_number: e.target.value })}
                className="cinput"
              />
            </Field>
            <Field label="سنة القضية" required>
              <input
                required
                type="number"
                min="1900"
                max="2100"
                value={form.case_year}
                onChange={(e) => setForm({ ...form, case_year: e.target.value })}
                className="cinput"
              />
            </Field>
            <Field label="نوع القضية" required>
              <select
                required
                value={form.case_category}
                onChange={(e) => setForm({ ...form, case_category: e.target.value })}
                className="cinput"
              >
                {CASE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="المركز / المحكمة" required>
              <input
                required
                value={form.court_location}
                onChange={(e) => setForm({ ...form, court_location: e.target.value })}
                className="cinput"
                placeholder="الإسماعيلية"
              />
            </Field>
          </div>

          <div className="px-3 py-2 rounded-md bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-sm">
            <span className="text-muted-foreground ml-2">رقم القضية المنسّق:</span>
            <span className="font-bold gold-text">{preview}</span>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="اسم المحكمة (تفصيلي)">
              <input
                value={form.court_name}
                onChange={(e) => setForm({ ...form, court_name: e.target.value })}
                className="cinput"
                placeholder="محكمة الإسماعيلية الابتدائية"
              />
            </Field>
            <Field label="الخصم">
              <input
                value={form.opponent_name}
                onChange={(e) => setForm({ ...form, opponent_name: e.target.value })}
                className="cinput"
              />
            </Field>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <Field label="موعد الجلسة القادمة">
              <input
                type="datetime-local"
                value={form.next_session_date}
                onChange={(e) => setForm({ ...form, next_session_date: e.target.value })}
                className="cinput"
              />
            </Field>
            <Field label="الحالة">
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="cinput"
              >
                <option value="active">متداولة</option>
                <option value="closed">منتهية</option>
              </select>
            </Field>
          </div>

          <Field label="ملاحظات">
            <textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="cinput"
            />
          </Field>

          <button
            disabled={create.isPending}
            className="btn-gold w-full py-2.5 rounded-md font-bold"
          >
            {create.isPending ? "..." : "حفظ القضية"}
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
