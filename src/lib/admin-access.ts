import type { AppRole } from "@/hooks/use-role";

function splitEmails(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function configuredAdminEmails() {
  return Array.from(
    new Set([
      ...splitEmails(import.meta.env.VITE_ADMIN_EMAIL),
      ...splitEmails(import.meta.env.VITE_ADMIN_EMAILS),
    ]),
  );
}

export function isConfiguredAdminEmail(email?: string | null) {
  if (!email) return false;
  return configuredAdminEmails().includes(email.trim().toLowerCase());
}

export function rolesWithConfiguredAdmin(email: string | null | undefined, roles: AppRole[]) {
  if (!isConfiguredAdminEmail(email)) return roles;
  return Array.from(new Set<AppRole>(["admin", ...roles]));
}
