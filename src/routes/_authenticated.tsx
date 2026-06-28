import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useCurrentUserName } from "@/hooks/use-current-profile";
import { Sidebar } from "@/components/sidebar";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { DefaultPending } from "@/components/default-pending";

const AIAssistant = lazy(() =>
  import("@/components/ai-assistant").then((module) => ({ default: module.AIAssistant })),
);
const MultiFab = lazy(() =>
  import("@/components/multi-fab").then((module) => ({ default: module.MultiFab })),
);

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const userName = useCurrentUserName(user);
  const navigate = useNavigate();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isAdminDashboard = path.startsWith("/admin/");
  useSessionTimeout();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/login", replace: true });
    }
  }, [loading, navigate, user]);

  if (loading || !user) return <DefaultPending />;

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden lg:flex-row">
      <Sidebar
        userEmail={user?.email}
        userName={userName}
        mode={isAdminDashboard ? "admin" : "app"}
      />
      <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <main className="main-shell-scroll flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 pb-28 sm:px-4 md:px-6 lg:p-10 lg:pb-10">
          <Outlet />
        </main>
      </div>
      {!isAdminDashboard && (
        <Suspense fallback={null}>
          <MultiFab />
          <AIAssistant />
        </Suspense>
      )}
    </div>
  );
}
