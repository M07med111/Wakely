import { beforeEach, describe, expect, it, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  getSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: supabaseMock.getSession,
    },
  },
}));

function sseStream(lines: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const line of lines) controller.enqueue(encoder.encode(line));
      controller.close();
    },
  });
}

async function loadService() {
  vi.resetModules();
  vi.stubEnv("VITE_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon-key");
  return import("./ai-service");
}

describe("streamAIChat", () => {
  beforeEach(() => {
    supabaseMock.getSession.mockResolvedValue({
      data: { session: { access_token: "access-token" } },
    });
    vi.stubGlobal("fetch", vi.fn());
  });

  it("requires an authenticated Supabase session", async () => {
    supabaseMock.getSession.mockResolvedValue({ data: { session: null } });
    const { streamAIChat } = await loadService();

    await expect(
      streamAIChat({
        messages: [{ role: "user", content: "مرحبا" }],
        onDelta: vi.fn(),
        onDone: vi.fn(),
      }),
    ).rejects.toThrow("تسجيل الدخول");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("posts messages and streams assistant deltas", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        sseStream([
          'data: {"choices":[{"delta":{"content":"أهلا"}}]}\n',
          'data: {"choices":[{"delta":{"content":" بك"}}]}\n',
          "data: [DONE]\n",
        ]),
        { status: 200 },
      ),
    );
    const { streamAIChat } = await loadService();
    const chunks: string[] = [];
    const onDone = vi.fn();

    await streamAIChat({
      messages: [{ role: "user", content: "مرحبا" }],
      onDelta: (chunk) => chunks.push(chunk),
      onDone,
    });

    expect(fetch).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/ai-chat",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          apikey: "anon-key",
          Authorization: "Bearer access-token",
        }),
        body: JSON.stringify({ messages: [{ role: "user", content: "مرحبا" }] }),
      }),
    );
    expect(chunks).toEqual(["أهلا", " بك"]);
    expect(onDone).toHaveBeenCalledOnce();
  });

  it("uses JSON error messages from the edge function", async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: "الرصيد غير كاف" }), { status: 402 }),
    );
    const { streamAIChat } = await loadService();

    await expect(
      streamAIChat({
        messages: [{ role: "user", content: "مرحبا" }],
        onDelta: vi.fn(),
        onDone: vi.fn(),
      }),
    ).rejects.toThrow("الرصيد غير كاف");
  });
});
