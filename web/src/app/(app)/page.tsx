import Link from "next/link";
import { getDashboardSummary, getRecentSessions, getDailyStats } from "@/db/queries";
import { PageHeader, StatCard, RingProgress, Meter, EmptyState } from "@/components/ui";
import { SessionRow } from "@/components/session-row";
import { MiniBars } from "@/components/mini-bars";
import { LiveNudge } from "@/components/live-nudge";
import { formatHang } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [summary, sessions, daily] = await Promise.all([
    getDashboardSummary(),
    getRecentSessions(6),
    getDailyStats(14),
  ]);

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const goalHit = summary.dailyGoalReps > 0 && summary.todayReps >= summary.dailyGoalReps;

  return (
    <>
      <PageHeader eyebrow={dateLabel} title="Dashboard">
        <Link
          href="/live"
          className="group flex items-center gap-2.5 rounded-xl bg-lime px-5 py-3 font-display text-lg tracking-wider text-ink transition-all hover:brightness-110 active:scale-[0.98]"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-ink/50" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-ink" />
          </span>
          GO LIVE
        </Link>
      </PageHeader>

      <LiveNudge />

      <div className="stagger grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Hero goal ring */}
        <div className="panel col-span-2 flex items-center gap-6 p-6 lg:col-span-2">
          <RingProgress
            value={summary.todayReps}
            max={summary.dailyGoalReps || 1}
            accent={goalHit ? "lime" : "lime"}
          >
            <div className="font-display text-5xl leading-none tnum text-lime glow-lime">
              {summary.todayReps}
            </div>
            <div className="eyebrow mt-1">/ {summary.dailyGoalReps} reps</div>
          </RingProgress>
          <div className="min-w-0 flex-1">
            <div className="eyebrow">Today</div>
            <div className="font-display mt-2 text-2xl">
              {goalHit ? (
                <span className="text-lime">GOAL SMASHED</span>
              ) : (
                <span>
                  {Math.max(0, summary.dailyGoalReps - summary.todayReps)} to go
                </span>
              )}
            </div>
            <div className="mt-4 space-y-1.5">
              <div className="flex items-center justify-between font-mono text-xs text-fg-dim">
                <span>Hang time</span>
                <span className="text-cyan">{formatHang(summary.todayHangMs)}</span>
              </div>
              <div className="flex items-center justify-between font-mono text-xs text-fg-dim">
                <span>Weekly</span>
                <span>
                  {summary.weeklyReps} / {summary.weeklyGoalReps}
                </span>
              </div>
              <Meter value={summary.weeklyReps} max={summary.weeklyGoalReps || 1} />
            </div>
          </div>
        </div>

        <StatCard
          label="Current streak"
          value={summary.currentStreak}
          unit="days"
          accent="amber"
          sub={`Best: ${summary.bestStreak} days`}
        />
        <StatCard
          label="Lifetime reps"
          value={summary.lifetimeReps.toLocaleString()}
          accent="lime"
          sub={`${summary.lifetimeSessions} sessions`}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="panel p-6 lg:col-span-3">
          <div className="mb-5 flex items-center justify-between">
            <div className="eyebrow">Last 14 days</div>
            <Link
              href="/history"
              className="font-mono text-xs text-fg-faint hover:text-lime"
            >
              full history →
            </Link>
          </div>
          <MiniBars
            data={daily.map((d) => ({ date: d.date, totalReps: d.totalReps }))}
            goal={summary.dailyGoalReps}
          />
        </div>

        <div className="panel p-6 lg:col-span-2">
          <div className="eyebrow mb-3">Recent sessions</div>
          {sessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-fg-dim">No sessions yet.</p>
              <p className="mt-1 font-mono text-[0.7rem] text-fg-faint">
                Grab the bar to record your first set.
              </p>
            </div>
          ) : (
            <div>
              {sessions.map((s) => (
                <SessionRow key={s.id} session={s} />
              ))}
            </div>
          )}
        </div>
      </div>

      {summary.lifetimeSessions === 0 && (
        <div className="mt-4">
          <EmptyState
            title="Waiting for your first rep"
            hint="Flash the ESP32, mount the sensor above the bar, and pull. Sessions land here automatically."
          />
        </div>
      )}
    </>
  );
}
