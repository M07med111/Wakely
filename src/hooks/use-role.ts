import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { rolesWithConfiguredAdmin } from "@/lib/admin-access";

export type AppRole = "admin" | "staff" | "client";

export function useRoles() {
  const { user } = useAuth();
  const metadataRole = user?.app_metadata?.role as AppRole | undefined;
  const metadataRoles: AppRole[] = metadataRole ? [metadataRole] : [];
  const { data: databaseRoles = [], isLoading } = useQuery({
    queryKey: ["user-roles", user?.id, user?.email],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") return metadataRoles;
        throw error;
      }
      return (data ?? []).map((r: any) => r.role as AppRole);
    },
  });
  const roles = rolesWithConfiguredAdmin(user?.email, [...metadataRoles, ...databaseRoles]);
  return {
    roles,
    isAdmin: roles.includes("admin"),
    isStaff: roles.includes("staff"),
    isLoading,
    hasRole: (r: AppRole) => roles.includes(r),
  };
}
