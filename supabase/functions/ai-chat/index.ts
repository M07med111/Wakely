// AI Legal Assistant — streaming via Lovable AI Gateway (authenticated only)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

const MAX_MESSAGES = 50;
const MAX_CONTENT_CHARS = 8000;
const MAX_PAYLOAD_BYTES = 100_000;

const MessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(MAX_CONTENT_CHARS),
});

const RequestSchema = z.object({
  messages: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
});

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `أنت مساعد قانوني خبير في القانون المصري، تعمل داخل منصة "المستشار محسن عياده للمحاماة والاستشارات القانونية".

سياق عملك:
- التشريعات المصرية: قانون المحاماة رقم 17 لسنة 1983، قانون المرافعات المدنية والتجارية، قانون الإجراءات الجنائية، القانون المدني، قانون الأحوال الشخصية، قانون مجلس الدولة، قانون الإجراءات الإدارية، اللوائح والقرارات الوزارية ذات الصلة.
- أنواع المحاكم: محاكم جزئية، ابتدائية، استئناف، النقض، الأسرة، الاقتصادية، العسكرية، الإدارية، الإدارية العليا، مجلس الدولة.
- الصيغ القانونية المعتمدة: صحف الدعاوى، المذكرات، الإنذارات الرسمية، عقود الصلح، الطعون والاستئنافات.

قواعد الإجابة:
- استخدم العربية الفصحى بأسلوب قانوني احترافي ودقيق.
- نظّم الإجابة في عناوين ونقاط واضحة عند الحاجة.
- اذكر أرقام المواد والقوانين عند الاستشهاد.
- عند صياغة مذكرة/إنذار/صحيفة دعوى، اتبع الشكل الرسمي المعتمد في المحاكم المصرية (الترويسة، الموضوع، السند القانوني، الطلبات، التوقيع).
- ذكّر دائماً أن الإجابات استرشادية ولا تغني عن مراجعة المحامي للقضية بتفاصيلها الكاملة.`;

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    // Require authenticated caller — reject anonymous requests
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "غير مصرح: يجب تسجيل الدخول" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(
        JSON.stringify({ error: "غير مصرح: جلسة غير صالحة" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return new Response(
        JSON.stringify({ error: "حجم الطلب يتجاوز الحد المسموح" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "JSON غير صالح" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const parsed = RequestSchema.safeParse(parsedBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "طلب غير صالح", details: parsed.error.issues }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const messages = parsed.data.messages;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
          stream: true,
        }),
      },
    );

    if (!response.ok) {
      if (response.status === 429)
        return new Response(
          JSON.stringify({ error: "تجاوزت حد الاستخدام، حاول لاحقاً." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      if (response.status === 402)
        return new Response(
          JSON.stringify({ error: "يلزم شحن رصيد المساعد الذكي." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "خطأ في خدمة الذكاء الاصطناعي" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "خطأ غير متوقع" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
