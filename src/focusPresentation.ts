export function focusStageProgress(elapsedMs: number) {
  const elapsedMinutes = Math.max(0, elapsedMs) / 60_000;
  const stages = [
    { start: 0, end: 5 },
    { start: 5, end: 15 },
    { start: 15, end: 30 },
    { start: 30, end: 60 },
  ];

  return stages.map(({ start, end }, index) => {
    if (elapsedMinutes < start) return 0;
    if (index === stages.length - 1 && elapsedMinutes >= start) {
      return Math.min(100, ((elapsedMinutes - start) / (end - start)) * 100);
    }
    return Math.min(100, ((elapsedMinutes - start) / (end - start)) * 100);
  });
}
