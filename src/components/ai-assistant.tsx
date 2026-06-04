import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X, Send, Plus, Loader2, Wand2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { streamAIChat, type AIMessage } from "@/lib/ai-service";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

type DBMsg = { id: string; role: "user" | "assistant" | "system"; content: string };

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<DBMsg[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const { user } = useAuth();
  const qc = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: templates } = useQuery({
    queryKey: ["ai-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_prompt_templates")
        .select("*")
        .order("created_at");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Load most recent chat when opening
  useEffect(() => {
    if (!open || !user || chatId) return;
    (async () => {
      const { data: chats } = await supabase
        .from("ai_chats")
        .select("id")
        .order("updated_at", { ascending: false })
        .limit(1);
      if (chats?.[0]?.id) {
        setChatId(chats[0].id);
        const { data: msgs } = await supabase
          .from("ai_messages")
          .select("*")
          .eq("chat_id", chats[0].id)
          .order("created_at");
        setMessages((msgs as DBMsg[]) ?? []);
      }
    })();
  }, [open, user, chatId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  async function ensureChat(): Promise<string | null> {
    if (chatId) return chatId;
    if (!user?.id) {
      toast.error("انتهت الجلسة، يرجى تسجيل الدخول مرة أخرى");
      return null;
    }
    const { data, error } = await supabase
      .from("ai_chats")
      .insert({ user_id: user.id, title: "محادثة قانونية" })
      .select()
      .maybeSingle();
    if (error || !data?.id) {
      toast.error("تعذر إنشاء المحادثة");
      return null;
    }
    setChatId(data.id);
    return data.id;
  }

  function newChat() {
    setChatId(null);
    setMessages([]);
  }

  async function send(prefill?: string) {
    const text = (prefill ?? input).trim();
    if (!text || streaming || !user?.id) return;
    setInput("");
    const cid = await ensureChat();
    if (!cid) return;

    const userMsg: DBMsg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    const { error: userMsgError } = await supabase.from("ai_messages").insert({
      chat_id: cid,
      user_id: user.id,
      role: "user",
      content: text,
    });
    if (userMsgError) {
      toast.error("تعذر حفظ الرسالة");
      return;
    }

    setStreaming(true);
    let assistantBuf = "";
    const assistantId = crypto.randomUUID();
    setMessages((m) => [...m, { id: assistantId, role: "assistant", content: "" }]);

    try {
      const history: AIMessage[] = [
        ...messages.map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ];
      await streamAIChat({
        messages: history,
        onDelta: (chunk) => {
          assistantBuf += chunk;
          setMessages((m) =>
            m.map((x) => (x.id === assistantId ? { ...x, content: assistantBuf } : x)),
          );
        },
        onDone: async () => {
          setStreaming(false);
          if (assistantBuf) {
            await supabase.from("ai_messages").insert({
              chat_id: cid,
              user_id: user.id,
              role: "assistant",
              content: assistantBuf,
            });
            await supabase
              .from("ai_chats")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", cid);
            qc.invalidateQueries({ queryKey: ["ai-chats"] });
          }
        },
      });
    } catch (e: any) {
      setStreaming(false);
      toast.error(e?.message || "تعذر توليد الرد");
      setMessages((m) => m.filter((x) => x.id !== assistantId));
    }
  }

  return (
    <>
      {/* Floating action button */}
      <motion.button
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(true)}
        className="fixed left-4 md:left-6 z-40 btn-gold rounded-full w-14 h-14 grid place-items-center shadow-2xl"
        style={{ bottom: "calc(80px + env(safe-area-inset-bottom))" }}
        aria-label="المساعد الذكي"
      >
        <Sparkles className="w-6 h-6" />
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 32 }}
              className="fixed top-0 bottom-0 left-0 w-full md:w-[480px] glass-card rounded-none md:rounded-l-2xl z-50 flex flex-col"
            >
              <div className="flex items-center justify-between p-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="grid place-items-center w-10 h-10 rounded-md btn-gold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold gold-text">المساعد القانوني الذكي</div>
                    <div className="text-[11px] text-muted-foreground">مدعوم بالذكاء الاصطناعي</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={newChat}
                    title="محادثة جديدة"
                    className="p-2 rounded-md hover:bg-secondary text-muted-foreground"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="p-2 rounded-md hover:bg-secondary text-muted-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Templates */}
              <div className="p-3 border-b border-border overflow-x-auto">
                <div className="flex gap-2 min-w-max">
                    {(templates ?? []).filter((t: any) => t?.id).map((t: any) => (
                    <button
                      key={t?.id}
                      onClick={() => setInput(t.prompt)}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors flex items-center gap-1.5 shrink-0"
                    >
                      <Wand2 className="w-3 h-3" />
                      {t.title}
                    </button>
                  ))}
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                  <div className="h-full grid place-items-center text-center text-muted-foreground p-8">
                    <div>
                      <Sparkles className="w-10 h-10 mx-auto text-[var(--gold)] opacity-60" />
                      <p className="mt-4 text-sm">
                        اطرح سؤالاً قانونياً أو اختر قالباً جاهزاً للبدء.
                      </p>
                    </div>
                  </div>
                )}
                {messages.map((m) => (
                  <div
                    key={m?.id}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] rounded-xl px-4 py-3 text-sm whitespace-pre-wrap leading-7 ${
                        m.role === "user"
                          ? "bg-[var(--gold)] text-[var(--primary-foreground)]"
                          : "bg-secondary border border-border"
                      }`}
                    >
                      {m.content ? (
                        m.role === "assistant"
                          ? <div className="prose prose-sm prose-invert max-w-none [&_*]:!my-1.5 [&_h1]:!text-base [&_h2]:!text-sm [&_h3]:!text-sm"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                          : m.content
                      ) : (
                        <Loader2 className="w-4 h-4 animate-spin opacity-60" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Input */}
              <div className="p-3 border-t border-border">
                <div className="flex gap-2 items-end">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        send();
                      }
                    }}
                    rows={2}
                    placeholder="اكتب سؤالك القانوني..."
                    className="flex-1 resize-none bg-input border border-border rounded-md p-2.5 text-sm outline-none focus:border-[var(--gold)]"
                  />
                  <button
                    onClick={() => send()}
                    disabled={streaming || !input.trim()}
                    className="btn-gold rounded-md px-4 py-2.5 disabled:opacity-50"
                  >
                    {streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
