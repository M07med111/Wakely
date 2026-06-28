import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const MAX_PAYLOAD_BYTES = 20_000;
const ROLES = ["admin", "staff", "client"] as const;
const DETAIL_TABLES = [
  "clients",
  "cases",
  "sessions",
  "payments",
  "payment_installments",
  "documents",
  "case_activities",
  "backups",
  "ai_chats",
  "ai_messages",
] as const;

const CORS_HEADERS = {
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ListSchema = z.object({
  action: z.literal("list"),
  search: z.string().max(120).optional().default(""),
});

const DetailsSchema = z.object({
  action: z.literal("details"),
  user_id: z.string().uuid(),
});

const CreateSchema = z.object({
  action: z.literal("create"),
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase()),
  password: z.string().min(6).max(128),
  full_name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).default("staff"),
  email_confirm: z.boolean().default(true),
});

const UpdateSchema = z.object({
  action: z.literal("update"),
  user_id: z.string().uuid(),
  email: z
    .string()
    .email()
    .transform((value) => value.trim().toLowerCase())
    .optional(),
  password: z.string().min(6).max(128).optional(),
  full_name: z.string().trim().min(1).max(120).optional(),
  role: z.enum(ROLES).optional(),
});

const BanSchema = z.object({
  action: z.literal("ban"),
  user_id: z.string().uuid(),
  duration: z.string().trim().min(1).max(40).default("876000h"),
});

const UnbanSchema = z.object({
  action: z.literal("unban"),
  user_id: z.string().uuid(),
});

const DeleteSchema = z.object({
  action: z.literal("delete"),
  user_id: z.string().uuid(),
});

const RequestSchema = z.discriminatedUnion("action", [
  ListSchema,
  DetailsSchema,
  CreateSchema,
  UpdateSchema,
  BanSchema,
  UnbanSchema,
  DeleteSchema,
]);

class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function allowedOrigins() {
  return (Deno.env.get("ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function configuredAdminEmails() {
  return [
    Deno.env.get("ADMIN_EMAIL"),
    Deno.env.get("ADMIN_EMAILS"),
    Deno.env.get("VITE_ADMIN_EMAIL"),
    Deno.env.get("VITE_ADMIN_EMAILS"),
  ]
    .filter(Boolean)
    .flatMap((value) => value!.split(","))
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isOriginAllowed(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = allowedOrigins();
  return allowed.length === 0 || !origin || allowed.includes(origin);
}

function corsHeadersFor(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = allowedOrigins();
  const allowOrigin =
    allowed.length === 0 ? "*" : origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    ...CORS_HEADERS,
    "Access-Control-Allow-Origin": allowOrigin,
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeadersFor(req), "Content-Type": "application/json" },
  });
}

function ensureEnv(name: string, fallback?: string | null) {
  const value = Deno.env.get(name) ?? fallback;
  if (!value) throw new ApiError(500, `${name} غير مضبوط في بيئة Supabase`);
  return value;
}

function normalizeRoles(user: any, databaseRoles: string[]) {
  const appRole = user?.app_metadata?.role;
  const roles = new Set<string>();
  if (ROLES.includes(appRole)) roles.add(appRole);
  databaseRoles.forEach((role) => {
    if (ROLES.includes(role as (typeof ROLES)[number])) roles.add(role);
  });
  if (roles.size === 0) roles.add("client");
  return Array.from(roles);
}

function serializeUser(user: any, profile: any, databaseRoles: string[]) {
  const roles = normalizeRoles(user, databaseRoles);
  const fullName = profile?.full_name ?? user?.user_metadata?.full_name ?? null;
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    full_name: fullName,
    role: roles[0] ?? "client",
    roles,
    created_at: user.created_at ?? null,
    updated_at: user.updated_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
    confirmed_at: user.confirmed_at ?? null,
    email_confirmed_at: user.email_confirmed_at ?? null,
    phone_confirmed_at: user.phone_confirmed_at ?? null,
    invited_at: user.invited_at ?? null,
    banned_until: user.banned_until ?? null,
    aud: user.aud ?? null,
    providers: (user.identities ?? []).map((identity: any) => identity.provider).filter(Boolean),
    app_metadata: user.app_metadata ?? {},
    user_metadata: user.user_metadata ?? {},
    profile: profile ?? null,
  };
}

