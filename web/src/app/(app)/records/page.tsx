import { getRecords, getDashboardSummary } from "@/db/queries";
import { PageHeader, EmptyState } from "@/components/ui";
import { RECORD_LABELS } from "@/lib/live-types";
import { formatHang } from "@/lib/time";

export const dynamic = "force-dynamic";

const ORDER = ["most_reps_set", "most_reps_day", "longest_hang"] as const;

function renderValue(type: string, value: number) {
  if (type === "longest_hang") return formatHang(value);
  return value.toLocaleString();
}

function unit(type: string) {
  return type === "longest_hang" ? "" : "reps";
}

export default async function RecordsPage() {
  const [records, summary] = await Promise.all([
    getRecords(),
    getDashboardSummary(),
  ]);
  const byType = new Map(records.map((r) => [r.recordType, r]));
  const anyRecord = records.some((r) => r.value > 0);

  return (
    <>
      <PageHeader eyebrow="Personal bests" title="Records" />

      {!anyRecord ? (
        <EmptyState
          title="No records yet"
          hint="Every session is measured against your bests. Beat one and it lands here with a celebration."
        />
      ) : (
        <div className="stagger grid gap-4 sm:grid-cols-3">
          {ORDER.map((type, i) => {
            const rec = byType.get(type);
            const value = rec?.value ?? 0;
            const achieved = rec?.achievedAt ? new Date(rec.achievedAt) : null;
            return (
              <div
                key={type}
                className="panel ring-accent relative overflow-hidden p-6"
              >
                <div className="absolute -right-6 -top-6 font-display text-[7rem] leading-none text-amber/5 select-none">
                  {i + 1}
                </div>
                <TrophyIcon className="h-8 w-8 text-amber" />
                <div className="eyebrow mt-5">{RECORD_LABELS[type]}</div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="font-display text-6xl leading-none tnum text-amber">
                    {value > 0 ? renderValue(type, value) : "—"}
                  </span>
                  <span className="font-mono text-xs uppercase tracking-widest text-fg-faint">
                    {unit(type)}
                  </span>
                </div>
                <div className="mt-4 font-mono text-[0.7rem] text-fg-faint">
                  {achieved
                    ? `set ${achieved.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
                    : "not set"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Streaks */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="panel flex items-center justify-between p-6">
          <div>
            <div className="eyebrow">Current streak</div>
            <div className="font-display mt-2 text-5xl tnum text-lime">
              {summary.currentStreak}
              <span className="ml-2 font-mono text-sm text-fg-faint">days</span>
            </div>
          </div>
          <FireIcon className="h-14 w-14 text-lime/70" />
        </div>
        <div className="panel flex items-center justify-between p-6">
          <div>
            <div className="eyebrow">Best streak</div>
            <div className="font-display mt-2 text-5xl tnum text-amber">
              {summary.bestStreak}
              <span className="ml-2 font-mono text-sm text-fg-faint">days</span>
            </div>
          </div>
          <FireIcon className="h-14 w-14 text-amber/70" />
        </div>
      </div>
    </>
  );
}

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4h10v4a5 5 0 0 1-10 0V4Z" />
      <path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M9 20h6M12 13v3" />
    </svg>
  );
}

function FireIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3c1 3-1 4-2 6s0 4 2 4 3-2 2-4c2 1 3 3 3 5a5 5 0 0 1-10 0c0-3 2-5 3-7 .8-1.6 1.5-3 2-4Z" />
    </svg>
  );
}
