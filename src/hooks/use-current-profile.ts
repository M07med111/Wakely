import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

function metadataDisplayName(user?: User | null) {
  const metadata = user?.user_metadata as Record<string, unknown> | undefined;
  const rawName = metadata?.full_name ?? metadata?.display_name ?? metadata?.name;
  return typeof rawName === "string" ? rawName.trim() : "";
}

export function getUserDisplayName(user?: User | null) {
  const metadataName = metadataDisplayName(user);
  if (metadataName) return metadataName;

  const emailName = user?.email?.split("@")[0]?.trim();
  return emailName || "";
}

export function useCurrentUserName(user?: User | null) {
  const fallbackName = getUserDisplayName(user);

  const { data: profileName } = useQuery({
    queryKey: ["current-user-profile-name", user?.id],
    enabled: !!user?.id,
    retry: false,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        if (error.code === "PGRST205" || error.code === "42P01") return null;
        throw error;
      }

      return data?.full_name?.trim() || null;
    },
  });

  return profileName || fallbackName;
}
