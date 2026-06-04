import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Upload, Download, Trash2, Image as ImageIcon, Search, ScanText } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useState } from "react";

const BUCKET = "case-documents";

export function CaseDocuments({ caseId }: { caseId: string }) {
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState<string>("");
  const [query, setQuery] = useState("");

  const { data: docs = [] } = useQuery({
    queryKey: ["case-docs", caseId],
    enabled: !!caseId,
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").eq("case_id", caseId).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const remove = useMutation({
    mutationFn: async (d: any) => {
      if (!d?.id || !d?.storage_path) throw new Error("بيانات المستند غير متاحة");
      await supabase.storage.from(BUCKET).remove([d.storage_path]);
      const { error } = await supabase.from("documents").delete().eq("id", d?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["case-docs", caseId] });
    },
  });

  /** Extract Arabic + English text from an image using Tesseract.js (browser-side, free). */
  const ocrImage = async (file: File): Promise<string | null> => {
    try {
      const { default: Tesseract } = await import("tesseract.js");
      setOcrProgress("جارٍ استخراج النص...");
      const res = await Tesseract.recognize(file, "ara+eng", {
        logger: (m) => {
          if (m.status === "recognizing text") setOcrProgress(`OCR ${Math.round(m.progress * 100)}%`);
        },
      });
      return (res.data.text ?? "").trim() || null;
    } catch (e) {
      console.warn("[OCR] failed", e);
      return null;
    } finally {
      setOcrProgress("");
    }
  };

  const upload = async (files: File[]) => {
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user?.id) throw new Error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      const userId = u.user.id;
      for (const file of files) {
        const path = `${userId}/${caseId}/${Date.now()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
        if (upErr) throw upErr;

        // Run OCR for images (Tesseract supports ara+eng)
        let ocrText: string | null = null;
        if (file.type.startsWith("image/")) {
          ocrText = await ocrImage(file);
        }

        const { data: doc, error: dbErr } = await supabase.from("documents").insert({
          user_id: userId,
          case_id: caseId,
          name: file.name,
          storage_path: path,
          mime_type: file.type,
          size_bytes: file.size,
          ocr_text: ocrText,
        }).select("id").maybeSingle();
        if (dbErr) throw dbErr;
        if (!doc?.id) throw new Error("تعذّر استرجاع بيانات المستند بعد الحفظ");
        await supabase.from("case_activities").insert({
          user_id: userId,
          case_id: caseId,
          type: "document_uploaded",
          description: `تم رفع المستند: ${file.name}${ocrText ? " (تم استخراج النص)" : ""}`,
        });
      }
      toast.success(`تم رفع ${files.length} ملف`);
      qc.invalidateQueries({ queryKey: ["case-docs", caseId] });
      qc.invalidateQueries({ queryKey: ["case-activity", caseId] });
    } catch (e: any) {
      toast.error(e.message ?? "فشل الرفع");
    } finally {
      setUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: upload,
    accept: { "image/*": [], "application/pdf": [] },
    disabled: uploading,
  });

  const downloadDoc = async (d: any) => {
    if (!d?.storage_path) return toast.error("بيانات المستند غير متاحة");
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(d.storage_path, 60);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "تعذر إنشاء رابط التحميل");
    window.open(data.signedUrl, "_blank");
  };

  // Local search over name + ocr_text
  const q = query.trim().toLowerCase();
  const filtered = q
    ? docs.filter((d: any) =>
        (d.name?.toLowerCase().includes(q)) ||
        (d.ocr_text?.toLowerCase().includes(q))
      )
    : docs;

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-border hover:border-[var(--gold)]/50"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="w-8 h-8 text-[var(--gold)] mx-auto mb-2" />
        <p className="text-sm font-semibold">
          {uploading ? (ocrProgress || "جارٍ الرفع...") : isDragActive ? "أفلت الملفات هنا" : "اسحب الملفات هنا أو اضغط للاختيار"}
        </p>
        <p className="text-xs text-muted-foreground mt-1">PDF أو صور — تُستخرج النصوص تلقائياً من الصور (عربي/English)</p>
      </div>

      {docs.length > 0 && (
        <div className="relative">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="بحث داخل أسماء الملفات والنصوص المستخرجة..."
            className="w-full bg-input border border-border rounded-md pr-9 pl-3 py-2 text-sm outline-none focus:border-[var(--gold)]"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="text-muted-foreground text-sm py-6 text-center">
          {docs.length === 0 ? "لا توجد ملفات مرفقة بعد." : "لا توجد نتائج مطابقة."}
        </p>
      ) : (
        <div className="space-y-2">
                {filtered.filter((d: any) => d?.id).map((d: any) => {
            const isImg = d.mime_type?.startsWith("image/");
            const snippet = q && d.ocr_text?.toLowerCase().includes(q)
              ? extractSnippet(d.ocr_text, q)
              : null;
            return (
              <div key={d?.id} className="flex items-start gap-3 p-3 bg-card/60 border border-border rounded-lg">
                {isImg ? <ImageIcon className="w-4 h-4 text-[var(--gold)] shrink-0 mt-1" /> : <FileText className="w-4 h-4 text-[var(--gold)] shrink-0 mt-1" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate flex items-center gap-2">
                    {d.name}
                    {d.ocr_text && <ScanText className="w-3.5 h-3.5 text-emerald-400" />}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(new Date(d.created_at), "yyyy/MM/dd")} {d.size_bytes ? `· ${(d.size_bytes / 1024).toFixed(1)} KB` : ""}
                  </div>
                  {snippet && (
                    <div className="text-xs text-muted-foreground mt-1.5 line-clamp-2 bg-muted/30 p-2 rounded">
                      …{snippet}…
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => downloadDoc(d)} className="p-2 hover:bg-muted rounded-md" title="تحميل">
                    <Download className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove.mutate(d)} className="p-2 hover:bg-rose-500/10 text-rose-400 rounded-md" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function extractSnippet(text: string, q: string, ctx = 50): string {
  const i = text.toLowerCase().indexOf(q);
  if (i < 0) return text.slice(0, 120);
  return text.slice(Math.max(0, i - ctx), Math.min(text.length, i + q.length + ctx));
}
