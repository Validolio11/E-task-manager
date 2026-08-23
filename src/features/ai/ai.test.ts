import { describe, expect, it } from "vitest";
import { AppSnapshot } from "../../domain";
import { buildAiPrompt, orderAiActionsForExecution, parseAiReply } from "./ai";

const data: AppSnapshot = {
  schemaVersion: 1,
  projects: [{ id: "project-1", title: "Портфоліо", description: "Анімаційний шоуріл із 3D-сценами", skill: "After Effects", status: "active", sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z" }],
  tasks: [{ id: "task-1", projectId: "project-1", title: "Зробити сцену", status: "todo", targetMinutes: 15, iconKey: "video", sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z", completedAt: null }],
  sessions: [],
  settings: { theme: "system", accent: "lime", compact: false, focusPresets: [5, 15], soundEnabled: true, aiProvider: "openai", openaiModel: "gpt-5-mini", geminiModel: "gemini-2.5-flash", aiIncludeSessionHistory: true, aiConsentAccepted: true, aiConsentVersion: 2 },
};

describe("AI response contract", () => {
  it("accepts a supported proposed action", () => {
    const reply = parseAiReply(JSON.stringify({
      message: "Пропоную наступний крок.",
      actions: [{ type: "create_task", title: "Анімація", taskId: null, projectId: "project-1", description: null, skill: null, targetMinutes: 15, iconKey: "video" }],
    }));
    expect(reply.actions[0].type).toBe("create_task");
    expect(reply.actions[0].projectTitle).toBeNull();
    expect(reply.actions[0].iconKey).toBe("video");
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

  it("drops fractional and out-of-range focus targets", () => {
    for (const targetMinutes of [1.5, 0, 241]) {
      const reply = parseAiReply(JSON.stringify({ message: "Готово", actions: [{ type: "create_task", targetMinutes }] }));
      expect(reply.actions[0].targetMinutes).toBeNull();
    }
  });

  it("drops icon keys outside the local catalog", () => {
    const reply = parseAiReply('{"message":"Готово","actions":[{"type":"create_task","iconKey":"remote-icon-url"}]}');
    expect(reply.actions[0].iconKey).toBeNull();
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
    expect(prompt).toContain("Анімаційний шоуріл із 3D-сценами");
    expect(prompt).toContain('"iconKey":"video"');
    expect(prompt).toContain("list-todo=загальна задача");
  });

  it("omits raw focus sessions when the user disables them", () => {
    const withoutSessions = { ...data, settings: { ...data.settings, aiIncludeSessionHistory: false } };
    const prompt = buildAiPrompt(withoutSessions, Date.parse("2026-08-18T12:00:00.000Z"), [], "Підсумуй");
    expect(prompt).toContain("не передаються за вибором користувача");
    expect(prompt).not.toContain('"taskId":"task-1","startedAt"');
  });

  it("uses the same whole-minute rounding as the interface", () => {
    const now = Date.parse("2026-08-18T12:00:59.000Z");
    const withShortSession: AppSnapshot = {
      ...data,
      sessions: [{ id: "session-1", taskId: "task-1", startedAt: "2026-08-18T12:00:00.000Z", endedAt: null, durationMs: null, targetMinutes: 5, targetNotified: false }],
    };
    const prompt = buildAiPrompt(withShortSession, now, [], "Скільки часу?");
    expect(prompt).toContain('"durationMinutes":0');
    expect(prompt).toContain('"todayMinutes":0');
    expect(prompt).toContain('"allTimeMinutes":0');
  });
});
