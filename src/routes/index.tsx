import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Scale, Shield, Briefcase, CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen">
      <header className="container mx-auto flex items-center justify-between gap-3 px-4 md:px-6 py-5">
        <div className="flex items-center gap-3 min-w-0">
          <div className="grid place-items-center w-10 h-10 rounded-xl btn-gold shrink-0">
            <Scale className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="font-display gold-text font-bold text-sm md:text-base leading-tight truncate">
              المستشار محسن عياده
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              للمحاماة والاستشارات القانونية
            </div>
          </div>
        </div>
        <Link to="/login" className="btn-gold px-4 md:px-5 py-2 rounded-xl font-semibold text-sm shrink-0">
          دخول
        </Link>
      </header>

      <main className="container mx-auto px-4 md:px-6 pt-10 md:pt-16 pb-20 text-center">
        <span className="inline-block px-3 py-1 rounded-full text-xs border border-[var(--gold)]/30 text-[var(--gold)]">
          منصّة المحامين الاحترافية
        </span>
        <h1 className="mt-6 text-3xl md:text-6xl font-bold leading-tight">
          نظام إدارة <span className="gold-text">القضايا والمكاتب القانونية</span>
          <br className="hidden md:block" /> للمستشار محسن عياده
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-base md:text-lg text-muted-foreground px-2">
          منصّة متكاملة وأنيقة لإدارة الموكلين، القضايا، الجلسات، المستندات والمدفوعات —
          مصمّمة لتعمل بكفاءة على هاتفك ومكتبك.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link to="/login" className="btn-gold px-6 md:px-7 py-3 rounded-xl font-semibold">
            ابدأ الآن
          </Link>
        </div>

        <div className="mt-16 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5 text-right">
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
