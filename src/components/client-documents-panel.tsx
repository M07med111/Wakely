import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ExternalLink, FileText, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createStoragePath } from "@/lib/storage-path";

const BUCKET = "case-documents";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

type ClientDocument = {
  id: string;
  created_at?: string | null;
  mime_type?: string | null;
  name: string;
  size_bytes?: number | null;
  storage_path: string;
  virtual?: boolean;
};

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.ceil(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function ClientDocumentsPanel({
  clientId,
  documents,
  poaFilePath,
}: {
  clientId: string;
  documents: ClientDocument[];
  poaFilePath?: string | null;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const visibleDocuments = useMemo(() => {
    const docs = documents.filter((doc) => doc?.id || doc?.storage_path);
    if (!poaFilePath || docs.some((doc) => doc.storage_path === poaFilePath)) return docs;
    return [
      {
        id: `poa-${poaFilePath}`,
        name: "ملف التوكيل",
        storage_path: poaFilePath,
        mime_type: poaFilePath.toLowerCase().endsWith(".pdf") ? "application/pdf" : null,
        virtual: true,
      },
      ...docs,
    ];
  }, [documents, poaFilePath]);

  const openDocument = async (path: string) => {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "تعذر فتح الملف");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const removeDocument = async (doc: ClientDocument) => {
    if (doc.virtual) return;
    const { error: storageError } = await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    if (storageError) throw storageError;
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) throw error;
  };

  const uploadDocuments = async (files: FileList | null) => {
    const selected = Array.from(files ?? []);
    if (selected.length === 0) return;
    setUploading(true);
    try {
      const oversized = selected.find((file) => file.size > MAX_UPLOAD_BYTES);
      if (oversized) {
        throw new Error(`الملف "${oversized.name}" أكبر من الحد المسموح (${formatBytes(MAX_UPLOAD_BYTES)})`);
      }

      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");

      for (const file of selected) {
        const path = createStoragePath([u.user.id, "clients", clientId], file);
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
        if (uploadError) throw uploadError;

        const { error: docError } = await supabase.from("documents").insert({
          user_id: u.user.id,
          client_id: clientId,
          name: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
        });
        if (docError) throw docError;
      }

      toast.success(`تم رفع ${selected.length} ملف`);
      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
    } catch (e: any) {
      toast.error(e.message ?? "فشل رفع الملفات");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          onChange={(e) => uploadDocuments(e.target.files)}
          className="hidden"
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs hover:border-[var(--gold)] disabled:opacity-60"
        >
          <Upload className="w-3.5 h-3.5" /> {uploading ? "جار الرفع..." : "رفع مستند"}
        </button>
      </div>

      {visibleDocuments.length === 0 ? (
        <p className="text-muted-foreground text-sm py-6 text-center">لا توجد مستندات.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {visibleDocuments.map((doc) => (
            <div
              key={doc.id}
              className="border border-border rounded-md p-3 flex items-center gap-2"
            >
              <FileText className="w-4 h-4 text-[var(--gold)] shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold truncate">{doc.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {doc.virtual
                    ? "مرفق التوكيل"
                    : doc.created_at
                      ? format(new Date(doc.created_at), "yyyy/MM/dd")
                      : "مستند"}
                  {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ""}
                </div>
              </div>
              <button
                type="button"
                onClick={() => openDocument(doc.storage_path)}
                className="p-2 hover:bg-muted rounded-md"
                title="فتح الملف"
              >
                <ExternalLink className="w-4 h-4" />
              </button>
              {!doc.virtual && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await removeDocument(doc);
                      toast.success("تم حذف المستند");
                      qc.invalidateQueries({ queryKey: ["client-documents", clientId] });
                    } catch (e: any) {
                      toast.error(e.message ?? "فشل حذف المستند");
                    }
                  }}
                  className="p-2 hover:bg-rose-500/10 text-rose-400 rounded-md"
                  title="حذف المستند"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
