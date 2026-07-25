import { describe, it, expect } from "vitest";
import {
  buildClimateDiscovery,
  buildButtonDiscovery,
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
  it("emits mode/temp/fan state payloads", () => {
    const msgs = climateStateMessages("dev1", {
      ...DEFAULT_CLIMATE_STATE,
      power: true,
      mode: "cool",
      tempC: 21,
      fan: "high",
    });
    expect(msgs).toEqual([
      { topic: climateTopics("dev1").modeState, payload: "cool" },
      { topic: climateTopics("dev1").tempState, payload: "21" },
      { topic: climateTopics("dev1").fanState, payload: "high" },
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
  });

  it("parses button fire topics (not as a climate set)", () => {
    expect(parseHaCommandTopic(buttonFireTopic("btn9"))).toEqual({ kind: "fire", buttonId: "btn9" });
  });

  it("returns null for unrelated topics", () => {
    expect(parseHaCommandTopic("pullup/bar-01/telemetry")).toBeNull();
    expect(parseHaCommandTopic("helm/ir/dev1/mode/state")).toBeNull();
  });
});
