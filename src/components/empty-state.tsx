import { Link } from "@tanstack/react-router";
import { Plus, type LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  to,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  to?: string;
}) {
  const Btn = (
    <span className="btn-gold inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold">
      <Plus className="w-4 h-4" /> {actionLabel}
    </span>
  );
  return (
    <div className="glass-card p-10 text-center flex flex-col items-center">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--gold)]/20 to-transparent grid place-items-center mb-4 border border-[var(--gold)]/20">
        <Icon className="w-8 h-8 text-[var(--gold)]" />
      </div>
      <h3 className="font-bold text-base">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-xs">{description}</p>}
      {actionLabel && (to ? (
        <Link to={to} className="mt-5">{Btn}</Link>
      ) : (
        <button onClick={onAction} className="mt-5">{Btn}</button>
      ))}
    </div>
  );
}
