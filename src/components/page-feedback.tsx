import { Link } from "@tanstack/react-router";
import { AlertTriangle, Home, RefreshCw, ShieldAlert, type LucideIcon } from "lucide-react";

function isPermissionError(message?: string) {
  const text = (message ?? "").toLowerCase();
  return (
    text.includes("permission denied") ||
    text.includes("row-level security") ||
    text.includes("rls") ||
    text.includes("not authorized")
  );
}

function errorCopy(message?: string) {
  if (isPermissionError(message)) {
    return {
      icon: ShieldAlert,
      title: "تعذر الوصول للبيانات",
      description: "الصلاحيات لم تكتمل على قاعدة البيانات أو لا تسمح لهذا الحساب بقراءة هذه الصفحة.",
    };
  }

  return {
    icon: AlertTriangle,
    title: "تعذر تحميل البيانات",
    description: "حدث خطأ أثناء تحميل الصفحة. جرّب التحديث، وإذا استمرت المشكلة راجع الاتصال.",
  };
}

export function PageError({
  message,
  title,
  description,
  icon,
}: {
  message?: string;
  title?: string;
  description?: string;
  icon?: LucideIcon;
}) {
  const copy = errorCopy(message);
  const Icon = icon ?? copy.icon;

  return (
    <div className="min-h-[52vh] grid place-items-center px-3">
      <div className="glass-card w-full max-w-xl p-6 md:p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/10 text-[var(--gold)]">
          <Icon className="h-7 w-7" />
        </div>
        <h2 className="text-xl md:text-2xl font-bold">{title ?? copy.title}</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-muted-foreground">
          {description ?? copy.description}
        </p>

        {message && (
          <div className="mt-5 rounded-lg border border-border bg-black/15 px-3 py-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">تفاصيل:</span> {message}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-gold inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
          >
            <RefreshCw className="h-4 w-4" />
            تحديث الصفحة
          </button>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            <Home className="h-4 w-4" />
            الرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

export function PageLoading({ label = "جارٍ تحميل البيانات..." }: { label?: string }) {
  return (
    <div className="min-h-[45vh] grid place-items-center px-3">
      <div className="glass-card w-full max-w-sm p-6 text-center">
        <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-[var(--gold)]/25 border-t-[var(--gold)]" />
        <p className="mt-4 text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
