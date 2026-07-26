/**
 * Server-side validation of an IR action (climate patch or button fire) against
 * a device. Shared by the action-links API and any other caller that accepts a
 * user-supplied action. NOT client-safe — it reads the DB.
 */
import { getIrButton, getIrDevice } from "@/db/ir";
import {
  CLIMATE_MODES,
  CLIMATE_FANS,
  CLIMATE_SWINGS,
  type ClimatePatch,
} from "./ir-climate";
import type { ScheduleAction } from "./schedule";

function parseClimatePatch(raw: Record<string, unknown>): ClimatePatch {
  const patch: ClimatePatch = {};
  if (typeof raw.power === "boolean") patch.power = raw.power;
  if (typeof raw.mode === "string" && (CLIMATE_MODES as readonly string[]).includes(raw.mode))
    patch.mode = raw.mode as ClimatePatch["mode"];
  if (raw.tempC != null && Number.isFinite(Number(raw.tempC)))
    patch.tempC = Number(raw.tempC);
  if (typeof raw.fan === "string" && (CLIMATE_FANS as readonly string[]).includes(raw.fan))
    patch.fan = raw.fan as ClimatePatch["fan"];
  if (typeof raw.swing === "string" && (CLIMATE_SWINGS as readonly string[]).includes(raw.swing))
    patch.swing = raw.swing as ClimatePatch["swing"];
  return patch;
}

/** Returns a validated action, or an error string. */
export async function parseIrAction(
  raw: unknown,
  deviceId: string,
): Promise<ScheduleAction | string> {
  if (!raw || typeof raw !== "object") return "Missing action";
  const a = raw as Record<string, unknown>;

  if (a.kind === "climate") {
    const dev = await getIrDevice(deviceId);
    if (!dev || dev.kind !== "climate") return "Device is not a climate device";
    const patch = parseClimatePatch((a.patch ?? {}) as Record<string, unknown>);
    if (Object.keys(patch).length === 0) return "Climate action has no fields";
    return { kind: "climate", patch };
  }

  if (a.kind === "button") {
    const buttonId = typeof a.buttonId === "string" ? a.buttonId : "";
    if (!buttonId) return "Missing buttonId";
    const btn = await getIrButton(buttonId);
    if (!btn || btn.deviceId !== deviceId) return "Button does not belong to device";
    return { kind: "button", buttonId };
  }

  return "Unknown action kind";
}
