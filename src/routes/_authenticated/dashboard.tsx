import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Briefcase,
  Users,
  CalendarClock,
  Wallet,
  Search,
  UserPlus,
  FilePlus2,
  ChevronLeft,
  AlertCircle,
  AlertTriangle,
} from "lucide-react";
import { motion } from "framer-motion";
import { format, isToday, differenceInDays } from "date-fns";
import { useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-center";
import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/page-feedback";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserName } from "@/hooks/use-current-profile";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardRoute,
});

function DashboardRoute() {
  return <DashboardHome />;
}

export function DashboardHome({ userName }: { userName?: string | null } = {}) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { user } = useAuth();
  const currentUserName = useCurrentUserName(user);
  const displayName = (userName || currentUserName).trim();

  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).toISOString();
      const [clients, cases, todaySess, payments] = await Promise.all([
        supabase.from("clients").select("*", { count: "exact", head: true }),
        supabase.from("cases").select("*", { count: "exact", head: true }).neq("status", "closed"),
        supabase
          .from("sessions")
          .select("*", { count: "exact", head: true })
          .gte("session_date", startOfDay)
          .lte("session_date", endOfDay),
        supabase.from("payments").select("amount,status").eq("status", "pending"),
      ]);
      const error = [clients.error, cases.error, todaySess.error, payments.error].find(Boolean);
      if (error) throw error;
      const pendingTotal = (payments.data ?? []).reduce((s, p) => s + Number(p.amount || 0), 0);
      return {
        clients: clients.count ?? 0,
        cases: cases.count ?? 0,
        today: todaySess.count ?? 0,
        pending: pendingTotal,
      };
    },
  });

  const { data: upcoming = [], error: upcomingError } = useQuery({
    queryKey: ["today-sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*, cases(id, case_number, court_name, clients(id, full_name))")
        .gte("session_date", new Date().toISOString())
        .order("session_date", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: overdueCases = [], error: overdueError } = useQuery({
    queryKey: ["overdue-cases"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cases")
        .select("id, case_number, court_name, next_session_date, clients(id, full_name)")
        .neq("status", "closed")
        .not("next_session_date", "is", null)
        .lt("next_session_date", new Date().toISOString())
        .order("next_session_date", { ascending: true })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: recentClients = [], error: recentClientsError } = useQuery({
    queryKey: ["recent-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name, phone")
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pendingPayments = [], error: pendingPaymentsError } = useQuery({
    queryKey: ["pending-payments-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, due_date, cases(id, case_number, clients(id, full_name))")
        .eq("status", "pending")
        .order("due_date", { ascending: true })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (statsLoading)
    return (
      <div className="p-6 space-y-3 animate-pulse">
        <div className="h-9 w-56 bg-muted rounded" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  const pageError =
    statsError ?? upcomingError ?? overdueError ?? recentClientsError ?? pendingPaymentsError;
  if (pageError) return <PageError message={(pageError as Error).message} />;

  const tiles = [
    {
      label: "اليوم",
      value: stats?.today ?? 0,
      icon: CalendarClock,
      to: "/sessions",
      color: "from-amber-500/20",
    },
    {
      label: "موكلون",
      value: stats?.clients ?? 0,
      icon: Users,
      to: "/clients",
      color: "from-blue-500/20",
    },
    {
      label: "قضايا نشطة",
      value: stats?.cases ?? 0,
      icon: Briefcase,
      to: "/cases",
      color: "from-emerald-500/20",
    },
    {
      label: "مستحقات",
      value: `${(stats?.pending ?? 0).toLocaleString()}`,
      icon: Wallet,
      to: "/payments",
      color: "from-rose-500/20",
      small: true,
    },
  ];

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Welcome */}
      <div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <motion.div
            className="min-w-0"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-xl font-bold leading-tight sm:text-2xl lg:text-3xl">
              {displayName ? (
                <>
                  أهلاً بك، <span className="gold-text break-words">{displayName}</span>
                </>
              ) : (
                <>
                  أهلاً بك في <span className="gold-text">لوحة التحكم</span>
                </>
              )}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">نظرة سريعة على نشاط المكتب اليوم</p>
          </motion.div>
          <div className="hidden lg:block">
            <NotificationBell />
          </div>
        </div>

        {/* Live search trigger */}
        <button
          onClick={() => setPaletteOpen(true)}
          className="relative mt-4 w-full min-w-0 text-right group"
          aria-label="بحث"
        >
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <div className="w-full bg-card border border-border rounded-xl pr-10 pl-3 py-3 text-sm text-muted-foreground group-hover:border-[var(--gold)] transition-colors flex items-center justify-between">
            <span>ابحث عن موكل أو قضية...</span>
            <kbd className="hidden md:inline text-[10px] border border-border rounded px-1.5 py-0.5">
              Ctrl K
            </kbd>
          </div>
        </button>
        <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={t.to}
              className={`glass-card p-4 block bg-gradient-to-br ${t.color} to-transparent active:scale-[0.98] transition`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{t.label}</span>
                <t.icon className="w-4 h-4 text-[var(--gold)]" />
              </div>
              <div className={`mt-2 ${t.small ? "text-lg" : "text-2xl"} font-bold gold-text`}>
                {t.value}
                {t.small && <span className="text-xs mr-1 opacity-70">ج.م</span>}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-bold text-muted-foreground mb-2">إجراءات سريعة</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Link to="/clients" className="quick-action">
            <div className="w-10 h-10 rounded-lg btn-gold grid place-items-center">
              <UserPlus className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm">موكل جديد</div>
              <div className="text-[11px] text-muted-foreground">إضافة موكل</div>
            </div>
          </Link>
          <Link to="/cases" className="quick-action">
            <div className="w-10 h-10 rounded-lg btn-gold grid place-items-center">
              <FilePlus2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm">قضية جديدة</div>
              <div className="text-[11px] text-muted-foreground">فتح قضية</div>
            </div>
          </Link>
          <Link to="/sessions" className="quick-action">
            <div className="w-10 h-10 rounded-lg btn-gold grid place-items-center">
              <CalendarClock className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm">جلسة جديدة</div>
              <div className="text-[11px] text-muted-foreground">إضافة موعد</div>
            </div>
          </Link>
          <Link to="/payments" className="quick-action">
            <div className="w-10 h-10 rounded-lg btn-gold grid place-items-center">
              <Wallet className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="font-bold text-sm">دفعة جديدة</div>
              <div className="text-[11px] text-muted-foreground">تسجيل أتعاب</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Overdue cases — high priority */}
      {overdueCases.length > 0 && (
        <Section
          title="قضايا متأخرة"
          to="/cases"
          tone="rose"
          icon={<AlertTriangle className="w-4 h-4 text-rose-300" />}
        >
          <div className="space-y-2">
            {overdueCases
              .filter((c: any) => c?.id)
              .map((c: any) => (
                <Link
                  key={c?.id}
                  to="/cases/$id"
                  params={{ id: c?.id }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-rose-500/5 border border-rose-500/20 hover:border-rose-500/50"
                >
                  <AlertCircle className="w-5 h-5 text-rose-300 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">
                      قضية #{c.case_number}
                      {c.clients?.id ? (
                        <>
                          {" "}
                          —{" "}
                          <Link
                            to="/clients/$id"
                            params={{ id: c.clients.id }}
                            onClick={(e) => e.stopPropagation()}
                            className="hover:text-[var(--gold)] underline-offset-2 hover:underline"
                          >
                            {c.clients.full_name}
                          </Link>
                        </>
                      ) : c.clients?.full_name ? (
                        ` — ${c.clients.full_name}`
                      ) : (
                        ""
                      )}
                    </div>
                    <div className="text-[11px] text-rose-300/80 truncate">
                      تأخرت {differenceInDays(new Date(), new Date(c.next_session_date))} يوم ·{" "}
                      {c.court_name ?? ""}
                    </div>
                  </div>
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </Link>
              ))}
          </div>
        </Section>
      )}

      {/* Today's sessions */}
      <Section title="جلسات اليوم والقادمة" to="/sessions">
        {upcoming.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="لا توجد جلسات قادمة"
            description="جدول جلسة جديدة من القضية."
            actionLabel="إضافة جلسة"
            to="/sessions"
          />
        ) : (
          <div className="space-y-2">
            {upcoming
              .filter((s: any) => s?.id)
              .map((s: any) => (
                <Link
                  key={s?.id}
                  to="/sessions"
                  className="flex items-center gap-3 p-3 rounded-xl bg-card/60 border border-border hover:border-[var(--gold)] active:scale-[0.99] transition"
                >
                  <div className="w-12 text-center shrink-0">
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(s.session_date), "MM/dd")}
                    </div>
                    <div className="text-sm font-bold gold-text">
                      {format(new Date(s.session_date), "HH:mm")}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    {s.cases?.clients?.id ? (
                      <Link
                        to="/clients/$id"
                        params={{ id: s.cases.clients.id }}
                        onClick={(e) => e.stopPropagation()}
                        className="font-semibold text-sm truncate text-right block hover:text-[var(--gold)]"
                      >
                        {s.cases.clients.full_name}
                      </Link>
                    ) : (
                      <div className="font-semibold text-sm truncate">
                        {s.cases?.clients?.full_name ?? "—"}
                      </div>
                    )}
                    <div className="text-[11px] text-muted-foreground truncate">
                      {s.cases?.case_number ?? ""} · {s.cases?.court_name ?? ""}
                    </div>
                  </div>
                  {isToday(new Date(s.session_date)) && (
                    <span className="badge-status bg-rose-500/20 text-rose-200">اليوم</span>
                  )}
                </Link>
              ))}
          </div>
        )}
      </Section>

      {/* Recent clients + pending payments */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="أحدث الموكلين" to="/clients">
          {recentClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title="لا يوجد موكلون"
              description="ابدأ بإضافة أول موكل."
              actionLabel="موكل جديد"
              to="/clients"
            />
          ) : (
            <div className="space-y-2">
              {recentClients
                .filter((c: any) => c?.id)
                .map((c: any) => (
                  <Link
                    key={c?.id}
                    to="/clients/$id"
                    params={{ id: c?.id }}
                    className="flex items-center gap-3 p-3 rounded-xl bg-card/60 border border-border hover:border-[var(--gold)]"
                  >
                    <div className="w-10 h-10 rounded-full bg-secondary grid place-items-center text-[var(--gold)] font-bold">
                      {c.full_name?.[0] ?? "؟"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm truncate">{c.full_name}</div>
                      <div className="text-[11px] text-muted-foreground">{c.phone || "—"}</div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                  </Link>
                ))}
            </div>
          )}
        </Section>

        <Section title="مدفوعات معلقة" to="/payments">
          {pendingPayments.length === 0 ? (
            <EmptyState
              icon={Wallet}
              title="لا توجد مستحقات"
              description="كل المدفوعات محصّلة."
              actionLabel="دفعة جديدة"
              to="/payments"
            />
          ) : (
            <div className="space-y-2">
              {pendingPayments
                .filter((p: any) => p?.id)
                .map((p: any) => {
                  const overdue =
                    p.due_date && differenceInDays(new Date(), new Date(p.due_date)) > 0;
                  return (
                    <div
                      key={p?.id}
                      className={`flex flex-col gap-2 p-3 rounded-xl border sm:flex-row sm:items-center sm:gap-3 ${overdue ? "bg-rose-500/5 border-rose-500/30" : "bg-card/60 border-border"}`}
                    >
                      <AlertCircle
                        className={`w-5 h-5 shrink-0 ${overdue ? "text-rose-300" : "text-amber-300"}`}
                      />
                      <div className="flex-1 min-w-0">
                        {p.cases?.clients?.id ? (
                          <Link
                            to="/clients/$id"
                            params={{ id: p.cases.clients.id }}
                            className="font-semibold text-sm truncate block hover:text-[var(--gold)]"
                          >
                            {p.cases.clients.full_name}
                          </Link>
                        ) : (
                          <div className="font-semibold text-sm truncate">
                            {p.cases?.clients?.full_name ?? "—"}
                          </div>
                        )}
                        <div className="text-[11px] text-muted-foreground truncate">
                          {p.cases?.id ? (
                            <Link
                              to="/cases/$id"
                              params={{ id: p.cases.id }}
                              className="hover:text-[var(--gold)]"
                            >
                              {p.cases?.case_number ?? ""}
                            </Link>
                          ) : (
                            (p.cases?.case_number ?? "")
                          )}{" "}
                          {p.due_date && `· ${format(new Date(p.due_date), "yyyy/MM/dd")}`}
                        </div>
                      </div>
                      <div className="self-end text-sm font-bold gold-text sm:self-auto sm:shrink-0">
                        {Number(p.amount).toLocaleString()}{" "}
                        <span className="text-[10px] opacity-70">ج.م</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  to,
  children,
  tone,
  icon,
}: {
  title: string;
  to: string;
  children: React.ReactNode;
  tone?: "rose";
  icon?: React.ReactNode;
}) {
  return (
    <div className={`glass-card p-3 sm:p-4 ${tone === "rose" ? "border-rose-500/30" : ""}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="min-w-0 text-base font-bold flex items-center gap-2">
          {icon}
          {title}
        </h2>
        <Link to={to} className="text-xs text-[var(--gold)] flex items-center gap-1">
          عرض الكل <ChevronLeft className="w-3 h-3" />
        </Link>
      </div>
      {children}
    </div>
  );
}
