import { describe, expect, it } from "vitest";
import { AppSnapshot } from "../../domain";
import { buildAiPrompt, orderAiActionsForExecution, parseAiReply } from "./ai";

const data: AppSnapshot = {
  schemaVersion: 1,
  projects: [{ id: "project-1", title: "Портфоліо", description: "", skill: "After Effects", status: "active", sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z" }],
  tasks: [{ id: "task-1", projectId: "project-1", title: "Зробити сцену", status: "todo", targetMinutes: 15, sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z", completedAt: null }],
  sessions: [],
  settings: { theme: "system", accent: "lime", compact: false, focusPresets: [5, 15], soundEnabled: true, aiProvider: "openai", openaiModel: "gpt-5-mini", geminiModel: "gemini-2.5-flash", aiIncludeSessionHistory: true, aiConsentAccepted: true },
};

describe("AI response contract", () => {
  it("accepts a supported proposed action", () => {
    const reply = parseAiReply(JSON.stringify({
      message: "Пропоную наступний крок.",
      actions: [{ type: "create_task", title: "Анімація", taskId: null, projectId: "project-1", description: null, skill: null, targetMinutes: 15 }],
    }));
    expect(reply.actions[0].type).toBe("create_task");
    expect(reply.actions[0].projectTitle).toBeNull();
  });

  it("drops unknown or destructive actions", () => {
    const reply = parseAiReply(JSON.stringify({
      message: "Не видаляю автоматично.",
      actions: [{ type: "delete_project", title: null }],
    }));
    expect(reply.actions).toEqual([]);
  });

  it("rejects malformed responses", () => {
    expect(() => parseAiReply('{"message": 4}')).toThrow(/невідомому форматі/);
  });

  it("drops non-finite focus targets from provider payloads", () => {
    const reply = parseAiReply('{"message":"Готово","actions":[{"type":"create_task","targetMinutes":1e999}]}');
    expect(reply.actions[0].targetMinutes).toBeNull();
  });
});

describe("AI action planning", () => {
  it("runs new projects before their proposed tasks", () => {
    const ordered = orderAiActionsForExecution([
      { type: "create_task" as const, id: "task" },
      { type: "create_project" as const, id: "project" },
      { type: "complete_task" as const, id: "complete" },
    ]);
    expect(ordered.map((item) => item.id)).toEqual(["project", "task", "complete"]);
  });
});

describe("AI local context", () => {
  it("includes exact entity IDs and the current question", () => {
    const prompt = buildAiPrompt(data, Date.parse("2026-08-18T12:00:00.000Z"), [], "Що робити далі?");
    expect(prompt).toContain("project-1");
    expect(prompt).toContain("task-1");
    expect(prompt).toContain("Що робити далі?");
  });

  it("omits raw focus sessions when the user disables them", () => {
    const withoutSessions = { ...data, settings: { ...data.settings, aiIncludeSessionHistory: false } };
    const prompt = buildAiPrompt(withoutSessions, Date.parse("2026-08-18T12:00:00.000Z"), [], "Підсумуй");
    expect(prompt).toContain("не передаються за вибором користувача");
    expect(prompt).not.toContain('"taskId":"task-1","startedAt"');
  });
});
