import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export type AppRole = "admin" | "staff" | "client";

export function useRoles() {
  const { user } = useAuth();
  const { data: roles = [] } = useQuery({
    queryKey: ["user-roles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const metadataRole = user.app_metadata?.role as AppRole | undefined;
      const metadataRoles: AppRole[] = metadataRole ? [metadataRole] : [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") return metadataRoles;
        throw error;
      }
      return Array.from(
        new Set([...metadataRoles, ...(data ?? []).map((r: any) => r.role as AppRole)]),
      );
    },
  });
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("staff"),
    hasRole: (r: AppRole) => roles.includes(r),
  };
}
