import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { format } from "date-fns";
import { CalendarDays, Printer, FileSpreadsheet } from "lucide-react";
import { useState, useMemo } from "react";
import { formatCaseId } from "@/lib/case-format";
import { exportToExcel } from "@/lib/export-utils";
import { PageError } from "@/components/page-feedback";

export const Route = createFileRoute("/_authenticated/sessions")({
  component: SessionsPage,
});

function SessionsPage() {
  const { data: sessions = [], error } = useQuery({
    queryKey: ["all-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select(
          "*, cases(id, case_number, case_year, case_category, court_location, court_name, status, clients(id, full_name))",
        )
        .order("session_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const defaultFrom = today.toISOString().slice(0, 10);
  const defaultTo = new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);

  const upcoming = sessions.filter((s: any) => new Date(s.session_date) >= today);
  const past = sessions.filter((s: any) => new Date(s.session_date) < today);

  const filteredFuture = useMemo(() => {
    const f = new Date(from).getTime();
    const t = new Date(to).getTime() + 86400000;
    return upcoming.filter((s: any) => {
      const ts = new Date(s.session_date).getTime();
      return ts >= f && ts < t;
    });
  }, [upcoming, from, to]);

  function handlePrint() {
    window.print();
  }

  async function handleExcel() {
    const rows = filteredFuture.map((s: any) => ({
      "اسم الموكل": s.cases?.clients?.full_name ?? "—",
      "رقم القضية": formatCaseId(s.cases ?? {}),
      "تاريخ الجلسة": format(new Date(s.session_date), "yyyy/MM/dd HH:mm"),
      المحكمة: s.cases?.court_name ?? s.cases?.court_location ?? "—",
      "حالة القضية": s.cases?.status === "closed" ? "منتهية" : "متداولة",
    }));
    await exportToExcel("تقرير_الجلسات_المستقبلية", [{ name: "جلسات", rows }]);
  }

  if (error) return <PageError message={(error as Error).message} />;

  return (
    <div>
      <TopBar />
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <CalendarDays className="w-8 h-8 text-[var(--gold)]" /> جدول الجلسات
        </h1>
        <p className="text-muted-foreground mt-1">جلسات المحكمة + تقرير الجلسات المستقبلية</p>
      </div>

      {/* Future-sessions report */}
      <div className="glass-card p-5 mb-6 print:shadow-none print:border-black/30">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div>
            <h2 className="font-bold text-lg">تقرير الجلسات المستقبلية</h2>
            <p className="text-xs text-muted-foreground">
              منصة المكتب القانوني للمحاماة والاستشارات القانونية
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            <button
              onClick={handlePrint}
              className="btn-gold px-3 py-1.5 rounded-md text-sm flex items-center gap-1"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            <button
              onClick={handleExcel}
              className="px-3 py-1.5 rounded-md text-sm border border-border hover:border-[var(--gold)] flex items-center gap-1"
            >
              <FileSpreadsheet className="w-4 h-4" /> Excel
            </button>
          </div>
        </div>

        <div className="flex gap-3 mb-4 print:hidden">
          <label className="text-xs">
            من{" "}
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="block mt-1 bg-input border border-border rounded px-2 py-1 text-sm"
            />
          </label>
          <label className="text-xs">
            إلى{" "}
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="block mt-1 bg-input border border-border rounded px-2 py-1 text-sm"
            />
          </label>
        </div>

        {filteredFuture.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد جلسات في النطاق المحدد.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-right p-2 border border-border">الموكل</th>
                  <th className="text-right p-2 border border-border">رقم القضية</th>
                  <th className="text-right p-2 border border-border">تاريخ الجلسة</th>
                  <th className="text-right p-2 border border-border">المحكمة</th>
                  <th className="text-right p-2 border border-border">حالة القضية</th>
                </tr>
              </thead>
              <tbody>
                {filteredFuture.map((s: any) => (
                  <tr key={s?.id}>
                    <td className="p-2 border border-border">
                      {s.cases?.clients?.id ? (
                        <Link
                          to="/clients/$id"
                          params={{ id: s.cases.clients.id }}
                          className="hover:text-[var(--gold)]"
                        >
                          {s.cases.clients.full_name}
                        </Link>
                      ) : (
                        (s.cases?.clients?.full_name ?? "—")
                      )}
                    </td>
                    <td className="p-2 border border-border font-semibold gold-text">
                      {s.cases?.id ? (
                        <Link
                          to="/cases/$id"
                          params={{ id: s.cases.id }}
                          className="hover:underline"
                        >
                          {formatCaseId(s.cases ?? {})}
                        </Link>
                      ) : (
                        formatCaseId(s.cases ?? {})
                      )}
                    </td>
                    <td className="p-2 border border-border">
                      {format(new Date(s.session_date), "yyyy/MM/dd HH:mm")}
                    </td>
                    <td className="p-2 border border-border">
                      {s.cases?.court_name ?? s.cases?.court_location ?? "—"}
                    </td>
                    <td className="p-2 border border-border">
                      {s.cases?.status === "closed" ? "منتهية" : "متداولة"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Section title="جلسات قادمة" items={upcoming} highlight />
      <Section title="جلسات سابقة" items={past} />
    </div>
  );
}

function Section({ title, items, highlight }: any) {
  return (
    <div className="glass-card p-6 mb-6 print:hidden">
      <h2 className="font-bold mb-4">
        {title} ({items.length})
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد جلسات.</p>
      ) : (
        <div className="space-y-2">
          {items.map((s: any) => (
            <div
              key={s?.id}
              className={`p-4 rounded-md border ${highlight ? "border-[var(--gold)]/30 bg-[var(--gold)]/5" : "border-border"}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="font-semibold gold-text">
                  {format(new Date(s.session_date), "EEEE — yyyy/MM/dd HH:mm")}
                </div>
                <div className="text-sm">
                  {s.cases?.id ? (
                    <Link
                      to="/cases/$id"
                      params={{ id: s.cases.id }}
                      className="hover:text-[var(--gold)]"
                    >
                      {formatCaseId(s.cases ?? {})}
                    </Link>
                  ) : (
                    formatCaseId(s.cases ?? {})
                  )}
                </div>
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                {s.cases?.clients?.id ? (
                  <Link
                    to="/clients/$id"
                    params={{ id: s.cases.clients.id }}
                    className="hover:text-[var(--gold)]"
                  >
                    {s.cases.clients.full_name}
                  </Link>
                ) : (
                  s.cases?.clients?.full_name
                )}{" "}
                • {s.cases?.court_name ?? s.cases?.court_location ?? "—"}
              </div>
              {s.notes && <div className="text-xs mt-2">{s.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
