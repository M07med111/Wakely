import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Bell, CalendarClock, Wallet, AlertTriangle, X } from "lucide-react";
import { format, isToday, isTomorrow, differenceInDays } from "date-fns";
import { Link } from "@tanstack/react-router";

type Item = {
  id: string;
  icon: any;
  title: string;
  hint: string;
  to: any;
  params?: any;
  tone: "gold" | "rose" | "amber";
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);

  const { data: items = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: async (): Promise<Item[]> => {
      const now = new Date();
      const in7 = new Date(); in7.setDate(in7.getDate() + 7);

      const [sess, pay] = await Promise.all([
        supabase.from("sessions")
          .select("id, session_date, cases(id, case_number, clients(full_name))")
          .gte("session_date", now.toISOString())
          .lte("session_date", in7.toISOString())
          .order("session_date", { ascending: true })
          .limit(8),
        supabase.from("payments")
          .select("id, amount, due_date, clients(full_name)")
          .eq("status", "pending")
          .order("due_date", { ascending: true })
          .limit(8),
      ]);

      const out: Item[] = [];
      for (const s of sess.data ?? []) {
        const d = new Date((s as any).session_date);
        const when = isToday(d) ? "اليوم" : isTomorrow(d) ? "غداً" : format(d, "yyyy/MM/dd");
        out.push({
          id: `s-${s.id}`,
          icon: CalendarClock,
          title: `جلسة ${when} — ${(s as any).cases?.clients?.full_name ?? ""}`,
          hint: `قضية #${(s as any).cases?.case_number ?? ""} · ${format(d, "HH:mm")}`,
          to: "/sessions",
          tone: isToday(d) ? "rose" : "gold",
        });
      }
      for (const p of pay.data ?? []) {
        const overdue = p.due_date && differenceInDays(new Date(), new Date(p.due_date)) > 0;
        out.push({
          id: `p-${p.id}`,
          icon: overdue ? AlertTriangle : Wallet,
          title: `${overdue ? "دفعة متأخرة" : "دفعة معلّقة"} — ${(p as any).clients?.full_name ?? ""}`,
          hint: `${Number(p.amount).toLocaleString()} ج.م${p.due_date ? ` · ${format(new Date(p.due_date), "yyyy/MM/dd")}` : ""}`,
          to: "/payments",
          tone: overdue ? "rose" : "amber",
        });
      }
      return out;
    },
    refetchInterval: 60_000,
  });

  const count = useMemo(() => items.length, [items]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="الإشعارات"
        className="relative p-2 rounded-xl hover:bg-card border border-border"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold grid place-items-center bg-rose-500 text-white">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div
            className="absolute top-0 left-0 h-full w-full max-w-sm bg-sidebar border-l border-border p-4 overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2"><Bell className="w-4 h-4 text-[var(--gold)]" /> الإشعارات</h3>
              <button onClick={() => setOpen(false)}><X className="w-5 h-5" /></button>
            </div>

            {items.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-12">لا توجد إشعارات حالياً.</div>
            ) : (
              <div className="space-y-2">
                {items.map((n) => (
                  <Link
                    key={n?.id}
                    to={n.to}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 p-3 rounded-xl bg-card border border-border hover:border-[var(--gold)]"
                  >
                    <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${
                      n.tone === "rose" ? "bg-rose-500/15 text-rose-300" :
                      n.tone === "amber" ? "bg-amber-500/15 text-amber-300" :
                      "bg-[var(--gold)]/15 text-[var(--gold)]"
                    }`}>
                      <n.icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold truncate">{n.title}</div>
                      <div className="text-[11px] text-muted-foreground truncate">{n.hint}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
