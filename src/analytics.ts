import { addCalendarDays, FocusSession, startOfMonth, startOfWeek, startOfYear, totalInside } from "./domain";

export type AnalyticsPeriod = "week" | "month" | "year";

export function analyticsPeriodLabel(period: AnalyticsPeriod) {
  return period === "week" ? "Тиждень" : period === "month" ? "Місяць" : "Рік";
}

function rangeFor(period: AnalyticsPeriod, anchor: number) {
  const date = new Date(anchor);
  if (period === "week") {
    const start = startOfWeek(date);
    return { start, end: addCalendarDays(start, 7) };
  }
  if (period === "month") {
    const start = startOfMonth(date);
    return { start, end: new Date(date.getFullYear(), date.getMonth() + 1, 1).getTime() };
  }
  const start = startOfYear(date);
  return { start, end: new Date(date.getFullYear() + 1, 0, 1).getTime() };
}

function formatRange(period: AnalyticsPeriod, start: number, end: number) {
  const startDate = new Date(start);
  if (period === "week") {
    const endDate = new Date(end - 1);
    return `${startDate.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })} — ${endDate.toLocaleDateString("uk-UA", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (period === "month") return startDate.toLocaleDateString("uk-UA", { month: "long", year: "numeric" });
  return String(startDate.getFullYear());
}

export function buildAnalyticsPeriod(sessions: FocusSession[], period: AnalyticsPeriod, anchor: number, now: number) {
  const current = rangeFor(period, anchor);
  const previous = rangeFor(period, current.start - 1);
  const present = rangeFor(period, now);
  const total = totalInside(sessions, current.start, current.end, now);
  const previousTotal = totalInside(sessions, previous.start, previous.end, now);
  const difference = total - previousTotal;
  const percent = previousTotal ? Math.round((difference / previousTotal) * 100) : null;
  const deltaLabel = previousTotal
    ? `${difference >= 0 ? "+" : "−"}${Math.abs(percent ?? 0)}% до попереднього ${analyticsPeriodLabel(period).toLowerCase() === "рік" ? "року" : "періоду"}`
    : total ? "Перші дані для порівняння" : "У цьому періоді ще немає сесій";

  const buckets = period === "week"
    ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"].map((label, index) => ({ label, value: totalInside(sessions, addCalendarDays(current.start, index), addCalendarDays(current.start, index + 1), now) }))
    : period === "month"
      ? Array.from({ length: Math.ceil(new Date(current.end - 1).getDate() / 7) }, (_, index) => {
          const start = addCalendarDays(current.start, index * 7);
          const end = Math.min(addCalendarDays(start, 7), current.end);
          return { label: `${new Date(start).getDate()}–${new Date(end - 1).getDate()}`, value: totalInside(sessions, start, end, now) };
        })
      : Array.from({ length: 12 }, (_, index) => {
          const start = new Date(new Date(current.start).getFullYear(), index, 1).getTime();
          const end = new Date(new Date(current.start).getFullYear(), index + 1, 1).getTime();
          return { label: new Date(start).toLocaleDateString("uk-UA", { month: "short" }), value: totalInside(sessions, start, end, now) };
        });

  return {
    ...current,
    total,
    previousTotal,
    buckets,
    label: formatRange(period, current.start, current.end),
    deltaLabel,
    previousAnchor: previous.start,
    nextAnchor: current.end,
    isCurrent: current.start === present.start,
  };
}
