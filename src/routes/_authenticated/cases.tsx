import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { TopBar } from "@/components/sidebar";
import { useState } from "react";
import { Plus, Briefcase } from "lucide-react";
import { StatusBadge } from "@/components/status-badge";
import { EmptyState } from "@/components/empty-state";
import { NewCaseModal } from "@/components/new-case-modal";
import { formatCaseId } from "@/lib/case-format";
import { CaseDetailsModal } from "@/components/case-details-modal";
import { ClientDetailsModal } from "@/components/client-details-modal";
import { PageError } from "@/components/page-feedback";

export const Route = createFileRoute("/_authenticated/cases")({
  component: CasesPage,
});

function CasesPage() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [detailsCaseId, setDetailsCaseId] = useState<string | null>(null);
  const [detailsClientId, setDetailsClientId] = useState<string | null>(null);

  const {
    data: cases = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ["cases", q],
    queryFn: async () => {
      let query = supabase
        .from("cases")
        .select("*, clients(id, full_name)")
        .order("created_at", { ascending: false });
      if (q) query = query.ilike("case_number", `%${q}%`);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Determine "جلسة قريبة" — within next 3 days
  const isSoon = (d: string | null) => {
    if (!d) return false;
    const diff = new Date(d).getTime() - Date.now();
    return diff > 0 && diff < 3 * 86400000;
  };

  if (isLoading) return <PageLoading />;
  if (error) return <PageError message={(error as Error).message} />;

  return (
    <div>
      <TopBar>
        <button
          onClick={() => setOpen(true)}
          className="btn-gold px-4 py-2 rounded-md font-semibold flex items-center gap-2"
        >
          <Plus className="w-4 h-4" /> قضية جديدة
        </button>
      </TopBar>

      <div className="mb-6">
        <h1 className="text-3xl font-bold">القضايا</h1>
        <p className="text-muted-foreground mt-1">جميع القضايا الموكلة للمكتب</p>
      </div>

      <input
        placeholder="ابحث برقم القضية..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full md:max-w-sm bg-card border border-border rounded-md px-4 py-2.5 text-sm outline-none focus:border-[var(--gold)] mb-5"
      />

      {cases.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title="لا توجد قضايا بعد"
          description="ابدأ بفتح أول قضية لمتابعتها."
          actionLabel="قضية جديدة"
          onAction={() => setOpen(true)}
        />
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {cases
              .filter((c: any) => c?.id)
              .map((c: any) => (
                <button
                  type="button"
                  key={c?.id}
                  onClick={() => setDetailsCaseId(c?.id)}
                  className="glass-card p-4 block w-full text-right active:scale-[0.99]"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <span className="font-bold text-[var(--gold)] text-xs truncate">
                      {formatCaseId(c)}
                    </span>
                    <div className="flex gap-1 shrink-0">
                      {isSoon(c.next_session_date) && <StatusBadge status="urgent" />}
                      <StatusBadge status={c.status} />
                    </div>
                  </div>
                  {c.clients?.id ? (
                    <span
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDetailsClientId(c.clients.id);
                      }}
                      className="text-sm font-semibold truncate text-right hover:text-[var(--gold)] cursor-pointer block"
                    >
                      {c.clients?.full_name ?? "—"}
                    </span>
                  ) : (
                    <div className="text-sm font-semibold truncate">
                      {c.clients?.full_name ?? "—"}
                    </div>
                  )}
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">
                    {c.court_name ?? c.court_location ?? "—"}{" "}
                    {c.opponent_name && `· الخصم: ${c.opponent_name}`}
                  </div>
                </button>
              ))}
          </div>

          {/* Desktop: table */}
          <div className="glass-card overflow-hidden hidden md:block">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground">
                <tr>
                  <th className="text-right p-3">رقم القضية</th>
                  <th className="text-right p-3">الموكل</th>
                  <th className="text-right p-3">المحكمة</th>
                  <th className="text-right p-3">الخصم</th>
                  <th className="text-right p-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {cases
                  .filter((c: any) => c?.id)
                  .map((c: any) => (
                    <tr
                      key={c?.id}
                      onClick={() => setDetailsCaseId(c?.id)}
                      className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    >
                      <td className="p-3">
                        <span className="text-[var(--gold)] font-semibold block">
                          {formatCaseId(c)}
                        </span>
                      </td>
                      <td className="p-3">
                        {c.clients?.id ? (
                          <span
                            onClick={(e) => {
                              e.stopPropagation();
                              setDetailsClientId(c.clients.id);
                            }}
                            className="hover:text-[var(--gold)] cursor-pointer"
                          >
                            {c.clients.full_name}
                          </span>
                        ) : (
                          (c.clients?.full_name ?? "—")
                        )}
                      </td>
                      <td className="p-3">{c.court_name ?? c.court_location ?? "—"}</td>
                      <td className="p-3">{c.opponent_name ?? "—"}</td>
                      <td className="p-3">
                        <div className="flex gap-1 flex-wrap">
                          {isSoon(c.next_session_date) && <StatusBadge status="urgent" />}
                          <StatusBadge status={c.status} />
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {open && <NewCaseModal onClose={() => setOpen(false)} />}
      <CaseDetailsModal caseId={detailsCaseId} onClose={() => setDetailsCaseId(null)} />
      <ClientDetailsModal clientId={detailsClientId} onClose={() => setDetailsClientId(null)} />
    </div>
  );
}

function PageLoading() {
  return (
    <div className="p-6 space-y-3 animate-pulse">
      <div className="h-8 w-40 bg-muted rounded" />
      <div className="h-12 w-full bg-muted/50 rounded" />
      <div className="h-52 bg-muted/40 rounded-xl" />
    </div>
  );
}
