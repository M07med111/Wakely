import { createFileRoute, Link } from "@tanstack/react-router";
import { Scale, Shield, Briefcase, CalendarClock } from "lucide-react";
import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserName } from "@/hooks/use-current-profile";
import { Sidebar } from "@/components/sidebar";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { DashboardHome } from "@/routes/_authenticated/dashboard";
import { PageLoading } from "@/components/page-feedback";

const AIAssistant = lazy(() =>
  import("@/components/ai-assistant").then((module) => ({ default: module.AIAssistant })),
);
const MultiFab = lazy(() =>
  import("@/components/multi-fab").then((module) => ({ default: module.MultiFab })),
);

export const Route = createFileRoute("/")({
  ssr: false,
  component: Home,
});

function Home() {
  const { user, loading } = useAuth();
  if (loading) return <PageLoading />;
  if (user) return <AuthenticatedHome user={user} />;
  return <Landing />;
}

function AuthenticatedHome({ user }: { user: NonNullable<ReturnType<typeof useAuth>["user"]> }) {
  useSessionTimeout();
  const userName = useCurrentUserName(user);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden lg:flex-row">
      <Sidebar userEmail={user.email} userName={userName} />
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <main className="main-shell-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 pb-28 sm:px-4 md:px-6 lg:p-10 lg:pb-10">
          <DashboardHome userName={userName} />
        </main>
      </div>
      <Suspense fallback={null}>
        <MultiFab />
        <AIAssistant />
      </Suspense>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 overflow-hidden px-4 py-5 md:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-10 h-10 rounded-xl btn-gold shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display gold-text font-bold text-sm md:text-base leading-tight truncate">
              منصة المكتب القانوني
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              للمحاماة والاستشارات القانونية
            </div>
          </div>
        </div>
        <Link
          to="/login"
          className="btn-gold px-4 md:px-5 py-2 rounded-xl font-semibold text-sm shrink-0"
        >
          دخول
        </Link>
      </header>

      <main className="mx-auto w-full max-w-7xl overflow-hidden px-4 pt-10 pb-20 text-center md:px-6 md:pt-16">
        <span className="inline-block px-3 py-1 rounded-full text-xs border border-[var(--gold)]/30 text-[var(--gold)]">
          منصّة المحامين الاحترافية
        </span>
        <h1 className="mx-auto mt-6 max-w-5xl text-xl font-bold leading-tight sm:text-4xl lg:text-6xl">
          <span className="block">نظام إدارة</span>
          <span className="gold-text block">القضايا والمكاتب القانونية</span>
          <span className="block">للمحامين والمكاتب القانونية</span>
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-base md:text-lg text-muted-foreground px-2">
          منصّة متكاملة وأنيقة لإدارة الموكلين، القضايا، الجلسات، المستندات والمدفوعات — مصمّمة
          لتعمل بكفاءة على هاتفك ومكتبك.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/login" className="btn-gold px-6 md:px-7 py-3 rounded-xl font-semibold">
            ابدأ الآن
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 text-right">
          {[
            { icon: Briefcase, t: "إدارة القضايا", d: "تتبّع كل قضية بتفاصيلها وحالتها." },
            { icon: CalendarClock, t: "جدول الجلسات", d: "تقويم تفاعلي بتذكيرات ذكية." },
            { icon: Shield, t: "أمان عالي", d: "بياناتك محميّة بأعلى المعايير." },
            { icon: Scale, t: "تقارير مالية", d: "متابعة الأتعاب والمدفوعات بسهولة." },
          ].map((f) => (
            <div key={f.t} className="glass-card p-4 md:p-6">
              <f.icon className="w-6 h-6 md:w-7 md:h-7 text-[var(--gold)]" />
              <h3 className="mt-3 font-bold text-sm md:text-lg">{f.t}</h3>
              <p className="mt-1 text-xs md:text-sm text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
