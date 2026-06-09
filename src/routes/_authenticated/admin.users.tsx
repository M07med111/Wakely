import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Ban,
  CheckCircle2,
  Copy,
  Eye,
  Fingerprint,
  Mail,
  RefreshCw,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCircle2,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { format } from "date-fns";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { PageError, PageLoading } from "@/components/page-feedback";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoles, type AppRole } from "@/hooks/use-role";
import {
  banManagedUser,
  createManagedUser,
  deleteManagedUser,
  getManagedUserDetails,
  listManagedUsers,
  type ManagedUser,
  unbanManagedUser,
  updateManagedUser,
} from "@/lib/user-admin";

export const Route = createFileRoute("/_authenticated/admin/users")({
  component: AdminUsersPage,
});

const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مسؤول",
  staff: "فريق العمل",
  client: "عميل",
};

const COUNT_LABELS: Record<string, string> = {
  clients: "الموكلون",
  cases: "القضايا",
  sessions: "الجلسات",
  payments: "المدفوعات",
  payment_installments: "الأقساط",
  documents: "المستندات",
  case_activities: "أنشطة القضايا",
  backups: "النسخ الاحتياطية",
  ai_chats: "محادثات المساعد",
  ai_messages: "رسائل المساعد",
};

const inputClass =
  "w-full bg-input border border-border rounded-md px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-[var(--gold)] disabled:opacity-60";

type CreateForm = {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
  email_confirm: boolean;
};

type EditForm = {
  email: string;
  password: string;
  full_name: string;
  role: AppRole;
};

