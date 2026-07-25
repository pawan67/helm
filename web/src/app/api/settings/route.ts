import { NextRequest, NextResponse } from "next/server";
import { getSettings, updateSettings } from "@/db/persist";
import { publishConfig } from "@/lib/mqtt";
import type { DetectionThresholds } from "@/db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSettings();
  return NextResponse.json({ settings: s });
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Coerce loose JSON (true/false, "true", 1/0) to a bool, keeping the current value otherwise. */
function toBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === 1) return true;
  if (v === "false" || v === 0) return false;
  return fallback;
}

export async function PUT(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const current = await getSettings();
  const patch: Parameters<typeof updateSettings>[0] = {};

  if ("dailyGoalReps" in body)
    patch.dailyGoalReps = clampInt(body.dailyGoalReps, 0, 10000, current.dailyGoalReps);
  if ("weeklyGoalReps" in body)
    patch.weeklyGoalReps = clampInt(body.weeklyGoalReps, 0, 70000, current.weeklyGoalReps);
  if ("dailyGoalHangMs" in body)
    patch.dailyGoalHangMs = clampInt(body.dailyGoalHangMs, 0, 3_600_000, current.dailyGoalHangMs);

  if ("soundEnabled" in body)
    patch.soundEnabled = toBool(body.soundEnabled, current.soundEnabled);
  if ("beepOnRep" in body)
    patch.beepOnRep = toBool(body.beepOnRep, current.beepOnRep);
  if ("beepOnSessionEnd" in body)
    patch.beepOnSessionEnd = toBool(body.beepOnSessionEnd, current.beepOnSessionEnd);
  if ("tempLoggingEnabled" in body)
    patch.tempLoggingEnabled = toBool(body.tempLoggingEnabled, current.tempLoggingEnabled);

  if (body.thresholds && typeof body.thresholds === "object") {
    const t = body.thresholds as Partial<DetectionThresholds>;
    const cur = current.thresholds;
    patch.thresholds = {
      presenceMaxMm: clampInt(t.presenceMaxMm, 100, 2000, cur.presenceMaxMm),
      hangBandMm: clampInt(t.hangBandMm, 100, 2000, cur.hangBandMm),
      repNearMm: clampInt(t.repNearMm, 20, 1000, cur.repNearMm),
      repHysteresisMm: clampInt(t.repHysteresisMm, 0, 500, cur.repHysteresisMm),
      minRepMs: clampInt(t.minRepMs, 0, 5000, cur.minRepMs),
      releaseMs: clampInt(t.releaseMs, 200, 10000, cur.releaseMs),
      presenceDebounceMs: clampInt(t.presenceDebounceMs, 0, 5000, cur.presenceDebounceMs),
    };
  }

  const updated = await updateSettings(patch);
  // Push the new thresholds/goal to the device immediately (retained).
  await publishConfig();

  return NextResponse.json({ settings: updated });
}
