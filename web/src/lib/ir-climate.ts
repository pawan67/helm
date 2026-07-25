/**
 * Pure IR-climate logic — shared by the server (MQTT bridge, API, HA discovery)
 * and the client (remote UI, live provider). No Node.js imports so it can be
 * bundled into client components.
 *
 * Climate state is OPTIMISTIC / last-commanded: IR is one-way, so the AC never
 * reports back. Everything here is about translating a desired state into the
 * command the firmware sends, and into the strings Home Assistant expects.
 */

/** Canonical operating modes (power is tracked separately). */
export const CLIMATE_MODES = ["auto", "cool", "heat", "dry", "fan"] as const;
export type ClimateMode = (typeof CLIMATE_MODES)[number];

/** Canonical fan speeds (Panasonic supports min→max plus auto). */
export const CLIMATE_FANS = ["auto", "min", "low", "med", "high", "max"] as const;
export type ClimateFan = (typeof CLIMATE_FANS)[number];

/** Canonical vertical-swing positions. */
export const CLIMATE_SWINGS = [
  "auto",
  "highest",
  "high",
  "middle",
  "low",
  "lowest",
] as const;
export type ClimateSwing = (typeof CLIMATE_SWINGS)[number];

/** Panasonic remote models understood by IRremoteESP8266's IRPanasonicAc. */
export const PANASONIC_MODELS = ["DKE", "NKE", "LKE", "JKE", "CKP", "RKR"] as const;
export type PanasonicModel = (typeof PANASONIC_MODELS)[number];

/** Optimistic, last-commanded climate state stored on the device row. */
export type IrClimateState = {
  power: boolean;
  mode: ClimateMode;
  tempC: number;
  fan: ClimateFan;
  swing: ClimateSwing;
};

/** Capabilities of a climate device — drives both the UI and HA discovery. */
export type IrClimateConfig = {
  /** e.g. "PANASONIC_AC". */
  protocol: string;
  /** Panasonic remote model. */
  model: string;
  tempMin: number;
  tempMax: number;
  modes: ClimateMode[];
  fans: ClimateFan[];
  swings: ClimateSwing[];
};

export const DEFAULT_PANASONIC_CONFIG: IrClimateConfig = {
  protocol: "PANASONIC_AC",
  model: "DKE",
  tempMin: 16,
  tempMax: 30,
  modes: ["auto", "cool", "heat", "dry", "fan"],
  fans: ["auto", "min", "low", "med", "high", "max"],
  swings: ["auto", "highest", "high", "middle", "low", "lowest"],
};

export const DEFAULT_CLIMATE_STATE: IrClimateState = {
  power: false,
  mode: "cool",
  tempC: 24,
  fan: "auto",
  swing: "auto",
};

const clampInt = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(v)));

const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fallback;

/** Coerce an arbitrary object (DB jsonb, request body) into a valid state. */
export function normalizeClimate(
  raw: Partial<IrClimateState> | null | undefined,
  config: IrClimateConfig = DEFAULT_PANASONIC_CONFIG,
): IrClimateState {
  const base = { ...DEFAULT_CLIMATE_STATE };
  const r = raw ?? {};
  return {
    power: typeof r.power === "boolean" ? r.power : base.power,
    mode: oneOf(r.mode, config.modes, base.mode),
    tempC: clampInt(typeof r.tempC === "number" ? r.tempC : base.tempC, config.tempMin, config.tempMax),
    fan: oneOf(r.fan, config.fans, base.fan),
    swing: oneOf(r.swing, config.swings, base.swing),
  };
}

/** A partial change to a climate state (from the UI or Home Assistant). */
export type ClimatePatch = Partial<IrClimateState>;

/** Apply a validated patch on top of the current state. */
export function applyClimatePatch(
  current: IrClimateState,
  patch: ClimatePatch,
  config: IrClimateConfig = DEFAULT_PANASONIC_CONFIG,
): IrClimateState {
  return normalizeClimate(
    {
      power: patch.power ?? current.power,
      mode: patch.mode ?? current.mode,
      tempC: patch.tempC ?? current.tempC,
      fan: patch.fan ?? current.fan,
      swing: patch.swing ?? current.swing,
    },
    config,
  );
}

// ---------------------------------------------------------------------------
//  Firmware command builders — the exact JSON the ESP32 parses on ir/cmd.
// ---------------------------------------------------------------------------

export type ClimateCmd = {
  t: "climate";
  model: string;
  power: boolean;
  mode: ClimateMode;
  tempC: number;
  fan: ClimateFan;
  swing: ClimateSwing;
};

export function buildClimateCmd(state: IrClimateState, config: IrClimateConfig): ClimateCmd {
  return {
    t: "climate",
    model: config.model,
    power: state.power,
    mode: state.mode,
    tempC: state.tempC,
    fan: state.fan,
    swing: state.swing,
  };
}

export type ButtonCmd = {
  t: "button";
  protocol: string;
  code: string;
  bits: number;
  repeats: number;
};

export function buildButtonCmd(button: {
  protocol: string;
  code: string;
  bits: number;
  repeats: number;
}): ButtonCmd {
  return {
    t: "button",
    protocol: button.protocol,
    // Strip a leading 0x/0X so the firmware's strtoull(code, 16) always agrees.
    code: button.code.replace(/^0x/i, ""),
    bits: button.bits,
    repeats: button.repeats,
  };
}

// ---------------------------------------------------------------------------
//  Home Assistant mapping — HA climate uses "off" as a mode and "fan_only" for
//  what we call "fan". Everything else passes through.
// ---------------------------------------------------------------------------

/** The HA `mode` string for a state ("off" when powered down). */
export function haModeFromState(state: IrClimateState): string {
  if (!state.power) return "off";
  return state.mode === "fan" ? "fan_only" : state.mode;
}

/** The list of HA modes for discovery: "off" plus each supported mode. */
export function haModes(config: IrClimateConfig): string[] {
  return ["off", ...config.modes.map((m) => (m === "fan" ? "fan_only" : m))];
}

/** Turn an incoming HA `mode` command into a state patch. */
export function patchFromHaMode(mode: string): ClimatePatch {
  if (mode === "off") return { power: false };
  return { power: true, mode: (mode === "fan_only" ? "fan" : mode) as ClimateMode };
}
