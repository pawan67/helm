"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
  Cell,
} from "recharts";
import type { Session, DailyStat } from "@/db/schema";
import { SessionRow } from "@/components/session-row";
import { EmptyState } from "@/components/ui";
import { formatHang } from "@/lib/time";

const RANGES = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
];

type ChartDatum = {
  date: string;
  label: string;
  reps: number;
  hangMin: number;
  goal: number;
  hit: boolean;
};

export function HistoryView({
  initialDays,
  initialSessions,
}: {
  initialDays: DailyStat[];
  initialSessions: Session[];
}) {
  const [range, setRange] = useState(30);
  const [days, setDays] = useState<DailyStat[]>(initialDays);
  const [sessions, setSessions] = useState<Session[]>(initialSessions);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/stats?days=${range}`).then((r) => r.json()),
      fetch(`/api/sessions?limit=60`).then((r) => r.json()),
    ])
      .then(([s, se]) => {
        if (cancelled) return;
        setDays(s.days ?? []);
        setSessions(se.sessions ?? []);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range]);

  const chartData: ChartDatum[] = useMemo(
    () =>
      days.map((d) => ({
        date: d.date,
        label: d.date.slice(5),
        reps: d.totalReps,
        hangMin: Math.round((d.totalHangMs / 60000) * 10) / 10,
        goal: d.goalReps,
        hit: d.goalReps > 0 && d.totalReps >= d.goalReps,
      })),
    [days],
  );

  const totalReps = chartData.reduce((s, d) => s + d.reps, 0);
  const totalHangMs = days.reduce((s, d) => s + d.totalHangMs, 0);
  const activeDays = chartData.filter((d) => d.reps > 0 || d.hangMin > 0).length;
  const goalLine = chartData.find((d) => d.goal > 0)?.goal ?? 0;

  return (
    <div className="space-y-4">
      {/* range toggle + totals */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-3 font-mono text-xs text-fg-dim">
          <span>
            <span className="text-lime">{totalReps.toLocaleString()}</span> reps
          </span>
          <span className="text-fg-faint">·</span>
          <span>
            <span className="text-cyan">{formatHang(totalHangMs)}</span> hung
          </span>
          <span className="text-fg-faint">·</span>
          <span>{activeDays} active days</span>
        </div>
        <div className="inline-flex overflow-hidden rounded-lg border border-line">
          {RANGES.map((r) => (
            <button
              key={r.days}
              onClick={() => setRange(r.days)}
              className={`px-3.5 py-1.5 font-mono text-xs transition-colors ${
                range === r.days
                  ? "bg-lime text-ink"
                  : "text-fg-dim hover:bg-panel-2"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* reps chart */}
      <div className={`panel p-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="mb-4 eyebrow">Reps per day</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-fg-faint)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "var(--color-line)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "var(--color-fg-faint)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "var(--color-panel-2)" }}
                content={<ChartTip unit="reps" />}
              />
              {goalLine > 0 && (
                <ReferenceLine
                  y={goalLine}
                  stroke="var(--color-amber)"
                  strokeDasharray="4 4"
                  strokeOpacity={0.6}
                />
              )}
              <Bar dataKey="reps" radius={[3, 3, 0, 0]} maxBarSize={26}>
                {chartData.map((d) => (
                  <Cell
                    key={d.date}
                    fill={d.hit ? "var(--color-lime)" : "color-mix(in srgb, var(--color-lime) 40%, transparent)"}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* hang chart */}
      <div className={`panel p-5 transition-opacity ${loading ? "opacity-60" : ""}`}>
        <div className="mb-4 eyebrow">Hang time per day (min)</div>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="hangFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-cyan)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--color-cyan)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-line)" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "var(--color-fg-faint)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={{ stroke: "var(--color-line)" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={20}
              />
              <YAxis
                tick={{ fill: "var(--color-fg-faint)", fontSize: 10, fontFamily: "var(--font-mono)" }}
                axisLine={false}
                tickLine={false}
                width={40}
              />
              <Tooltip cursor={{ stroke: "var(--color-cyan)" }} content={<ChartTip unit="min" />} />
              <Area
                type="monotone"
                dataKey="hangMin"
                stroke="var(--color-cyan)"
                strokeWidth={2}
                fill="url(#hangFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* session list */}
      <div className="panel p-5">
        <div className="mb-2 eyebrow">All sessions</div>
        {sessions.length === 0 ? (
          <EmptyState
            title="No sessions logged"
            hint="Your recorded sets and hangs will appear here."
          />
        ) : (
          <div>
            {sessions.map((s) => (
              <SessionRow key={s.id} session={{ ...s, startedAt: new Date(s.startedAt), endedAt: new Date(s.endedAt), createdAt: new Date(s.createdAt) }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ChartTip({
  active,
  payload,
  label,
  unit,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  unit: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-ink px-3 py-2 font-mono text-xs shadow-xl">
      <div className="text-fg-faint">{label}</div>
      <div className="mt-0.5 text-fg">
        <span className="text-lime">{payload[0].value}</span> {unit}
      </div>
    </div>
  );
}
