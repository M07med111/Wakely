import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { motion } from "framer-motion";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { useMemo, useState } from "react";
import { exportToExcel, printElement } from "@/lib/export-utils";
import { FileSpreadsheet, Printer, TrendingUp, Wallet, Briefcase, CalendarClock, Users } from "lucide-react";
import { format, subMonths, startOfMonth } from "date-fns";

export const Route = createFileRoute("/_authenticated/analytics")({
  component: Analytics,
});

const GOLD = "oklch(0.82 0.14 82)";
const GOLD_SOFT = "oklch(0.65 0.10 80)";
const PIE_COLORS = ["#d4a629", "#8a6a00", "#6b6b6b", "#a8741a", "#5b4a1f"];

function monthKey(d: Date) {
  return format(startOfMonth(d), "yyyy-MM");
}

function lastNMonths(n: number) {
  const arr: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    arr.push({ key: monthKey(d), label: format(d, "MMM yy") });
  }
  return arr;
}

function Analytics() {
  const [range, setRange] = useState<6 | 12>(6);

  const { data } = useQuery({
    queryKey: ["analytics", range],
    queryFn: async () => {
      const since = subMonths(new Date(), range).toISOString();
      const [payments, cases, sessions, clients] = await Promise.all([
        supabase.from("payments").select("amount,status,due_date,paid_at,created_at"),
        supabase.from("cases").select("status,case_type,created_at"),
        supabase.from("sessions").select("session_date,outcome,created_at"),
        supabase.from("clients").select("created_at,full_name"),
      ]);

      return {
        payments: payments.data ?? [],
        cases: cases.data ?? [],
        sessions: sessions.data ?? [],
        clients: clients.data ?? [],
        since,
      };
    },
  });

  const months = useMemo(() => lastNMonths(range), [range]);

  const revenueByMonth = useMemo(() => {
    const base = Object.fromEntries(months.map((m) => [m.key, { month: m.label, paid: 0, pending: 0 }]));
    (data?.payments ?? []).forEach((p: any) => {
      const dt = p.paid_at || p.due_date || p.created_at;
      if (!dt) return;
      const k = monthKey(new Date(dt));
      if (!base[k]) return;
      const amt = Number(p.amount || 0);
      if (p.status === "paid") base[k].paid += amt;
      else base[k].pending += amt;
    });
    return Object.values(base);
  }, [data, months]);

  const casesByStatus = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.cases ?? []).forEach((c: any) => {
      const s = c.status || "active";
      counts[s] = (counts[s] || 0) + 1;
    });
    const labelMap: Record<string, string> = {
      active: "نشطة",
      won: "مكسوبة",
      lost: "مخسورة",
      closed: "منتهية",
      pending: "معلّقة",
    };
    return Object.entries(counts).map(([k, v]) => ({ name: labelMap[k] || k, value: v }));
  }, [data]);

  const casesByType = useMemo(() => {
    const counts: Record<string, number> = {};
    (data?.cases ?? []).forEach((c: any) => {
      const t = c.case_type || "أخرى";
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [data]);

  const sessionsTrend = useMemo(() => {
    const base = Object.fromEntries(
      months.map((m) => [m.key, { month: m.label, completed: 0, upcoming: 0 }]),
    );
    const now = new Date();
    (data?.sessions ?? []).forEach((s: any) => {
      const k = monthKey(new Date(s.session_date));
      if (!base[k]) return;
      if (new Date(s.session_date) > now) base[k].upcoming += 1;
      else base[k].completed += 1;
    });
    return Object.values(base);
  }, [data, months]);

  const newClientsByMonth = useMemo(() => {
    const base = Object.fromEntries(months.map((m) => [m.key, { month: m.label, count: 0 }]));
    (data?.clients ?? []).forEach((c: any) => {
      const k = monthKey(new Date(c.created_at));
      if (base[k]) base[k].count += 1;
    });
    return Object.values(base);
  }, [data, months]);

  const totals = useMemo(() => {
    const paid = (data?.payments ?? [])
      .filter((p: any) => p.status === "paid")
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    const pending = (data?.payments ?? [])
      .filter((p: any) => p.status !== "paid")
      .reduce((s: number, p: any) => s + Number(p.amount || 0), 0);
    return {
      paid,
      pending,
      cases: data?.cases?.length ?? 0,
      sessions: data?.sessions?.length ?? 0,
      clients: data?.clients?.length ?? 0,
    };
  }, [data]);

  function exportXlsx() {
    exportToExcel(`mizan-analytics-${format(new Date(), "yyyy-MM-dd")}`, [
      { name: "الإيرادات", rows: revenueByMonth },
      { name: "القضايا حسب الحالة", rows: casesByStatus },
      { name: "القضايا حسب النوع", rows: casesByType },
      { name: "الجلسات", rows: sessionsTrend },
      { name: "الموكلون الجدد", rows: newClientsByMonth },
    ]);
  }

  const cards = [
    { label: "إيرادات مدفوعة", value: `${totals.paid.toLocaleString()} ج.م`, icon: Wallet },
    { label: "إيرادات معلّقة", value: `${totals.pending.toLocaleString()} ج.م`, icon: TrendingUp },
    { label: "إجمالي القضايا", value: totals.cases, icon: Briefcase },
    { label: "إجمالي الجلسات", value: totals.sessions, icon: CalendarClock },
    { label: "الموكلون", value: totals.clients, icon: Users },
  ];

  return (
    <div>
      <TopBar>
        <div className="flex items-center gap-2">
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value) as 6 | 12)}
            className="bg-card border border-border rounded-md px-3 py-2 text-sm outline-none"
          >
            <option value={6}>آخر ٦ أشهر</option>
            <option value={12}>آخر ١٢ شهراً</option>
          </select>
          <button
            onClick={exportXlsx}
            className="flex items-center gap-2 bg-card border border-border hover:border-[var(--gold)] rounded-md px-3 py-2 text-sm"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button
            onClick={() => printElement("analytics-report", "تقرير التحليلات — ميزان")}
            className="flex items-center gap-2 btn-gold rounded-md px-3 py-2 text-sm font-semibold"
          >
            <Printer className="w-4 h-4" /> طباعة / PDF
          </button>
        </div>
      </TopBar>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">التحليلات والتقارير</h1>
        <p className="text-muted-foreground mt-1">رؤية شاملة لأداء المكتب القانوني</p>
      </div>

      <div id="analytics-report">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c, i) => (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="glass-card p-5"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{c.label}</span>
                <c.icon className="w-4 h-4 text-[var(--gold)]" />
              </div>
              <div className="mt-3 text-2xl font-bold gold-text">{c.value}</div>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <ChartCard title="الإيرادات الشهرية (مدفوع/معلّق)">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueByMonth}>
                <defs>
                  <linearGradient id="gPaid" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD} stopOpacity={0.7} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gPend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={GOLD_SOFT} stopOpacity={0.5} />
                    <stop offset="95%" stopColor={GOLD_SOFT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.2} />
                <XAxis dataKey="month" stroke="#999" fontSize={12} />
                <YAxis stroke="#999" fontSize={12} />
                <Tooltip contentStyle={{ background: "#222", border: "1px solid #444", borderRadius: 8 }} />
                <Legend />
                <Area type="monotone" dataKey="paid" name="مدفوع" stroke={GOLD} fill="url(#gPaid)" />
                <Area type="monotone" dataKey="pending" name="معلّق" stroke={GOLD_SOFT} fill="url(#gPend)" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="القضايا حسب الحالة">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={casesByStatus}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label
                >
                  {casesByStatus.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ background: "#222", border: "1px solid #444", borderRadius: 8 }} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="القضايا حسب النوع">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={casesByType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.2} />
                <XAxis dataKey="name" stroke="#999" fontSize={12} />
                <YAxis stroke="#999" fontSize={12} />
                <Tooltip contentStyle={{ background: "#222", border: "1px solid #444", borderRadius: 8 }} />
                <Bar dataKey="value" name="عدد القضايا" fill={GOLD} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="الجلسات (مكتملة / قادمة)">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={sessionsTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.2} />
                <XAxis dataKey="month" stroke="#999" fontSize={12} />
                <YAxis stroke="#999" fontSize={12} />
                <Tooltip contentStyle={{ background: "#222", border: "1px solid #444", borderRadius: 8 }} />
                <Legend />
                <Line type="monotone" dataKey="completed" name="مكتملة" stroke={GOLD} strokeWidth={2} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="upcoming" name="قادمة" stroke={GOLD_SOFT} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="موكلون جدد شهرياً" full>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={newClientsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.2} />
                <XAxis dataKey="month" stroke="#999" fontSize={12} />
                <YAxis stroke="#999" fontSize={12} />
                <Tooltip contentStyle={{ background: "#222", border: "1px solid #444", borderRadius: 8 }} />
                <Bar dataKey="count" name="عدد الموكلين" fill={GOLD_SOFT} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, children, full }: { title: string; children: React.ReactNode; full?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card p-5 ${full ? "lg:col-span-2" : ""}`}
    >
      <h3 className="font-bold mb-4">{title}</h3>
      {children}
    </motion.div>
  );
}
