import { describe, it, expect } from "vitest";
import {
  buildClimateDiscovery,
  buildButtonDiscovery,
  buildFanDiscovery,
  deriveFanMapping,
  climateStateMessages,
  parseHaCommandTopic,
  climateTopics,
  buttonFireTopic,
} from "./ha-discovery";
import { DEFAULT_PANASONIC_CONFIG, DEFAULT_CLIMATE_STATE } from "./ir-climate";

describe("buildClimateDiscovery", () => {
  const d = buildClimateDiscovery("dev1", "Panasonic AC", DEFAULT_PANASONIC_CONFIG);

  it("wires command/state topics to the server-owned namespace", () => {
    expect(d.mode_command_topic).toBe("helm/ir/dev1/mode/set");
    expect(d.temperature_state_topic).toBe("helm/ir/dev1/temp/state");
    expect(d.fan_mode_command_topic).toBe("helm/ir/dev1/fan/set");
  });

  it("advertises off + fan_only modes and the temp range", () => {
    expect(d.modes).toContain("off");
    expect(d.modes).toContain("fan_only");
    expect(d.min_temp).toBe(16);
    expect(d.max_temp).toBe(30);
    expect(d.unique_id).toBe("helm_ir_climate_dev1");
  });
});

describe("buildClimateDiscovery preset modes", () => {
  it("advertises quiet/powerful preset modes on their own topic (no reserved 'none')", () => {
    const d = buildClimateDiscovery("dev1", "Panasonic AC", DEFAULT_PANASONIC_CONFIG);
    expect(d.preset_modes).toEqual(["quiet", "powerful"]);
    expect(d.preset_mode_command_topic).toBe("helm/ir/dev1/preset/set");
    expect(d.preset_mode_state_topic).toBe("helm/ir/dev1/preset/state");
  });
});

describe("deriveFanMapping + buildFanDiscovery", () => {
  const buttons = [
    { id: "p", label: "Power" },
    { id: "s1", label: "Speed 1" },
    { id: "s2", label: "Speed 2" },
    { id: "boost", label: "Boost" },
    { id: "sleep", label: "Sleep" },
    { id: "led", label: "LED" },
  ];

  it("promotes Boost/Sleep to presets and leaves LED as a plain button", () => {
    const m = deriveFanMapping(buttons)!;
    expect(m.powerButtonId).toBe("p");
    expect(m.speedButtonIds).toEqual(["s1", "s2"]);
    expect(m.presets).toEqual([
      { name: "Boost", buttonId: "boost" },
      { name: "Sleep", buttonId: "sleep" },
    ]);
  });

  it("adds preset_modes with a Normal idle entry to fan discovery", () => {
    const d = buildFanDiscovery("dev2", "Atomberg Fan", 2, ["Boost", "Sleep"]) as Record<string, unknown>;
    expect(d.preset_modes).toEqual(["Normal", "Boost", "Sleep"]);
    expect(d.preset_mode_command_topic).toBe("helm/fan/dev2/preset/set");
  });

  it("omits preset fields when there are no preset buttons", () => {
    const d = buildFanDiscovery("dev2", "Fan", 3) as Record<string, unknown>;
    expect(d.preset_modes).toBeUndefined();
  });
});

describe("buildButtonDiscovery", () => {
  it("uses the button fire topic and a press payload", () => {
    const b = buildButtonDiscovery("btn1", "Atomberg Fan", "Power");
    expect(b.command_topic).toBe("helm/ir/button/btn1/fire");
    expect(b.payload_press).toBe("PRESS");
    expect(b.name).toBe("Atomberg Fan Power");
    expect(b.unique_id).toBe("helm_ir_btn_btn1");
  });
});

describe("climateStateMessages", () => {
  it("emits mode/temp/fan/swing/preset state payloads", () => {
    const msgs = climateStateMessages("dev1", {
      ...DEFAULT_CLIMATE_STATE,
      power: true,
      mode: "cool",
      tempC: 21,
      fan: "high",
      swing: "auto",
      preset: "quiet",
    });
    expect(msgs).toEqual([
      { topic: climateTopics("dev1").modeState, payload: "cool" },
      { topic: climateTopics("dev1").tempState, payload: "21" },
      { topic: climateTopics("dev1").fanState, payload: "high" },
      { topic: climateTopics("dev1").swingState, payload: "auto" },
      { topic: climateTopics("dev1").presetState, payload: "quiet" },
    ]);
  });

  it("reports off in the mode state when powered down", () => {
    const [mode] = climateStateMessages("dev1", { ...DEFAULT_CLIMATE_STATE, power: false });
    expect(mode.payload).toBe("off");
  });
});

describe("parseHaCommandTopic", () => {
  it("parses climate set topics", () => {
    expect(parseHaCommandTopic("helm/ir/dev1/mode/set")).toEqual({ kind: "mode", deviceId: "dev1" });
    expect(parseHaCommandTopic("helm/ir/dev1/temp/set")).toEqual({ kind: "temp", deviceId: "dev1" });
    expect(parseHaCommandTopic("helm/ir/dev1/fan/set")).toEqual({ kind: "fan", deviceId: "dev1" });
    expect(parseHaCommandTopic("helm/ir/dev1/preset/set")).toEqual({ kind: "preset", deviceId: "dev1" });
  });

  it("parses fan set topics including preset", () => {
    expect(parseHaCommandTopic("helm/fan/f1/on/set")).toEqual({ kind: "fan_on", deviceId: "f1" });
    expect(parseHaCommandTopic("helm/fan/f1/pct/set")).toEqual({ kind: "fan_pct", deviceId: "f1" });
    expect(parseHaCommandTopic("helm/fan/f1/preset/set")).toEqual({ kind: "fan_preset", deviceId: "f1" });
  });

  it("parses button fire topics (not as a climate set)", () => {
    expect(parseHaCommandTopic(buttonFireTopic("btn9"))).toEqual({ kind: "fire", buttonId: "btn9" });
  });

  it("returns null for unrelated topics", () => {
    expect(parseHaCommandTopic("pullup/bar-01/telemetry")).toBeNull();
    expect(parseHaCommandTopic("helm/ir/dev1/mode/state")).toBeNull();
  });
});
