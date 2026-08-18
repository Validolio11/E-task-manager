import { describe, expect, it } from "vitest";
import { AppSnapshot } from "../../domain";
import { buildAiPrompt, parseAiReply } from "./ai";

const data: AppSnapshot = {
  schemaVersion: 1,
  projects: [{ id: "project-1", title: "Портфоліо", description: "", skill: "After Effects", status: "active", sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z" }],
  tasks: [{ id: "task-1", projectId: "project-1", title: "Зробити сцену", status: "todo", targetMinutes: 15, sortOrder: 0, createdAt: "2026-08-18T10:00:00.000Z", updatedAt: "2026-08-18T10:00:00.000Z", completedAt: null }],
  sessions: [],
  settings: { theme: "system", accent: "lime", compact: false, focusPresets: [5, 15], soundEnabled: true },
};

describe("AI response contract", () => {
  it("accepts a supported proposed action", () => {
    const reply = parseAiReply(JSON.stringify({
      message: "Пропоную наступний крок.",
      actions: [{ type: "create_task", title: "Анімація", taskId: null, projectId: "project-1", description: null, skill: null, targetMinutes: 15 }],
    }));
    expect(reply.actions[0].type).toBe("create_task");
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
});

describe("AI local context", () => {
  it("includes exact entity IDs and the current question", () => {
    const prompt = buildAiPrompt(data, Date.parse("2026-08-18T12:00:00.000Z"), [], "Що робити далі?");
    expect(prompt).toContain("project-1");
    expect(prompt).toContain("task-1");
    expect(prompt).toContain("Що робити далі?");
  });
});
