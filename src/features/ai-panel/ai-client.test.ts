import { afterEach, describe, expect, it, vi } from "vitest";
import { completionUrl, requestAiReply } from "./ai-client";
import type { AiSettings } from "./ai-settings";

const settings: AiSettings = {
  mode: "api",
  baseUrl: "https://example.com/v1/",
  model: "example-model",
  apiKey: "secret",
  rememberKey: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("AI API client", () => {
  it("normalizes an OpenAI-compatible completion URL", () => {
    expect(completionUrl("https://example.com/v1/")).toBe("https://example.com/v1/chat/completions");
    expect(completionUrl("https://example.com/v1/chat/completions")).toBe("https://example.com/v1/chat/completions");
  });

  it("returns the assistant text and sends the authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "  Готово.  " } }] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestAiReply(settings, [], [], null)).resolves.toBe("Готово.");
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/v1/chat/completions", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer secret" }) }));
  });

  it("converts an unauthorized response into a useful message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Unauthorized" } }), { status: 401, headers: { "Content-Type": "application/json" } })));
    await expect(requestAiReply(settings, [], [], null)).rejects.toThrow("API відхилив ключ");
  });
});
