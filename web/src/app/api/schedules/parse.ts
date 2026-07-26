import { getIrButton, getIrDevice } from "@/db/ir";
import {
  CLIMATE_MODES,
  CLIMATE_FANS,
  CLIMATE_SWINGS,
  type ClimatePatch,
} from "@/lib/ir-climate";
import type { ScheduleAction } from "@/lib/schedule";
import type { ScheduleInput } from "@/db/schedules";

type ParseResult =
  | { ok: true; value: Partial<ScheduleInput> }
  | { ok: false; error: string };

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

async function parseAction(
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

function parseDays(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  const set = new Set<number>();
  for (const d of raw) {
    const n = Math.trunc(Number(d));
    if (Number.isFinite(n) && n >= 0 && n <= 6) set.add(n);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * Validate a schedule create/update body. `partial` allows omitting fields
 * (PATCH); when an `action` is present, `deviceId` must be too so it can be
 * validated against the device kind.
 */
export async function parseScheduleBody(
  body: Record<string, unknown>,
  opts: { partial: boolean },
): Promise<ParseResult> {
  const value: Partial<ScheduleInput> = {};

  let deviceId = "";
  if ("deviceId" in body) {
    deviceId = typeof body.deviceId === "string" ? body.deviceId : "";
    if (!deviceId) return { ok: false, error: "Missing deviceId" };
    const dev = await getIrDevice(deviceId);
    if (!dev) return { ok: false, error: "Unknown device" };
    value.deviceId = deviceId;
  } else if (!opts.partial) {
    return { ok: false, error: "Missing deviceId" };
  }

  if ("action" in body) {
    if (!deviceId) return { ok: false, error: "action requires deviceId" };
    const action = await parseAction(body.action, deviceId);
    if (typeof action === "string") return { ok: false, error: action };
    value.action = action;
  } else if (!opts.partial) {
    return { ok: false, error: "Missing action" };
  }

  if ("atMinute" in body) {
    const m = Math.trunc(Number(body.atMinute));
    if (!Number.isFinite(m) || m < 0 || m > 1439)
      return { ok: false, error: "Invalid atMinute (expected 0–1439)" };
    value.atMinute = m;
  } else if (!opts.partial) {
    return { ok: false, error: "Missing atMinute" };
  }

  if ("days" in body) value.days = parseDays(body.days);
  else if (!opts.partial) value.days = [];

  if ("name" in body)
    value.name = typeof body.name === "string" ? body.name.trim().slice(0, 80) : "";
  if ("enabled" in body && typeof body.enabled === "boolean")
    value.enabled = body.enabled;

  return { ok: true, value };
}
