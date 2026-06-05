// Shared status badge with semantic colors:
// green = closed/paid, yellow = active (متداولة), red = urgent/overdue, partial = blue
type Variant = "active" | "pending" | "closed" | "paid" | "overdue" | "urgent" | "partial";

const map: Record<Variant, { cls: string; label: string }> = {
  active: { cls: "bg-amber-500/15 text-amber-300 border-amber-500/30", label: "متداولة" },
  pending: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "منتهية" },
  closed: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "منتهية" },
  paid: { cls: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30", label: "مدفوعة" },
  partial: { cls: "bg-sky-500/15 text-sky-300 border-sky-500/30", label: "دفع جزئي" },
  overdue: { cls: "bg-rose-500/15 text-rose-300 border-rose-500/30", label: "متأخرة" },
  urgent: {
    cls: "bg-rose-500/20 text-rose-200 border-rose-500/40 animate-pulse",
    label: "جلسة قريبة",
  },
};

export function StatusBadge({ status, label }: { status: Variant | string; label?: string }) {
  const m = map[status as Variant] ?? map.active;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${m.cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {label ?? m.label}
    </span>
  );
}
