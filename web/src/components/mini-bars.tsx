import { addDays, localDate } from "@/lib/time";

/**
 * A compact reps-per-day bar chart (server-rendered, no chart lib). Fills the
 * full window so empty days show as flat ticks, and marks the daily goal line.
 */
export function MiniBars({
  data,
  goal,
  windowDays = 14,
}: {
  data: { date: string; totalReps: number }[];
  goal: number;
  windowDays?: number;
}) {
  const today = localDate(new Date());
  const byDate = new Map(data.map((d) => [d.date, d.totalReps]));
  const days = Array.from({ length: windowDays }, (_, i) => {
    const date = addDays(today, -(windowDays - 1 - i));
    return { date, reps: byDate.get(date) ?? 0 };
  });

  const max = Math.max(goal, ...days.map((d) => d.reps), 1);
  const goalPct = (goal / max) * 100;

  return (
    <div>
      <div className="relative flex h-40 items-end gap-1.5">
        {/* goal line */}
        {goal > 0 && (
          <div
            className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-amber/50"
            style={{ bottom: `${goalPct}%` }}
          >
            <span className="absolute -top-2 right-0 bg-panel px-1 font-mono text-[0.6rem] text-amber/80">
              goal {goal}
            </span>
          </div>
        )}
        {days.map((d, i) => {
          const h = (d.reps / max) * 100;
          const hit = goal > 0 && d.reps >= goal;
          const isToday = d.date === today;
          return (
            <div
              key={d.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              style={{ height: "100%" }}
            >
              <div
                className={`w-full rounded-t-[3px] transition-all ${
                  d.reps === 0
                    ? "bg-line"
                    : hit
                      ? "bg-lime"
                      : "bg-lime/35"
                } ${isToday ? "ring-1 ring-lime/60" : ""}`}
                style={{
                  height: `${Math.max(h, d.reps === 0 ? 2 : 6)}%`,
                  animationDelay: `${i * 25}ms`,
                }}
                title={`${d.date}: ${d.reps} reps`}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[0.6rem] text-fg-faint">
        <span>{days[0].date.slice(5)}</span>
        <span>today</span>
      </div>
    </div>
  );
}
