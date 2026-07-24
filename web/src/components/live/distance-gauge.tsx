"use client";

import type { DetectionThresholds } from "@/db/schema";
import type { DeviceState } from "@/lib/live-types";

/**
 * Vertical distance instrument. Top = close to the sensor (top of a pull-up),
 * bottom = far / off the bar. Renders the rep zone and hang zone as bands, plus
 * a live marker at the current smoothed reading. This is the signature visual:
 * it literally shows the sensor beam and where your head is in it.
 */
export function DistanceGauge({
  distanceMm,
  state,
  thresholds,
}: {
  distanceMm: number | null;
  state: DeviceState;
  thresholds: DetectionThresholds;
}) {
  const { presenceMaxMm, repNearMm } = thresholds;
  // Map a distance to a 0..100 position from the top.
  const toPct = (mm: number) =>
    Math.max(0, Math.min(100, (mm / presenceMaxMm) * 100));

  const repZoneEnd = toPct(repNearMm); // rep zone: top .. repNear
  const hasReading = distanceMm != null && distanceMm <= presenceMaxMm;
  const markerPct = distanceMm != null ? toPct(distanceMm) : 100;
  const inRepZone = state === "rep_up" || (hasReading && distanceMm! < repNearMm);

  return (
    <div className="panel relative flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="eyebrow">Sensor</div>
        <div className="font-mono text-[0.62rem] text-fg-faint">VL53L0X</div>
      </div>

      <div className="relative flex-1">
        {/* Track */}
        <div className="relative mx-auto h-full w-16 overflow-hidden rounded-xl border border-line bg-ink-2">
          {/* rep zone band (top) */}
          <div
            className="absolute inset-x-0 top-0 bg-gradient-to-b from-lime/25 to-transparent"
            style={{ height: `${repZoneEnd}%` }}
          />
          {/* hang zone band */}
          <div
            className="absolute inset-x-0 bg-gradient-to-b from-cyan/10 to-transparent"
            style={{ top: `${repZoneEnd}%`, bottom: 0 }}
          />

          {/* tick marks */}
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="absolute right-0 h-px w-2 bg-line-bright"
              style={{ top: `${(i / 8) * 100}%` }}
            />
          ))}

          {/* rep threshold line */}
          <div
            className="absolute inset-x-0 z-10 border-t border-dashed border-lime/70"
            style={{ top: `${repZoneEnd}%` }}
          />

          {/* moving scan sweep when active */}
          {(state === "hanging" || state === "rep_up") && (
            <div className="absolute inset-x-0 top-0 h-8 animate-sweep bg-gradient-to-b from-transparent via-lime/20 to-transparent" />
          )}

          {/* live marker */}
          {hasReading && (
            <div
              className="absolute inset-x-0 z-20 transition-[top] duration-150 ease-out"
              style={{ top: `calc(${markerPct}% - 2px)` }}
            >
              <div
                className={`h-1 w-full ${inRepZone ? "bg-lime shadow-[0_0_14px] shadow-lime/70" : "bg-cyan shadow-[0_0_12px] shadow-cyan/60"}`}
              />
            </div>
          )}
        </div>

        {/* rep zone label */}
        <div
          className="pointer-events-none absolute left-0 font-mono text-[0.55rem] uppercase tracking-widest text-lime/70"
          style={{ top: 2 }}
        >
          rep
        </div>
      </div>

      {/* readout */}
      <div className="mt-3 text-center">
        <div
          className={`font-mono text-2xl leading-none tnum ${inRepZone ? "text-lime" : hasReading ? "text-cyan" : "text-fg-faint"}`}
        >
          {distanceMm != null ? distanceMm : "—"}
        </div>
        <div className="eyebrow mt-1 !text-[0.55rem]">mm to head</div>
      </div>
    </div>
  );
}
