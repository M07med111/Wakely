import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Search, Users, Briefcase, X } from "lucide-react";
import { toast } from "sonner";

export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const enabled = open && q.trim().length > 0;
  const term = q.trim();

  const { data: clients = [] } = useQuery({
    queryKey: ["search-clients", term],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, full_name, phone").ilike("full_name", `%${term}%`).limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: cases = [] } = useQuery({
    queryKey: ["search-cases", term],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from("cases").select("id, case_number, court_name, clients(full_name)").or(`case_number.ilike.%${term}%,court_name.ilike.%${term}%`).limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });

  const safeOpen = (type: "client" | "case", record: any) => {
    if (!record?.id) {
      toast.error("تعذر فتح السجل: المعرّف غير متاح");
      return;
    }
    navigate({ to: type === "client" ? "/clients/$id" : "/cases/$id", params: { id: record.id } });
    onClose();
  };

  if (!open) return null;

  const empty = enabled && clients.length === 0 && cases.length === 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm grid place-items-start pt-[10vh] px-4" onClick={onClose}>
      <div className="glass-card w-full max-w-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-[var(--gold)]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ابحث عن موكل أو قضية..."
            className="flex-1 bg-transparent outline-none text-sm placeholder:text-muted-foreground"
          />
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!enabled && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              ابدأ بكتابة اسم موكل أو رقم قضية...
            </div>
          )}

          {clients.length > 0 && (
            <Group title="الموكلون">
              {clients.filter((c: any) => c?.id).map((c: any) => (
                <button
                  key={c?.id}
                  onClick={() => safeOpen("client", c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 text-right"
                >
                  <Users className="w-4 h-4 text-[var(--gold)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{c.full_name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{c.phone || "—"}</div>
                  </div>
                </button>
              ))}
            </Group>
          )}

          {cases.length > 0 && (
            <Group title="القضايا">
              {cases.filter((c: any) => c?.id).map((c: any) => (
                <button
                  key={c?.id}
                  onClick={() => safeOpen("case", c)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 text-right"
                >
                  <Briefcase className="w-4 h-4 text-[var(--gold)]" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">قضية #{c.case_number}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      {c.clients?.full_name ?? "—"} {c.court_name && `· ${c.court_name}`}
                    </div>
                  </div>
                </button>
              ))}
            </Group>
          )}

          {empty && (
            <div className="p-8 text-center text-xs text-muted-foreground">لا توجد نتائج لـ "{term}"</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-4 py-1 text-[10px] font-bold text-muted-foreground tracking-wider">{title}</div>
      {children}
    </div>
  );
}
