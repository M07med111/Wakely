import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/use-role";

export type ManagedUser = {
  id: string;
  email: string | null;
  phone: string | null;
  full_name: string | null;
  role: AppRole;
  roles: AppRole[];
  created_at: string | null;
  updated_at: string | null;
  last_sign_in_at: string | null;
  confirmed_at: string | null;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  invited_at: string | null;
  banned_until: string | null;
  aud: string | null;
  providers: string[];
  app_metadata: Record<string, unknown>;
  user_metadata: Record<string, unknown>;
  profile: Record<string, unknown> | null;
};

export type UserDetails = {
  user: ManagedUser;
  counts: Record<string, number>;
};

type UserAdminResponse<T> = T & { error?: string; details?: unknown };

async function invokeUserAdmin<T>(body: Record<string, unknown>) {
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  const { data, error } = await supabase.functions.invoke<UserAdminResponse<T>>("user-admin", {
    body,
    headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
  });

  if (error) throw new Error(error.message);
  if (data?.error) throw new Error(data.error);
  if (!data) throw new Error("لم يصل رد من خادم إدارة المستخدمين");
  return data as T;
}

export function listManagedUsers(search: string) {
  return invokeUserAdmin<{ users: ManagedUser[] }>({ action: "list", search });
}

export function getManagedUserDetails(userId: string) {
  return invokeUserAdmin<UserDetails>({ action: "details", user_id: userId });
}

export function createManagedUser(payload: {
  email: string;
  password: string;
  full_name?: string;
  role: AppRole;
  email_confirm: boolean;
}) {
  return invokeUserAdmin<UserDetails>({ action: "create", ...payload });
}

export function updateManagedUser(payload: {
  user_id: string;
  email?: string;
  password?: string;
  full_name?: string;
  role?: AppRole;
}) {
  return invokeUserAdmin<UserDetails>({ action: "update", ...payload });
}

export function banManagedUser(userId: string) {
  return invokeUserAdmin<UserDetails>({ action: "ban", user_id: userId });
}

export function unbanManagedUser(userId: string) {
  return invokeUserAdmin<UserDetails>({ action: "unban", user_id: userId });
}

export function deleteManagedUser(userId: string) {
  return invokeUserAdmin<{ ok: boolean }>({ action: "delete", user_id: userId });
}