function AdminUsersPage() {
  const qc = useQueryClient();
  const { isAdmin, isLoading: rolesLoading } = useRoles();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    email: "",
    password: "",
    full_name: "",
    role: "staff",
    email_confirm: true,
  });
  const [editForm, setEditForm] = useState<EditForm>({
    email: "",
    password: "",
    full_name: "",
    role: "staff",
  });

  const {
    data: listData,
    isLoading: usersLoading,
    error: usersError,
  } = useQuery({
    queryKey: ["managed-users", deferredSearch.trim()],
    enabled: isAdmin,
    queryFn: () => listManagedUsers(deferredSearch.trim()),
  });

  const users = useMemo(() => listData?.users ?? [], [listData?.users]);

  useEffect(() => {
    if (!users.length) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !users.some((user) => user.id === selectedId)) {
      setSelectedId(users[0].id);
    }
  }, [selectedId, users]);

  const {
    data: details,
    isLoading: detailsLoading,
    error: detailsError,
  } = useQuery({
    queryKey: ["managed-user-details", selectedId],
    enabled: isAdmin && !!selectedId,
    queryFn: () => getManagedUserDetails(selectedId!),
  });

  const detailUser = details?.user;

  useEffect(() => {
    const user = detailUser;
    if (!user) return;
    setEditForm({
      email: user.email ?? "",
      password: "",
      full_name: user.full_name ?? "",
      role: user.role,
    });
  }, [detailUser]);

  const stats = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        acc.total += 1;
        if (user.roles.includes("admin")) acc.admin += 1;
        else if (user.roles.includes("staff")) acc.staff += 1;
        else acc.client += 1;
        if (isBanned(user)) acc.banned += 1;
        return acc;
      },
      { total: 0, admin: 0, staff: 0, client: 0, banned: 0 },
    );
  }, [users]);

  const createMutation = useMutation({
    mutationFn: createManagedUser,
    onSuccess: (nextDetails) => {
      toast.success("تم إنشاء المستخدم");
      setCreateForm({ email: "", password: "", full_name: "", role: "staff", email_confirm: true });
      setCreateOpen(false);
      setSelectedId(nextDetails.user.id);
      qc.setQueryData(["managed-user-details", nextDetails.user.id], nextDetails);
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const updateMutation = useMutation({
    mutationFn: updateManagedUser,
    onSuccess: (nextDetails) => {
      toast.success("تم تحديث المستخدم");
      setEditForm((current) => ({ ...current, password: "" }));
      qc.setQueryData(["managed-user-details", nextDetails.user.id], nextDetails);
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const banMutation = useMutation({
    mutationFn: banManagedUser,
    onSuccess: (nextDetails) => {
      toast.success("تم حظر المستخدم");
      qc.setQueryData(["managed-user-details", nextDetails.user.id], nextDetails);
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unbanMutation = useMutation({
    mutationFn: unbanManagedUser,
    onSuccess: (nextDetails) => {
      toast.success("تم فك الحظر");
      qc.setQueryData(["managed-user-details", nextDetails.user.id], nextDetails);
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteManagedUser,
    onSuccess: () => {
      toast.success("تم حذف المستخدم");
      setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["managed-users"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (rolesLoading && !isAdmin) return <PageLoading />;

  if (!isAdmin) {
    return (
      <div>
        <div className="glass-card p-8 text-center max-w-md mx-auto mt-10">
          <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto mb-3" />
          <h2 className="text-xl font-bold mb-1">صلاحية مسؤول مطلوبة</h2>
          <p className="text-sm text-muted-foreground mb-4">
            إدارة المستخدمين متاحة لحسابات المسؤولين فقط.
          </p>
          <Link to="/" className="text-sm text-[var(--gold)] inline-flex items-center gap-1">
            <ArrowRight className="w-4 h-4" /> العودة للرئيسية
          </Link>
        </div>
      </div>
    );
  }

  const selectedUser = detailUser;
  const busy =
    createMutation.isPending ||
    updateMutation.isPending ||
    banMutation.isPending ||
    unbanMutation.isPending ||
    deleteMutation.isPending;

  function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({
      email: createForm.email,
      password: createForm.password,
      full_name: createForm.full_name || undefined,
      role: createForm.role,
      email_confirm: createForm.email_confirm,
    });
  }

  function submitUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedUser) return;
    updateMutation.mutate({
      user_id: selectedUser.id,
      email: editForm.email || undefined,
      password: editForm.password || undefined,
      full_name: editForm.full_name || undefined,
      role: editForm.role,
    });
  }

  function runDelete(user: ManagedUser) {
    const name = user.full_name || user.email || user.id;
    if (!window.confirm(`سيتم حذف "${name}" نهائياً. هل تريد المتابعة؟`)) return;
    deleteMutation.mutate(user.id);
  }

  async function copyUserId(userId: string) {
    await navigator.clipboard.writeText(userId);
    toast.success("تم نسخ المعرّف");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-2">
            <UsersRound className="w-7 h-7 text-[var(--gold)]" />
            إدارة المستخدمين
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            إضافة الحسابات والتحكم في صلاحيات الدخول إلى النظام.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <button className="btn-gold px-4 py-2.5 rounded-md font-bold inline-flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                إضافة مستخدم
              </button>
            </DialogTrigger>
            <DialogContent
              className="glass-card max-w-md border-border bg-card text-right"
              dir="rtl"
            >
              <DialogHeader className="text-right">
                <DialogTitle className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-[var(--gold)]" />
                  إضافة مستخدم جديد
                </DialogTitle>
              </DialogHeader>
              <CreateUserForm
                createForm={createForm}
                setCreateForm={setCreateForm}
                submitCreate={submitCreate}
                pending={createMutation.isPending}
              />
            </DialogContent>
          </Dialog>

          <button
            onClick={() => qc.invalidateQueries({ queryKey: ["managed-users"] })}
            disabled={usersLoading}
            className="px-3 py-2.5 rounded-md border border-border hover:border-[var(--gold)] text-sm inline-flex items-center gap-2 disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${usersLoading ? "animate-spin" : ""}`} />
            تحديث
          </button>
        </div>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="الإجمالي" value={stats.total} icon={UsersRound} />
        <StatCard label="مسؤولون" value={stats.admin} icon={ShieldCheck} tone="gold" />
        <StatCard label="فريق العمل" value={stats.staff} icon={UserCircle2} tone="sky" />
        <StatCard label="عملاء" value={stats.client} icon={Mail} tone="emerald" />
        <StatCard label="محظورون" value={stats.banned} icon={Ban} tone="rose" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <section className="glass-card min-w-0 p-4">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-bold">كل المستخدمين</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                اختيار المستخدم يفتح تفاصيله في اللوحة المجاورة.
              </p>
            </div>
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                className={`${inputClass} pr-9`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="بحث بالاسم أو البريد أو المعرّف"
              />
            </div>
          </div>

          {usersError ? (
            <PageError message={(usersError as Error).message} />
          ) : usersLoading ? (
            <UserListSkeleton />
          ) : users.length === 0 ? (
            <EmptyState
              icon={UsersRound}
              title="لا يوجد مستخدمون"
              description="أنشئ أول مستخدم للنظام من زر الإضافة أعلى الصفحة."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-muted-foreground border-b border-border">
                  <tr>
                    <th className="py-2 px-2 text-right font-medium">المستخدم</th>
                    <th className="py-2 px-2 text-right font-medium">الدور</th>
                    <th className="py-2 px-2 text-right font-medium">آخر دخول</th>
                    <th className="py-2 px-2 text-right font-medium">الحالة</th>
                    <th className="py-2 px-2 text-left font-medium">تحكم</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const selected = user.id === selectedId;
                    return (
                      <tr
                        key={user.id}
                        className={`border-b border-border/70 hover:bg-muted/30 ${selected ? "bg-[var(--gold)]/10" : ""}`}
                      >
                        <td className="py-3 px-2 min-w-64">
                          <button
                            onClick={() => setSelectedId(user.id)}
                            className="text-right flex items-center gap-3 min-w-0 w-full"
                          >
                            <AvatarName user={user} />
                          </button>
                        </td>
                        <td className="py-3 px-2">
                          <RoleBadge role={user.role} />
                        </td>
                        <td className="py-3 px-2 text-muted-foreground whitespace-nowrap">
                          {formatDate(user.last_sign_in_at)}
                        </td>
                        <td className="py-3 px-2">
                          <StatusBadge user={user} />
                        </td>
                        <td className="py-3 px-2">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => setSelectedId(user.id)}
                              className="p-2 rounded-md border border-border hover:border-[var(--gold)]"
                              title="عرض التفاصيل"
                              aria-label="عرض التفاصيل"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => copyUserId(user.id)}
                              className="p-2 rounded-md border border-border hover:border-[var(--gold)]"
                              title="نسخ المعرّف"
                              aria-label="نسخ المعرّف"
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="glass-card min-w-0 p-4">
          <div className="mb-4 flex items-center gap-2">
            <Fingerprint className="w-5 h-5 text-[var(--gold)]" />
            <h2 className="font-bold">تفاصيل المستخدم</h2>
          </div>

          {detailsError ? (
            <PageError message={(detailsError as Error).message} />
          ) : detailsLoading ? (
            <DetailsSkeleton />
          ) : !selectedUser ? (
            <EmptyState
              icon={UserCircle2}
              title="اختر مستخدماً"
              description="ستظهر التفاصيل والتحكم بعد اختيار مستخدم من القائمة."
            />
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between gap-3">
                <AvatarName user={selectedUser} large />
                <StatusBadge user={selectedUser} />
              </div>

              <Tabs defaultValue="edit" className="w-full">
                <TabsList className="grid h-auto w-full grid-cols-3">
                  <TabsTrigger value="edit">تعديل</TabsTrigger>
                  <TabsTrigger value="activity">بيانات</TabsTrigger>
                  <TabsTrigger value="metadata">تقني</TabsTrigger>
                </TabsList>

                <TabsContent value="edit" className="mt-4 space-y-4">
                  <form onSubmit={submitUpdate} className="space-y-3">
                    <Field label="الاسم">
                      <input
                        className={inputClass}
                        value={editForm.full_name}
                        onChange={(e) =>
                          setEditForm((current) => ({ ...current, full_name: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="البريد الإلكتروني">
                      <input
                        className={inputClass}
                        type="email"
                        value={editForm.email}
                        onChange={(e) =>
                          setEditForm((current) => ({ ...current, email: e.target.value }))
                        }
                      />
                    </Field>
                    <Field label="كلمة مرور جديدة">
                      <input
                        className={inputClass}
                        type="password"
                        minLength={6}
                        value={editForm.password}
                        onChange={(e) =>
                          setEditForm((current) => ({ ...current, password: e.target.value }))
                        }
                        placeholder="اتركها فارغة بدون تغيير"
                      />
                    </Field>
                    <Field label="الدور">
                      <RoleSelect
                        value={editForm.role}
                        onChange={(role) => setEditForm((current) => ({ ...current, role }))}
                      />
                    </Field>
                    <button
                      disabled={updateMutation.isPending}
                      className="btn-gold w-full py-2.5 rounded-md font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
                    >
                      <Save className="w-4 h-4" />
                      {updateMutation.isPending ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                    </button>
                  </form>

                  <div className="flex flex-wrap gap-2">
                    {isBanned(selectedUser) ? (
                      <button
                        disabled={busy}
                        onClick={() => unbanMutation.mutate(selectedUser.id)}
                        className="px-3 py-2 rounded-md border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        فك الحظر
                      </button>
                    ) : (
                      <button
                        disabled={busy}
                        onClick={() => banMutation.mutate(selectedUser.id)}
                        className="px-3 py-2 rounded-md border border-amber-500/40 text-amber-300 hover:bg-amber-500/10 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                      >
                        <Ban className="w-4 h-4" />
                        حظر
                      </button>
                    )}
                    <button
                      disabled={busy}
                      onClick={() => runDelete(selectedUser)}
                      className="px-3 py-2 rounded-md border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 text-sm font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                    >
                      <Trash2 className="w-4 h-4" />
                      حذف
                    </button>
                  </div>
                </TabsContent>

                <TabsContent value="activity" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <InfoRow label="المعرّف" value={selectedUser.id} mono />
                    <InfoRow label="تاريخ الإنشاء" value={formatDate(selectedUser.created_at)} />
                    <InfoRow label="آخر تحديث" value={formatDate(selectedUser.updated_at)} />
                    <InfoRow label="آخر دخول" value={formatDate(selectedUser.last_sign_in_at)} />
                    <InfoRow
                      label="تأكيد البريد"
                      value={formatDate(selectedUser.email_confirmed_at)}
                    />
                    <InfoRow label="الحظر حتى" value={formatDate(selectedUser.banned_until)} />
                    <InfoRow
                      label="مزود الدخول"
                      value={
                        selectedUser.providers.length ? selectedUser.providers.join(", ") : "—"
                      }
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    <h3 className="text-sm font-bold mb-2">بيانات المستخدم داخل النظام</h3>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {Object.entries(details.counts).map(([key, value]) => (
                        <div
                          key={key}
                          className="flex items-center justify-between gap-2 border-b border-border/70 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{COUNT_LABELS[key] ?? key}</span>
                          <span className="font-bold gold-text">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="metadata" className="mt-4">
                  <pre className="max-h-[420px] overflow-auto rounded-md border border-border bg-black/20 p-3 text-xs leading-relaxed text-muted-foreground ltr:text-left">
                    {JSON.stringify(
                      {
                        app_metadata: selectedUser.app_metadata,
                        user_metadata: selectedUser.user_metadata,
                        profile: selectedUser.profile,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </TabsContent>
              </Tabs>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CreateUserForm({
  createForm,
  setCreateForm,
  submitCreate,
  pending,
}: {
  createForm: CreateForm;
  setCreateForm: React.Dispatch<React.SetStateAction<CreateForm>>;
  submitCreate: (e: React.FormEvent) => void;
  pending: boolean;
}) {
  return (
    <form onSubmit={submitCreate} className="space-y-3">
      <Field label="الاسم">
        <input
          className={inputClass}
          value={createForm.full_name}
          onChange={(e) => setCreateForm((current) => ({ ...current, full_name: e.target.value }))}
          placeholder="اسم المستخدم"
        />
      </Field>
      <Field label="البريد الإلكتروني">
        <input
          className={inputClass}
          type="email"
          value={createForm.email}
          onChange={(e) => setCreateForm((current) => ({ ...current, email: e.target.value }))}
          required
          placeholder="name@example.com"
        />
      </Field>
      <Field label="كلمة المرور">
        <input
          className={inputClass}
          type="password"
          minLength={6}
          value={createForm.password}
          onChange={(e) => setCreateForm((current) => ({ ...current, password: e.target.value }))}
          required
          placeholder="6 أحرف على الأقل"
        />
      </Field>
      <Field label="الدور">
        <RoleSelect
          value={createForm.role}
          onChange={(role) => setCreateForm((current) => ({ ...current, role }))}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-muted-foreground py-1">
        <Checkbox
          checked={createForm.email_confirm}
          onCheckedChange={(checked) =>
            setCreateForm((current) => ({ ...current, email_confirm: checked === true }))
          }
        />
        تأكيد البريد تلقائياً
      </label>
      <button
        disabled={pending}
        className="btn-gold w-full py-2.5 rounded-md font-bold disabled:opacity-60 inline-flex items-center justify-center gap-2"
      >
        <UserPlus className="w-4 h-4" />
        {pending ? "جارٍ الإنشاء..." : "إنشاء حساب"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-foreground mb-1.5 block">{label}</span>
      {children}
    </label>
  );
}

function RoleSelect({ value, onChange }: { value: AppRole; onChange: (role: AppRole) => void }) {
  return (
    <select
      className={inputClass}
      value={value}
      onChange={(e) => onChange(e.target.value as AppRole)}
    >
      {Object.entries(ROLE_LABELS).map(([role, label]) => (
        <option key={role} value={role}>
          {label}
        </option>
      ))}
    </select>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "neutral" | "gold" | "sky" | "emerald" | "rose";
}) {
  const toneClass =
    tone === "gold"
      ? "text-[var(--gold)]"
      : tone === "sky"
        ? "text-sky-300"
        : tone === "emerald"
          ? "text-emerald-300"
          : tone === "rose"
            ? "text-rose-300"
            : "text-muted-foreground";
  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className={`w-4 h-4 ${toneClass}`} />
      </div>
      <div className="mt-2 text-2xl font-bold gold-text">{value}</div>
    </div>
  );
}

function AvatarName({ user, large = false }: { user: ManagedUser; large?: boolean }) {
  const letter = (user.full_name || user.email || "?").trim().slice(0, 1).toUpperCase();
  return (
    <div className="flex items-center gap-3 min-w-0">
      <div
        className={`${large ? "w-12 h-12 text-lg" : "w-10 h-10 text-sm"} rounded-full bg-secondary grid place-items-center text-[var(--gold)] font-bold shrink-0 border border-border`}
      >
        {letter}
      </div>
      <div className="min-w-0">
        <div className={`${large ? "text-base" : "text-sm"} font-semibold truncate`}>
          {user.full_name || user.email || "بدون اسم"}
        </div>
        <div className="text-xs text-muted-foreground truncate">{user.email || user.id}</div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: AppRole }) {
  const tone =
    role === "admin"
      ? "bg-[var(--gold)]/15 text-[var(--gold)] border-[var(--gold)]/30"
      : role === "staff"
        ? "bg-sky-500/10 text-sky-300 border-sky-500/30"
        : "bg-emerald-500/10 text-emerald-300 border-emerald-500/30";
  return <span className={`badge-status border ${tone}`}>{ROLE_LABELS[role]}</span>;
}

function StatusBadge({ user }: { user: ManagedUser }) {
  if (isBanned(user)) {
    return (
      <span className="badge-status bg-rose-500/15 text-rose-300 border border-rose-500/30">
        محظور
      </span>
    );
  }
  if (user.email_confirmed_at || user.confirmed_at) {
    return (
      <span className="badge-status bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
        مفعل
      </span>
    );
  }
  return (
    <span className="badge-status bg-amber-500/10 text-amber-300 border border-amber-500/30">
      غير مؤكد
    </span>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={`text-left break-all ${mono ? "font-mono text-xs" : ""}`}>
        {value || "—"}
      </span>
    </div>
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return format(date, "yyyy/MM/dd HH:mm");
}

function isBanned(user: ManagedUser) {
  if (!user.banned_until) return false;
  const date = new Date(user.banned_until);
  return !Number.isNaN(date.getTime()) && date.getTime() > Date.now();
}

function UserListSkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="h-16 rounded-md bg-muted/50" />
      ))}
    </div>
  );
}

function DetailsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-12 rounded-md bg-muted/50" />
      <div className="h-10 rounded-md bg-muted/50" />
      <div className="h-10 rounded-md bg-muted/50" />
      <div className="h-32 rounded-md bg-muted/50" />
    </div>
  );
}
