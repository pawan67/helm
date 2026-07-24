"use client";

import { useState } from "react";
import { useLive } from "./live-provider";
import type { Settings, DetectionThresholds } from "@/db/schema";

type ThresholdKey = keyof DetectionThresholds;

const THRESHOLD_FIELDS: {
  key: ThresholdKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  unit: string;
}[] = [
  { key: "repNearMm", label: "Rep line", hint: "Head this close to the sensor = top of a pull-up.", min: 20, max: 1000, step: 5, unit: "mm" },
  { key: "presenceMaxMm", label: "Presence range", hint: "Beyond this (or no reading) = nobody on the bar.", min: 100, max: 2000, step: 10, unit: "mm" },
  { key: "hangBandMm", label: "Hang band", hint: "Distance that counts as a hanging body.", min: 100, max: 2000, step: 10, unit: "mm" },
  { key: "repHysteresisMm", label: "Rep hysteresis", hint: "Must rise this far back above the rep line to count & re-arm.", min: 0, max: 500, step: 5, unit: "mm" },
  { key: "minRepMs", label: "Min rep time", hint: "Ignore up/down cycles faster than this (anti-jitter).", min: 0, max: 5000, step: 50, unit: "ms" },
  { key: "releaseMs", label: "Release delay", hint: "Off the bar this long ends the session.", min: 200, max: 10000, step: 100, unit: "ms" },
  { key: "presenceDebounceMs", label: "Start debounce", hint: "Must be present this long before a session starts.", min: 0, max: 5000, step: 50, unit: "ms" },
];

export function SettingsForm({ initial }: { initial: Settings }) {
  const { state, connected } = useLive();
  const [dailyGoalReps, setDailyGoalReps] = useState(initial.dailyGoalReps);
  const [weeklyGoalReps, setWeeklyGoalReps] = useState(initial.weeklyGoalReps);
  const [dailyGoalHangSec, setDailyGoalHangSec] = useState(
    Math.round(initial.dailyGoalHangMs / 1000),
  );
  const [thresholds, setThresholds] = useState<DetectionThresholds>(initial.thresholds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function setT(key: ThresholdKey, value: number) {
    setThresholds((t) => ({ ...t, [key]: value }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyGoalReps,
          weeklyGoalReps,
          dailyGoalHangMs: dailyGoalHangSec * 1000,
          thresholds,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      }
    } finally {
      setSaving(false);
    }
  }

  const live = connected && state.deviceOnline;

  return (
    <div className="space-y-4">
      {/* Live calibration strip */}
      <div className="panel flex flex-wrap items-center justify-between gap-4 p-5">
        <div>
          <div className="eyebrow">Live reading</div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-3xl tnum text-lime">
              {state.distanceMm != null ? state.distanceMm : "—"}
            </span>
            <span className="font-mono text-xs text-fg-faint">mm · {live ? state.state : "offline"}</span>
          </div>
        </div>
        <p className="max-w-xs font-mono text-[0.7rem] text-fg-faint">
          Hang from the bar and pull to a full rep while watching this number.
          Set the rep line just above your chin-over-bar reading.
        </p>
      </div>

      {/* Goals */}
      <div className="panel p-6">
        <div className="eyebrow mb-4">Goals</div>
        <div className="grid gap-5 sm:grid-cols-3">
          <NumField label="Daily reps" value={dailyGoalReps} min={0} max={10000} onChange={(v) => { setDailyGoalReps(v); setSaved(false); }} />
          <NumField label="Weekly reps" value={weeklyGoalReps} min={0} max={70000} onChange={(v) => { setWeeklyGoalReps(v); setSaved(false); }} />
          <NumField label="Daily hang (sec)" value={dailyGoalHangSec} min={0} max={3600} onChange={(v) => { setDailyGoalHangSec(v); setSaved(false); }} />
        </div>
      </div>

      {/* Detection thresholds */}
      <div className="panel p-6">
        <div className="mb-1 eyebrow">Detection thresholds</div>
        <p className="mb-5 max-w-2xl text-sm text-fg-dim">
          These are pushed to the ESP32 instantly over MQTT — no reflashing.
          Tune them against the live reading above.
        </p>
        <div className="grid gap-6 sm:grid-cols-2">
          {THRESHOLD_FIELDS.map((f) => (
            <SliderField
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={thresholds[f.key]}
              min={f.min}
              max={f.max}
              step={f.step}
              unit={f.unit}
              onChange={(v) => setT(f.key, v)}
            />
          ))}
        </div>
      </div>

      {/* Device */}
      <div className="panel p-6">
        <div className="eyebrow mb-4">Device</div>
        <dl className="grid gap-4 font-mono text-sm sm:grid-cols-4">
          <Info label="ID" value={initial.deviceId} />
          <Info label="Status" value={live ? "online" : "offline"} accent={live ? "lime" : "danger"} />
          <Info label="Firmware" value={state.fwVersion ?? "—"} />
          <Info label="Signal" value={state.rssi != null ? `${state.rssi} dBm` : "—"} />
        </dl>
      </div>

      {/* Save bar */}
      <div className="sticky bottom-24 z-20 flex items-center justify-end gap-3 lg:bottom-4">
        {saved && (
          <span className="animate-rise font-mono text-xs text-lime">
            ✓ saved & pushed to device
          </span>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="rounded-xl bg-lime px-6 py-3 font-display text-lg tracking-wider text-ink shadow-lg shadow-lime/20 transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {saving ? "SAVING…" : "SAVE CHANGES"}
        </button>
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="block">
      <span className="eyebrow">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full rounded-lg border border-line bg-ink-2 px-3 py-2.5 font-mono text-fg outline-none focus:border-lime/60"
      />
    </label>
  );
}

function SliderField({
  label,
  hint,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-fg">{label}</span>
        <span className="font-mono text-sm text-lime tnum">
          {value}
          <span className="ml-1 text-fg-faint">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(Number(e.target.value))}
        className="range-lime mt-3 w-full"
      />
      <p className="mt-1.5 text-xs text-fg-faint">{hint}</p>
    </div>
  );
}

function Info({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: "lime" | "danger";
}) {
  return (
    <div>
      <dt className="eyebrow !text-[0.55rem]">{label}</dt>
      <dd
        className={`mt-1 ${accent === "lime" ? "text-lime" : accent === "danger" ? "text-danger" : "text-fg"}`}
      >
        {value}
      </dd>
    </div>
  );
}
