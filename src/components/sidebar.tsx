import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarDays,
  Wallet,
  LogOut,
  Scale,
  Search,
  BarChart3,
  Menu,
  X,
  Database,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { CommandPalette } from "@/components/command-palette";
import { NotificationBell } from "@/components/notification-center";
import { useRoles } from "@/hooks/use-role";

const items = [
  { to: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { to: "/clients", label: "الموكلون", icon: Users },
  { to: "/cases", label: "القضايا", icon: Briefcase },
  { to: "/sessions", label: "الجلسات", icon: CalendarDays },
  { to: "/payments", label: "المدفوعات", icon: Wallet },
  { to: "/analytics", label: "التحليلات", icon: BarChart3 },
];

const adminItems = [{ to: "/backups", label: "النسخ الاحتياطي", icon: Database }];

// Mobile bottom nav: pick 5 most-used
const mobileItems = items.slice(0, 5);

function BrandMark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dim = size === "sm" ? "w-9 h-9" : size === "lg" ? "w-12 h-12" : "w-10 h-10";
  return (
    <div className={`grid place-items-center ${dim} rounded-xl btn-gold shrink-0`}>
      <Scale className={size === "lg" ? "w-6 h-6" : "w-5 h-5"} />
    </div>
  );
}

export function BrandHeader({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark />
      <div className="min-w-0">
        <div className="font-display gold-text font-bold text-base leading-tight truncate">
          منصة المكتب القانوني
        </div>
        {!compact && (
          <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
            للمحاماة والاستشارات القانونية
          </div>
        )}
      </div>
    </div>
  );
}

export function Sidebar({ userEmail }: { userEmail?: string | null }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  const { isAdmin } = useRoles();
  const navItems = isAdmin ? [...items, ...adminItems] : items;

  const NavList = (
    <nav className="space-y-1">
      {navItems.map((it) => {
        const active = path === it.to || path.startsWith(it.to + "/");
        return (
          <Link
            key={it.to}
            to={it.to}
            onClick={() => setMobileOpen(false)}
            className={`nav-link ${active ? "active" : ""}`}
          >
            <it.icon className="w-4 h-4" />
            <span className="text-sm">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-sidebar border-l border-border min-h-screen p-4 sticky top-0">
        <BrandHeader />
        <div className="mt-6">{NavList}</div>
        <div className="mt-auto pt-4 border-t border-border">
          <div className="text-xs text-muted-foreground px-2 truncate">{userEmail}</div>
          <button onClick={logout} className="nav-link w-full mt-2 text-right">
            <LogOut className="w-4 h-4" />
            <span className="text-sm">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="إغلاق"
          />
          <aside className="relative w-72 bg-sidebar border-l border-border h-full p-4 flex flex-col animate-in slide-in-from-right">
            <div className="flex items-center justify-between">
              <BrandHeader />
              <button onClick={() => setMobileOpen(false)} className="p-2">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-6">{NavList}</div>
            <div className="mt-auto pt-4 border-t border-border">
              <div className="text-xs text-muted-foreground px-2 truncate">{userEmail}</div>
              <button onClick={logout} className="nav-link w-full mt-2 text-right">
                <LogOut className="w-4 h-4" />
                <span className="text-sm">تسجيل الخروج</span>
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Mobile top header */}
      <header className="md:hidden sticky top-0 z-30 bg-[oklch(0.16_0.01_70/85%)] backdrop-blur-md border-b border-border px-3 py-2.5 flex items-center gap-2">
        <button
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md hover:bg-card"
          aria-label="القائمة"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <BrandHeader compact />
        </div>
        <NotificationBell />
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[oklch(0.14_0.01_70/95%)] backdrop-blur-xl border-t border-border safe-bottom">
        <div className="flex items-stretch px-1">
          {mobileItems.map((it) => {
            const active = path === it.to || path.startsWith(it.to + "/");
            return (
              <Link key={it.to} to={it.to} className={`mobile-nav-item ${active ? "active" : ""}`}>
                <span className="mn-icon">
                  <it.icon className="w-5 h-5" />
                </span>
                <span>{it.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}

export function TopBar({ children }: { children?: React.ReactNode }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex items-center gap-2 mb-6">
      <button
        onClick={() => setPaletteOpen(true)}
        className="relative flex-1 text-right group"
        aria-label="بحث سريع"
      >
        <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <div className="w-full bg-card border border-border rounded-xl pr-10 pl-3 py-2.5 text-sm text-muted-foreground group-hover:border-[var(--gold)] transition-colors flex items-center justify-between">
          <span>بحث سريع عن موكل أو قضية...</span>
          <kbd className="hidden md:inline text-[10px] text-muted-foreground/70 border border-border rounded px-1.5 py-0.5">
            Ctrl K
          </kbd>
        </div>
      </button>
      <NotificationBell />
      {children}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
