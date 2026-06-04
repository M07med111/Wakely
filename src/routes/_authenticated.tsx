import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/sidebar";
import { AIAssistant } from "@/components/ai-assistant";
import { MultiFab } from "@/components/multi-fab";
import { supabase } from "@/integrations/supabase/client";
import { useSessionTimeout } from "@/hooks/use-session-timeout";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/login" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  useSessionTimeout();
  if (loading || !user) return <div className="p-10 text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar userEmail={user?.email} />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 px-4 py-4 md:p-10 overflow-x-hidden pb-28 md:pb-10">
          <Outlet />
        </main>
      </div>
      <MultiFab />
      <AIAssistant />
    </div>
  );
}
