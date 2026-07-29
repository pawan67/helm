import { NextRequest, NextResponse } from "next/server";
import { applyClimateAndBroadcast } from "@/lib/mqtt";
import {
  CLIMATE_MODES,
  CLIMATE_FANS,
  CLIMATE_SWINGS,
  CLIMATE_SWINGS_H,
  CLIMATE_PRESETS,
  type ClimatePatch,
} from "@/lib/ir-climate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Set a climate device's state. Body: { deviceId, patch: {power?,mode?,tempC?,fan?,swing?} }. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
  if (!deviceId) return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });

  const raw = (body.patch ?? {}) as Record<string, unknown>;
  const patch: ClimatePatch = {};
  if (typeof raw.power === "boolean") patch.power = raw.power;
  if (typeof raw.mode === "string" && (CLIMATE_MODES as readonly string[]).includes(raw.mode))
    patch.mode = raw.mode as ClimatePatch["mode"];
  if (raw.tempC != null && Number.isFinite(Number(raw.tempC))) patch.tempC = Number(raw.tempC);
  if (typeof raw.fan === "string" && (CLIMATE_FANS as readonly string[]).includes(raw.fan))
    patch.fan = raw.fan as ClimatePatch["fan"];
  if (typeof raw.swing === "string" && (CLIMATE_SWINGS as readonly string[]).includes(raw.swing))
    patch.swing = raw.swing as ClimatePatch["swing"];
  if (typeof raw.swingH === "string" && (CLIMATE_SWINGS_H as readonly string[]).includes(raw.swingH))
    patch.swingH = raw.swingH as ClimatePatch["swingH"];
  if (typeof raw.preset === "string" && (CLIMATE_PRESETS as readonly string[]).includes(raw.preset))
    patch.preset = raw.preset as ClimatePatch["preset"];

  const state = await applyClimateAndBroadcast(deviceId, patch);
  if (!state) return NextResponse.json({ error: "Not a climate device" }, { status: 404 });
  return NextResponse.json({ state });
}
