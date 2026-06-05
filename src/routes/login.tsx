import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Scale, Shield, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء الحساب! تحقق من بريدك الإلكتروني.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("مرحباً بعودتك");
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "حدث خطأ");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen relative overflow-hidden grid place-items-center px-4 py-10">
      {/* Decorative legal background */}
      <div aria-hidden className="absolute inset-0 opacity-40">
        <div className="absolute -top-32 -right-32 w-[480px] h-[480px] rounded-full bg-[var(--gold)]/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-32 w-[520px] h-[520px] rounded-full bg-[var(--gold)]/5 blur-3xl" />
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="oklch(0.78 0.13 80 / 8%)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      <div className="relative w-full max-w-5xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Brand panel */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          className="hidden lg:block text-right"
        >
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="grid place-items-center w-16 h-16 rounded-2xl btn-gold">
              <Scale className="w-8 h-8" />
            </div>
            <div>
              <h1 className="font-display text-3xl gold-text font-bold leading-tight">
                المستشار محسن عياده
              </h1>
              <p className="text-xs text-muted-foreground mt-1">للمحاماة والاستشارات القانونية</p>
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl font-display font-bold leading-snug">
            منصّة <span className="gold-text">احترافية</span> لإدارة مكتبك القانوني
          </h2>
          <p className="text-muted-foreground mt-4 leading-relaxed">
            تابع موكليك وقضاياك وجلساتك ومدفوعاتك من مكان واحد، مع مساعد ذكي للصياغة القانونية
            وتقارير تفصيلية.
          </p>
          <div className="mt-8 space-y-3">
            <Feature
              icon={Shield}
              title="حماية وخصوصية"
              desc="تشفير كامل للبيانات وصلاحيات دقيقة."
            />
            <Feature icon={Sparkles} title="مساعد ذكي" desc="تلخيص قضايا وصياغة مذكرات بضغطة زر." />
            <Feature
              icon={Scale}
              title="منظومة متكاملة"
              desc="موكلون، قضايا، جلسات، مدفوعات وتقارير."
            />
          </div>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card w-full max-w-md mx-auto p-8 lg:p-10"
        >
          <div className="flex flex-col items-center text-center lg:hidden">
            <div className="grid place-items-center w-14 h-14 rounded-xl btn-gold">
              <Scale className="w-7 h-7" />
            </div>
            <h1 className="mt-4 text-xl font-bold gold-text leading-tight">المستشار محسن عياده</h1>
            <p className="text-[11px] text-muted-foreground">للمحاماة والاستشارات القانونية</p>
          </div>

          <h2 className="text-xl font-bold text-center lg:text-right mt-4 lg:mt-0">
            {mode === "signin" ? "أهلاً بعودتك" : "إنشاء حساب جديد"}
          </h2>
          <p className="text-sm text-muted-foreground text-center lg:text-right mt-1">
            {mode === "signin" ? "سجّل الدخول للوصول إلى لوحة التحكم" : "أكمل البيانات للبدء"}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <Field label="الاسم الكامل">
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </Field>
            )}
            <Field label="البريد الإلكتروني">
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="كلمة المرور">
              <input
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </Field>

            <button
              disabled={loading}
              className="btn-gold w-full py-3 rounded-lg font-bold disabled:opacity-60"
            >
              {loading ? "..." : mode === "signin" ? "دخول إلى اللوحة" : "إنشاء حساب"}
            </button>
          </form>

          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-5 w-full text-sm text-muted-foreground hover:text-[var(--gold)]"
          >
            {mode === "signin" ? "ليس لديك حساب؟ أنشئ واحداً" : "لديك حساب؟ سجّل الدخول"}
          </button>
        </motion.div>
      </div>

      <style>{`.input{width:100%;background:var(--input);border:1px solid var(--border);border-radius:.6rem;padding:.75rem .9rem;color:var(--foreground);outline:none;transition:border-color .2s}.input:focus{border-color:var(--gold)}`}</style>
    </div>
  );
}

function Feature({ icon: Icon, title, desc }: any) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-card/40 border border-border">
      <div className="w-9 h-9 rounded-lg bg-[var(--gold)]/15 grid place-items-center text-[var(--gold)] shrink-0">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="font-semibold text-sm">{title}</div>
        <div className="text-[11px] text-muted-foreground">{desc}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}
