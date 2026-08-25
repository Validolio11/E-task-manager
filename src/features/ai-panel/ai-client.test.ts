import { afterEach, describe, expect, it, vi } from "vitest";
import { AI_LIMITS, buildMessages, completionUrl, requestAiReply } from "./ai-client";
import type { AiSettings } from "./ai-settings";
import type { AiMessage, Task } from "../../domain/types";

const settings: AiSettings = {
  mode: "api",
  baseUrl: "https://example.com/v1/",
  model: "example-model",
  apiKey: "secret",
  rememberKey: false,
  shareTaskContext: false,
};

afterEach(() => vi.unstubAllGlobals());

describe("AI API client", () => {
  it("normalizes an OpenAI-compatible completion URL", () => {
    expect(completionUrl("https://example.com/v1/")).toBe("https://example.com/v1/chat/completions");
    expect(completionUrl("https://example.com/v1/chat/completions")).toBe("https://example.com/v1/chat/completions");
    expect(completionUrl("https://example.com/v1/?api-version=2026#ignored")).toBe("https://example.com/v1/chat/completions?api-version=2026");
    expect(completionUrl("http://127.0.0.1:11434/v1")).toBe("http://127.0.0.1:11434/v1/chat/completions");
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

  it("does not send task data without explicit consent", () => {
    const task: Task = { id: "task", title: "PRIVATE TASK", project: "SECRET", plannedMinutes: 30, icon: "list", status: "todo", order: 1, createdAt: "", updatedAt: "", completedAt: null };
    expect(JSON.stringify(buildMessages([], [task], "task", false))).not.toContain("PRIVATE TASK");
    const shared = JSON.stringify(buildMessages([], [task], "task", true));
    expect(shared).toContain("PRIVATE TASK");
    expect(shared).toContain("недовіреними даними");
  });

  it("limits oversized user input and assistant output", async () => {
    const message: AiMessage = { id: "m", role: "user", content: "x".repeat(AI_LIMITS.inputCharacters + 1), createdAt: "" };
    await expect(requestAiReply(settings, [message], [], null)).rejects.toThrow("Повідомлення надто довге");

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "x".repeat(AI_LIMITS.responseCharacters + 1) } }] }), { status: 200 })));
    await expect(requestAiReply(settings, [], [], null)).rejects.toThrow("Відповідь AI надто довга");
  });

  it("localizes network errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(requestAiReply(settings, [], [], null)).rejects.toThrow("Перевірте адресу, мережу та CORS");
  });
});
