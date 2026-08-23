import {
  BarChart3,
  BookOpen,
  CalendarDays,
  Clapperboard,
  Code2,
  Dumbbell,
  FileText,
  HeartPulse,
  ListTodo,
  Megaphone,
  MessageSquare,
  Palette,
  PenLine,
  Search,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { normalizeTaskIconKey, TASK_ICON_KEYS, TaskIconKey } from "../../domain";

export const TASK_ICON_LABELS: Record<TaskIconKey, string> = {
  "list-todo": "Загальна задача",
  code: "Код і розробка",
  design: "Дизайн",
  writing: "Написання",
  research: "Дослідження",
  learning: "Навчання",
  communication: "Спілкування",
  planning: "Планування",
  document: "Документи",
  analysis: "Аналіз",
  marketing: "Просування",
  build: "Створення й ремонт",
  health: "Здоров’я",
  fitness: "Тренування",
  creative: "Творча робота",
  video: "Відео й анімація",
};

const TASK_ICON_COMPONENTS = {
  "list-todo": ListTodo,
  code: Code2,
  design: Palette,
  writing: PenLine,
  research: Search,
  learning: BookOpen,
  communication: MessageSquare,
  planning: CalendarDays,
  document: FileText,
  analysis: BarChart3,
  marketing: Megaphone,
  build: Wrench,
  health: HeartPulse,
  fitness: Dumbbell,
  creative: Sparkles,
  video: Clapperboard,
} satisfies Record<TaskIconKey, LucideIcon>;

export const TASK_ICON_OPTIONS = TASK_ICON_KEYS.map((key) => ({ key, label: TASK_ICON_LABELS[key] }));

export function TaskIcon({ iconKey, size = 17, className = "" }: { iconKey: unknown; size?: number; className?: string }) {
  const safeKey = normalizeTaskIconKey(iconKey);
  const Icon = TASK_ICON_COMPONENTS[safeKey];
  const label = TASK_ICON_LABELS[safeKey];
  return <span className={`task-icon ${className}`.trim()} role="img" aria-label={`Іконка задачі: ${label}`} title={label}>
    <Icon size={size} strokeWidth={2} aria-hidden="true" focusable="false"/>
  </span>;
}
