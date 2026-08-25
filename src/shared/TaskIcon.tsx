import type { TaskIconKey } from "../domain/types";

const fallbackEmoji: Record<TaskIconKey, string> = {
  search: "🔍",
  panels: "🗂️",
  scan: "🎯",
  file: "📄",
  code: "💻",
  message: "💬",
  sparkles: "✨",
  list: "📝",
};

export function resolveTaskEmoji(icon: TaskIconKey, emoji?: string) {
  return emoji?.trim() || fallbackEmoji[icon] || "📝";
}

export function TaskIcon({ icon, emoji, size = 18 }: { icon: TaskIconKey; emoji?: string; size?: number }) {
  return <span className="task-emoji" style={{ fontSize: size }} aria-hidden="true">{resolveTaskEmoji(icon, emoji)}</span>;
}
