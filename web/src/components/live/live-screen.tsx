"use client";

import { useEffect, useRef, useState } from "react";
import { useLive } from "@/components/live-provider";
import { DistanceGauge } from "./distance-gauge";
import type { DetectionThresholds } from "@/db/schema";
import { RECORD_LABELS } from "@/lib/live-types";
import { formatDuration, formatHang } from "@/lib/time";

const STATE_META: Record<
  string,
  { label: string; className: string; dot: string }
> = {
  idle: { label: "READY", className: "text-fg-dim border-line", dot: "bg-fg-faint" },
  hanging: { label: "ON THE BAR", className: "text-cyan border-cyan/40", dot: "bg-cyan" },
  rep_up: { label: "PULLING", className: "text-lime border-lime/50", dot: "bg-lime" },
  offline: { label: "DEVICE OFFLINE", className: "text-danger border-danger/40", dot: "bg-danger" },
};

export function LiveScreen({ thresholds }: { thresholds: DetectionThresholds }) {
  const { state, connected, repTick, lastSessionEnd, clearSessionEnd } = useLive();
  const [elapsed, setElapsed] = useState(0);
  const [flash, setFlash] = useState(0);
  const prevTick = useRef(0);

  const active = state.state === "hanging" || state.state === "rep_up";
  const meta = STATE_META[connected ? state.state : "offline"] ?? STATE_META.idle;

  // On-bar timer, driven client-side from the session start instant.
  useEffect(() => {
    if (!active || !state.sessionStartedAt) {
      setElapsed(0);
      return;
    }
    const start = state.sessionStartedAt;
    const tick = () => setElapsed(Date.now() - start);
    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [active, state.sessionStartedAt]);

  // Full-screen flash + pop on each new rep.
  useEffect(() => {
    if (repTick !== prevTick.current) {
      prevTick.current = repTick;
      if (repTick > 0) setFlash((n) => n + 1);
    }
  }, [repTick]);

  // Auto-dismiss the session summary after a while.
  useEffect(() => {
    if (!lastSessionEnd) return;
    const id = setTimeout(clearSessionEnd, 14000);
    return () => clearTimeout(id);
  }, [lastSessionEnd, clearSessionEnd]);

  return (
    <div className="relative">
      {/* rep flash */}
      <div
        key={flash}
        className={`pointer-events-none fixed inset-0 z-40 ${
          flash > 0 ? "animate-[flash-pr_0.5s_ease-out]" : "opacity-0"
        }`}
        style={{
          background:
            "radial-gradient(60% 50% at 50% 40%, color-mix(in srgb, var(--color-lime) 18%, transparent), transparent 70%)",
        }}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        {/* Main readout */}
        <div className="panel relative flex min-h-[62dvh] flex-col overflow-hidden p-6 sm:p-8 lg:min-h-[74dvh]">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-20" />

          {/* state badge */}
          <div className="relative flex items-center justify-between">
            <div
              className={`inline-flex items-center gap-2.5 rounded-full border px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] ${meta.className}`}
            >
              <span className={`h-2 w-2 rounded-full ${meta.dot} ${active ? "animate-blink" : ""}`} />
              {meta.label}
            </div>
            <div className="font-mono text-[0.68rem] text-fg-faint">
              {connected ? "stream ● live" : "reconnecting…"}
            </div>
          </div>

          {/* giant counter */}
          <div className="relative flex flex-1 flex-col items-center justify-center py-6">
            <div
              key={repTick}
              className={`font-display leading-[0.8] tnum text-lime glow-lime ${repTick > 0 ? "animate-pop" : ""}`}
              style={{ fontSize: "clamp(7rem, 30vw, 18rem)" }}
            >
              {state.reps}
            </div>
            <div className="eyebrow mt-2 !text-sm !tracking-[0.4em]">reps</div>

            {/* on-bar timer */}
            <div className="mt-8 flex items-center gap-3 rounded-2xl border border-line bg-ink-2/70 px-6 py-3">
              <svg viewBox="0 0 24 24" className="h-5 w-5 text-cyan" fill="none" stroke="currentColor" strokeWidth="1.6">
                <circle cx="12" cy="13" r="8" />
                <path d="M12 9v4l2.5 2.5M9 2h6" strokeLinecap="round" />
              </svg>
              <span className="font-mono text-3xl tnum text-cyan glow-cyan">
                {formatDuration(elapsed)}
              </span>
              <span className="eyebrow !text-[0.6rem]">on bar</span>
            </div>
          </div>

          {/* idle hint */}
          {!active && !lastSessionEnd && (
            <div className="relative text-center">
              <p className="font-mono text-sm text-fg-faint">
                {connected
                  ? "Grab the bar to start a session"
                  : "Waiting for the device stream…"}
              </p>
            </div>
          )}
        </div>

        {/* Distance gauge */}
        <div className="lg:w-56">
          <DistanceGauge
            distanceMm={state.distanceMm}
            state={connected ? state.state : "offline"}
            thresholds={thresholds}
          />
        </div>
      </div>

      {/* Session summary overlay */}
      {lastSessionEnd && (
        <SessionSummary end={lastSessionEnd} onClose={clearSessionEnd} />
      )}
    </div>
  );
}

function SessionSummary({
  end,
  onClose,
}: {
  end: Extract<ReturnType<typeof useLive>["lastSessionEnd"], object>;
  onClose: () => void;
}) {
  const isPull = end.type === "pullup_set";
  const hasPR = end.brokenRecords.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/70 p-4 backdrop-blur-sm sm:items-center">
      <div className="animate-rise panel ring-accent w-full max-w-md overflow-hidden">
        {hasPR && (
          <div className="flex items-center justify-center gap-2 bg-amber py-2 font-display text-lg tracking-widest text-ink">
            <span className="animate-blink">★</span> NEW PERSONAL RECORD
          </div>
        )}
        <div className="p-6">
          <div className="flex items-center justify-between">
            <div className="eyebrow">Session complete</div>
            <button
              onClick={onClose}
              className="font-mono text-xs text-fg-faint hover:text-fg"
            >
              dismiss ✕
            </button>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span
              className={`font-display text-7xl leading-none tnum ${isPull ? "text-lime glow-lime" : "text-cyan glow-cyan"}`}
            >
              {isPull ? end.reps : formatHang(end.maxHangMs)}
            </span>
            <span className="font-display text-2xl text-fg-dim">
              {isPull ? "REPS" : "HANG"}
            </span>
          </div>

          <div className="mt-6 grid grid-cols-3 gap-3">
            <SummaryStat label="On bar" value={formatDuration(end.durationMs)} />
            <SummaryStat label="Hang time" value={formatHang(end.hangMs)} accent="cyan" />
            <SummaryStat
              label="Best hold"
              value={formatHang(end.maxHangMs)}
              accent="cyan"
            />
          </div>

          {hasPR && (
            <div className="mt-5 space-y-1.5">
              {end.brokenRecords.map((r) => (
                <div
                  key={r}
                  className="flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 font-mono text-xs text-amber"
                >
                  ★ {RECORD_LABELS[r] ?? r}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent = "fg",
}: {
  label: string;
  value: string;
  accent?: "fg" | "cyan";
}) {
  return (
    <div className="panel-inset rounded-xl px-3 py-3 text-center">
      <div className="eyebrow !text-[0.55rem]">{label}</div>
      <div
        className={`mt-1.5 font-mono text-lg tnum ${accent === "cyan" ? "text-cyan" : "text-fg"}`}
      >
        {value}
      </div>
    </div>
  );
}
