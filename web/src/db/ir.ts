import { eq, asc, sql as dsql } from "drizzle-orm";
import { db } from "./index";
import {
  irDevices,
  irButtons,
  type IrDevice,
  type IrButton,
  type NewIrButton,
} from "./schema";
import {
  DEFAULT_PANASONIC_CONFIG,
  DEFAULT_CLIMATE_STATE,
  normalizeClimate,
  applyClimatePatch,
  type IrClimateState,
  type ClimatePatch,
} from "@/lib/ir-climate";

/**
 * Data access for the IR remote catalog. Devices are either a `climate` device
 * (optimistic state on the row) or a `generic` device (a set of `ir_buttons`).
 */

export type IrDeviceWithButtons = IrDevice & { buttons: IrButton[] };

/** Every device with its buttons, ordered for stable rendering. */
export async function getIrDevices(): Promise<IrDeviceWithButtons[]> {
  const devices = await db
    .select()
    .from(irDevices)
    .orderBy(asc(irDevices.sortOrder), asc(irDevices.createdAt));
  const buttons = await db
    .select()
    .from(irButtons)
    .orderBy(asc(irButtons.sortOrder), asc(irButtons.label));

  const byDevice = new Map<string, IrButton[]>();
  for (const b of buttons) {
    const list = byDevice.get(b.deviceId) ?? [];
    list.push(b);
    byDevice.set(b.deviceId, list);
  }
  return devices.map((d) => ({ ...d, buttons: byDevice.get(d.id) ?? [] }));
}

export async function getIrDevice(id: string): Promise<IrDevice | null> {
  const [row] = await db.select().from(irDevices).where(eq(irDevices.id, id));
  return row ?? null;
}

export async function getIrButton(id: string): Promise<IrButton | null> {
  const [row] = await db.select().from(irButtons).where(eq(irButtons.id, id));
  return row ?? null;
}

// ---------------------------------------------------------------------------
//  Seeding — one Panasonic AC + one Atomberg fan, only when the catalog is
//  empty (mirrors the lazy-default getSettings() pattern). Everything is
//  editable in-app afterwards; the codes are presets, not sensor-verified.
// ---------------------------------------------------------------------------

/** Published Atomberg Gorilla Efficio NEC codes (32-bit). Editable in the UI. */
const ATOMBERG_BUTTONS: { label: string; icon: string; code: string }[] = [
  { label: "Power", icon: "power", code: "00CF8976" },
  { label: "Speed 1", icon: "gauge", code: "00CFD12E" },
  { label: "Speed 2", icon: "gauge", code: "00CF09F6" },
  { label: "Speed 3", icon: "gauge", code: "00CF51AE" },
  { label: "Speed 4", icon: "gauge", code: "00CFC936" },
  { label: "Speed 5", icon: "gauge", code: "00CF11EE" },
  { label: "Boost", icon: "zap", code: "00CFF10E" },
  { label: "Sleep", icon: "moon", code: "00CF718E" },
  { label: "Timer", icon: "timer", code: "00CF6996" },
  { label: "LED", icon: "lightbulb", code: "00CFE916" },
];

export async function ensureIrSeed(): Promise<void> {
  const [{ count }] = await db
    .select({ count: dsql<number>`count(*)::int` })
    .from(irDevices);
  if (count > 0) return;

  const [ac] = await db
    .insert(irDevices)
    .values({
      name: "Panasonic AC",
      kind: "climate",
      icon: "air-vent",
      protocol: DEFAULT_PANASONIC_CONFIG.protocol,
      config: DEFAULT_PANASONIC_CONFIG,
      state: DEFAULT_CLIMATE_STATE,
      sortOrder: 0,
    })
    .returning({ id: irDevices.id });

  const [fan] = await db
    .insert(irDevices)
    .values({
      name: "Atomberg Fan",
      kind: "generic",
      icon: "fan",
      protocol: "NEC",
      config: null,
      state: null,
      sortOrder: 1,
    })
    .returning({ id: irDevices.id });

  void ac; // referenced for clarity; only the fan gets seeded buttons
  await db.insert(irButtons).values(
    ATOMBERG_BUTTONS.map((b, i) => ({
      deviceId: fan.id,
      label: b.label,
      icon: b.icon,
      protocol: "NEC",
      code: b.code,
      bits: 32,
      repeats: 0,
      sortOrder: i,
    })),
  );
}

