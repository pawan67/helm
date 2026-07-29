import { describe, it, expect } from "vitest";
import {
  normalizeClimate,
  applyClimatePatch,
  buildClimateCmd,
  buildButtonCmd,
  haModeFromState,
  haModes,
  patchFromHaMode,
  haPresets,
  patchFromHaPreset,
  DEFAULT_PANASONIC_CONFIG,
  DEFAULT_CLIMATE_STATE,
  type IrClimateState,
} from "./ir-climate";

const cfg = DEFAULT_PANASONIC_CONFIG;

describe("normalizeClimate", () => {
  it("falls back to defaults for missing/invalid fields", () => {
    expect(normalizeClimate(null)).toEqual(DEFAULT_CLIMATE_STATE);
    expect(normalizeClimate({ mode: "nonsense" as never })).toMatchObject({ mode: "cool" });
    expect(normalizeClimate({ fan: "turbo" as never })).toMatchObject({ fan: "auto" });
  });

  it("clamps temperature into the configured range", () => {
    expect(normalizeClimate({ tempC: 5 }).tempC).toBe(cfg.tempMin);
    expect(normalizeClimate({ tempC: 99 }).tempC).toBe(cfg.tempMax);
    expect(normalizeClimate({ tempC: 23.6 }).tempC).toBe(24);
  });
});

describe("applyClimatePatch", () => {
  const base = DEFAULT_CLIMATE_STATE;

  it("toggles power without touching other fields", () => {
    const next = applyClimatePatch(base, { power: true }, cfg);
    expect(next).toMatchObject({ power: true, mode: "cool", tempC: 24, fan: "auto" });
  });

  it("applies mode/temp/fan and clamps temp", () => {
    const next = applyClimatePatch(base, { mode: "heat", tempC: 40, fan: "high" }, cfg);
    expect(next).toMatchObject({ mode: "heat", tempC: cfg.tempMax, fan: "high" });
  });

  it("ignores invalid values, keeping the current state", () => {
    const next = applyClimatePatch(base, { mode: "bogus" as never }, cfg);
    expect(next.mode).toBe(base.mode);
  });
});

describe("firmware command builders", () => {
  it("builds the climate command payload the firmware expects", () => {
    const state: IrClimateState = {
      power: true,
      mode: "cool",
      tempC: 22,
      fan: "low",
      swing: "auto",
      swingH: "middle",
      preset: "quiet",
    };
    expect(buildClimateCmd(state, cfg)).toEqual({
      t: "climate",
      model: "DKE",
      power: true,
      mode: "cool",
      tempC: 22,
      fan: "low",
      swing: "auto",
      swingH: "middle",
      preset: "quiet",
    });
  });

  it("strips a leading 0x from button codes", () => {
    expect(buildButtonCmd({ protocol: "NEC", code: "0xCF8976", bits: 32, repeats: 0 })).toEqual({
      t: "button",
      protocol: "NEC",
      code: "CF8976",
      bits: 32,
      repeats: 0,
    });
  });
});

describe("Home Assistant mode mapping", () => {
  it("reports off when powered down", () => {
    expect(haModeFromState({ ...DEFAULT_CLIMATE_STATE, power: false })).toBe("off");
  });

  it("maps our 'fan' mode to HA 'fan_only'", () => {
    expect(haModeFromState({ ...DEFAULT_CLIMATE_STATE, power: true, mode: "fan" })).toBe("fan_only");
    expect(haModes(cfg)).toContain("fan_only");
    expect(haModes(cfg)[0]).toBe("off");
  });

  it("turns an incoming HA mode into a state patch", () => {
    expect(patchFromHaMode("off")).toEqual({ power: false });
    expect(patchFromHaMode("cool")).toEqual({ power: true, mode: "cool" });
    expect(patchFromHaMode("fan_only")).toEqual({ power: true, mode: "fan" });
  });
});

describe("Home Assistant preset mapping", () => {
  it("advertises none/quiet/powerful presets", () => {
    expect(haPresets(cfg)).toEqual(["none", "quiet", "powerful"]);
  });

  it("turns a valid preset into a patch and rejects junk", () => {
    expect(patchFromHaPreset("quiet")).toEqual({ preset: "quiet" });
    expect(patchFromHaPreset("powerful")).toEqual({ preset: "powerful" });
    expect(patchFromHaPreset("bogus")).toEqual({ preset: "none" });
  });

  it("defaults presets/swingH for configs seeded before they existed", () => {
    const legacy = { ...DEFAULT_PANASONIC_CONFIG } as Record<string, unknown>;
    delete legacy.presets;
    delete legacy.swingsH;
    const state = normalizeClimate({ preset: "quiet", swingH: "left" }, legacy as never);
    expect(state.preset).toBe("quiet");
    expect(state.swingH).toBe("left");
  });
});