async function requireAdmin(req: Request, userClient: any, adminClient: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "غير مصرح: يجب تسجيل الدخول");
  }

  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) throw new ApiError(401, "غير مصرح: جلسة غير صالحة");

  const currentUser = data.user;
  const adminEmails = configuredAdminEmails();
  const isConfiguredEmail =
    currentUser.email && adminEmails.includes(currentUser.email.trim().toLowerCase());

  const { data: roles, error: rolesError } = await adminClient
    .from("user_roles")
    .select("role")
    .eq("user_id", currentUser.id);
  if (rolesError) throw rolesError;

  const isAdmin =
    isConfiguredEmail ||
    currentUser.app_metadata?.role === "admin" ||
    (roles ?? []).some((role: any) => role.role === "admin");

  if (!isAdmin) throw new ApiError(403, "صلاحية مسؤول مطلوبة");

  if (isConfiguredEmail && !(roles ?? []).some((role: any) => role.role === "admin")) {
    await adminClient
      .from("user_roles")
      .upsert({ user_id: currentUser.id, role: "admin" }, { onConflict: "user_id,role" });
  }

  return currentUser;
}

async function replaceRole(adminClient: any, userId: string, role: (typeof ROLES)[number]) {
  await adminClient.from("user_roles").delete().eq("user_id", userId);
  const { error } = await adminClient.from("user_roles").insert({ user_id: userId, role });
  if (error) throw error;
}

async function profilesById(adminClient: any, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, any>();
  const { data, error } = await adminClient
    .from("profiles")
    .select("id, full_name, avatar_url, created_at")
    .in("id", userIds);
  if (error) throw error;
  return new Map((data ?? []).map((profile: any) => [profile.id, profile]));
}

async function rolesById(adminClient: any, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string[]>();
  const { data, error } = await adminClient
    .from("user_roles")
    .select("user_id, role")
    .in("user_id", userIds);
  if (error) throw error;
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = map.get(row.user_id) ?? [];
    list.push(row.role);
    map.set(row.user_id, list);
  }
  return map;
}

async function userDetails(adminClient: any, userId: string) {
  const [{ data: authData, error: authError }, profileMap, roleMap] = await Promise.all([
    adminClient.auth.admin.getUserById(userId),
    profilesById(adminClient, [userId]),
    rolesById(adminClient, [userId]),
  ]);
  if (authError) throw authError;
  if (!authData?.user) throw new ApiError(404, "المستخدم غير موجود");

  const counts: Record<string, number> = {};
  await Promise.all(
    DETAIL_TABLES.map(async (table) => {
      const { count, error } = await adminClient
        .from(table)
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId);
      counts[table] = error ? 0 : (count ?? 0);
    }),
  );

  return {
    user: serializeUser(authData.user, profileMap.get(userId), roleMap.get(userId) ?? []),
    counts,
  };
}