// ---------------------------------------------------------------------------
//  Climate state (optimistic)
// ---------------------------------------------------------------------------

/**
 * Apply a patch to a climate device's optimistic state and persist it. Returns
 * the device row plus the resolved config/state, or null if the device is
 * missing or not a climate device.
 */
export async function setIrClimateState(
  deviceId: string,
  patch: ClimatePatch,
): Promise<{ device: IrDevice; state: IrClimateState } | null> {
  const device = await getIrDevice(deviceId);
  if (!device || device.kind !== "climate") return null;

  const config = device.config ?? DEFAULT_PANASONIC_CONFIG;
  const current = normalizeClimate(device.state, config);
  const next = applyClimatePatch(current, patch, config);

  const [row] = await db
    .update(irDevices)
    .set({ state: next, updatedAt: new Date() })
    .where(eq(irDevices.id, deviceId))
    .returning();

  return { device: row, state: next };
}

// ---------------------------------------------------------------------------
//  Device / button CRUD
// ---------------------------------------------------------------------------

export type IrDevicePatch = {
  name?: string;
  icon?: string;
  protocol?: string;
  config?: IrDevice["config"];
  sortOrder?: number;
};

export async function createIrDevice(input: {
  name: string;
  kind: "climate" | "generic";
  icon?: string;
  protocol?: string;
}): Promise<IrDevice> {
  const isClimate = input.kind === "climate";
  const [row] = await db
    .insert(irDevices)
    .values({
      name: input.name,
      kind: input.kind,
      icon: input.icon ?? (isClimate ? "air-vent" : "tv"),
      protocol: input.protocol ?? (isClimate ? DEFAULT_PANASONIC_CONFIG.protocol : "NEC"),
      config: isClimate ? DEFAULT_PANASONIC_CONFIG : null,
      state: isClimate ? DEFAULT_CLIMATE_STATE : null,
    })
    .returning();
  return row;
}

export async function updateIrDevice(id: string, patch: IrDevicePatch): Promise<IrDevice | null> {
  const [row] = await db
    .update(irDevices)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(irDevices.id, id))
    .returning();
  return row ?? null;
}

export async function deleteIrDevice(id: string): Promise<boolean> {
  const rows = await db.delete(irDevices).where(eq(irDevices.id, id)).returning({ id: irDevices.id });
  return rows.length > 0;
}

export type IrButtonPatch = Partial<Omit<NewIrButton, "id" | "deviceId">>;

export async function createIrButton(input: {
  deviceId: string;
  label: string;
  icon?: string;
  protocol?: string;
  code: string;
  bits?: number;
  repeats?: number;
  sortOrder?: number;
}): Promise<IrButton> {
  const [row] = await db
    .insert(irButtons)
    .values({
      deviceId: input.deviceId,
      label: input.label,
      icon: input.icon ?? "dot",
      protocol: input.protocol ?? "NEC",
      code: input.code,
      bits: input.bits ?? 32,
      repeats: input.repeats ?? 0,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateIrButton(id: string, patch: IrButtonPatch): Promise<IrButton | null> {
  const [row] = await db.update(irButtons).set(patch).where(eq(irButtons.id, id)).returning();
  return row ?? null;
}

export async function deleteIrButton(id: string): Promise<boolean> {
  const rows = await db.delete(irButtons).where(eq(irButtons.id, id)).returning({ id: irButtons.id });
  return rows.length > 0;
}
