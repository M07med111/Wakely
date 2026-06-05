import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CalendarPlus, FileText, Wallet, Activity } from "lucide-react";
import { format } from "date-fns";

type Event = {
  id: string;
  date: string;
  type: "session" | "doc" | "payment" | "case";
  title: string;
  hint?: string;
};

export function ActivityTimeline({ caseId }: { caseId: string }) {
  const { data: events = [] } = useQuery({
    queryKey: ["case-activity", caseId],
    queryFn: async (): Promise<Event[]> => {
      const [sess, docs, pay, cs] = await Promise.all([
        supabase
          .from("sessions")
          .select("id, session_date, notes, created_at")
          .eq("case_id", caseId),
        supabase.from("documents").select("id, name, created_at").eq("case_id", caseId),
        supabase
          .from("payments")
          .select("id, amount, status, created_at, paid_at")
          .eq("case_id", caseId),
        supabase
          .from("cases")
          .select("created_at, updated_at, status")
          .eq("id", caseId)
          .maybeSingle(),
      ]);

      const out: Event[] = [];
      (sess.data ?? []).forEach((s: any) =>
        out.push({
          id: `s-${s.id}`,
          date: s.created_at,
          type: "session",
          title: "تمت إضافة جلسة",
          hint: format(new Date(s.session_date), "yyyy/MM/dd HH:mm"),
        }),
      );
      (docs.data ?? []).forEach((d: any) =>
        out.push({
          id: `d-${d.id}`,
          date: d.created_at,
          type: "doc",
          title: "تم رفع مستند",
          hint: d.name,
        }),
      );
      (pay.data ?? []).forEach((p: any) =>
        out.push({
          id: `p-${p.id}`,
          date: p.paid_at ?? p.created_at,
          type: "payment",
          title: p.status === "paid" ? "تم تسجيل دفعة مدفوعة" : "تم إضافة دفعة معلّقة",
          hint: `${Number(p.amount).toLocaleString()} ج.م`,
        }),
      );
      if (cs.data) {
        out.push({
          id: `c-open-${caseId}`,
          date: cs.data.created_at,
          type: "case",
          title: "تم فتح القضية",
        });
        if (cs.data.status === "closed") {
          out.push({
            id: `c-close-${caseId}`,
            date: cs.data.updated_at,
            type: "case",
            title: "تم إغلاق القضية",
          });
        }
      }
      return out.sort((a, b) => +new Date(b.date) - +new Date(a.date));
    },
  });

  const iconFor = (t: Event["type"]) =>
    t === "session" ? CalendarPlus : t === "doc" ? FileText : t === "payment" ? Wallet : Activity;

  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground py-4 text-center">لا يوجد نشاط بعد.</p>;
  }

  return (
    <ol className="relative border-r-2 border-border mr-3 space-y-4">
      {events.map((e) => {
        const Icon = iconFor(e.type);
        return (
          <li key={e?.id} className="pr-6 relative">
            <span className="absolute -right-[11px] top-1 w-5 h-5 rounded-full bg-card border-2 border-[var(--gold)] grid place-items-center">
              <Icon className="w-2.5 h-2.5 text-[var(--gold)]" />
            </span>
            <div className="text-sm font-semibold">{e.title}</div>
            {e.hint && <div className="text-[11px] text-muted-foreground mt-0.5">{e.hint}</div>}
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {format(new Date(e.date), "yyyy/MM/dd HH:mm")}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