async function listUsers(adminClient: any, search: string) {
  const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;

  const users = data?.users ?? [];
  const userIds = users.map((user: any) => user.id);
  const [profileMap, roleMap] = await Promise.all([
    profilesById(adminClient, userIds),
    rolesById(adminClient, userIds),
  ]);

  const normalizedSearch = search.trim().toLowerCase();
  const serialized = users
    .map((user: any) => serializeUser(user, profileMap.get(user.id), roleMap.get(user.id) ?? []))
    .filter((user: any) => {
      if (!normalizedSearch) return true;
      return [user.email, user.full_name, user.id, user.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    })
    .sort((a: any, b: any) => {
      const left = new Date(a.created_at ?? 0).getTime();
      const right = new Date(b.created_at ?? 0).getTime();
      return right - left;
    });

  return { users: serialized };
}

function protectSelf(currentUser: any, targetUserId: string, action: string, nextRole?: string) {
  if (currentUser.id !== targetUserId) return;
  if (action === "delete") throw new ApiError(400, "لا يمكن حذف حسابك الحالي");
  if (action === "ban") throw new ApiError(400, "لا يمكن حظر حسابك الحالي");
  if (nextRole && nextRole !== "admin")
    throw new ApiError(400, "لا يمكن إزالة صلاحية الأدمن من حسابك الحالي");
}

serve(async (req) => {
  const corsHeaders = corsHeadersFor(req);
  if (!isOriginAllowed(req)) return json(req, { error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = ensureEnv("SUPABASE_URL");
    const supabaseAnonKey = ensureEnv(
      "SUPABASE_ANON_KEY",
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY"),
    );
    const serviceKey = ensureEnv("SUPABASE_SERVICE_ROLE_KEY", Deno.env.get("SUPABASE_SECRET_KEY"));

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const currentUser = await requireAdmin(req, userClient, adminClient);
    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      throw new ApiError(413, "حجم الطلب يتجاوز الحد المسموح");
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      throw new ApiError(400, "JSON غير صالح");
    }

    const parsed = RequestSchema.safeParse(parsedBody);
    if (!parsed.success)
      return json(req, { error: "طلب غير صالح", details: parsed.error.issues }, 400);

    const body = parsed.data;
    if (body.action === "list") return json(req, await listUsers(adminClient, body.search));
    if (body.action === "details") return json(req, await userDetails(adminClient, body.user_id));

    if (body.action === "create") {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: body.email_confirm,
        user_metadata: { full_name: body.full_name ?? body.email },
        app_metadata: { role: body.role },
      });
      if (error) throw error;
      if (!data?.user) throw new ApiError(500, "لم يتم إنشاء المستخدم");

      await adminClient.from("profiles").upsert({
        id: data.user.id,
        full_name: body.full_name ?? body.email,
      });
      await replaceRole(adminClient, data.user.id, body.role);
      return json(req, await userDetails(adminClient, data.user.id), 201);
    }

    if (body.action === "update") {
      protectSelf(currentUser, body.user_id, body.action, body.role);
      const attributes: Record<string, unknown> = {};
      let currentTargetUser: any = null;
      if (body.full_name || body.role) {
        const { data, error } = await adminClient.auth.admin.getUserById(body.user_id);
        if (error) throw error;
        currentTargetUser = data?.user ?? null;
      }
      if (body.email) attributes.email = body.email;
      if (body.password) attributes.password = body.password;
      if (body.full_name) {
        attributes.user_metadata = {
          ...(currentTargetUser?.user_metadata ?? {}),
          full_name: body.full_name,
        };
      }
      if (body.role) {
        attributes.app_metadata = {
          ...(currentTargetUser?.app_metadata ?? {}),
          role: body.role,
        };
      }

      if (Object.keys(attributes).length > 0) {
        const { error } = await adminClient.auth.admin.updateUserById(body.user_id, attributes);
        if (error) throw error;
      }
      if (body.full_name) {
        const { error } = await adminClient
          .from("profiles")
          .upsert({ id: body.user_id, full_name: body.full_name });
        if (error) throw error;
      }
      if (body.role) await replaceRole(adminClient, body.user_id, body.role);
      return json(req, await userDetails(adminClient, body.user_id));
    }

    if (body.action === "ban") {
      protectSelf(currentUser, body.user_id, body.action);
      const { error } = await adminClient.auth.admin.updateUserById(body.user_id, {
        ban_duration: body.duration,
      });
      if (error) throw error;
      return json(req, await userDetails(adminClient, body.user_id));
    }

    if (body.action === "unban") {
      const { error } = await adminClient.auth.admin.updateUserById(body.user_id, {
        ban_duration: "none",
      });
      if (error) throw error;
      return json(req, await userDetails(adminClient, body.user_id));
    }

    if (body.action === "delete") {
      protectSelf(currentUser, body.user_id, body.action);
      await adminClient.from("user_roles").delete().eq("user_id", body.user_id);
      const { error } = await adminClient.auth.admin.deleteUser(body.user_id);
      if (error) throw error;
      return json(req, { ok: true });
    }

    return json(req, { error: "إجراء غير معروف" }, 400);
  } catch (error) {
    console.error("user-admin error:", error);
    if (error instanceof ApiError) return json(req, { error: error.message }, error.status);
    return json(req, { error: error instanceof Error ? error.message : "خطأ غير متوقع" }, 500);
  }
});
