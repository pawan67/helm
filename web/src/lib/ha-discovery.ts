/**
 * Pure Home Assistant MQTT-Discovery helpers. Builds the retained `config`
 * payloads that make HA auto-create a climate card for the AC and button
 * entities for a generic device, and parses the command topics HA publishes
 * back. No Node imports — the MQTT wiring lives in mqtt.ts and calls these.
 *
 * Command/state topics are SERVER-owned (namespaced under `helm/ir/…`) so preset
 * expansion and optimistic state stay server-side; HA and the HELM console then
 * stay in sync on the same broker.
 */
import {
  haModes,
  haModeFromState,
  type IrClimateConfig,
  type IrClimateState,
} from "./ir-climate";

/** Groups every HELM IR entity under one device in the HA UI. */
const HA_DEVICE = {
  identifiers: ["helm_bar_node"],
  name: "HELM Bar Node",
  manufacturer: "HELM",
  model: "bar-node",
} as const;

const ORIGIN = { name: "HELM" } as const;

/** Server-owned climate command/state topics for one device. */
export function climateTopics(deviceId: string) {
  const base = `helm/ir/${deviceId}`;
  return {
    modeSet: `${base}/mode/set`,
    modeState: `${base}/mode/state`,
    tempSet: `${base}/temp/set`,
    tempState: `${base}/temp/state`,
    fanSet: `${base}/fan/set`,
    fanState: `${base}/fan/state`,
  };
}

/** Server-owned fire topic for one generic button. */
export function buttonFireTopic(buttonId: string): string {
  return `helm/ir/button/${buttonId}/fire`;
}

/** Retained discovery config topic for a climate device. */
export function climateConfigTopic(prefix: string, deviceId: string): string {
  return `${prefix}/climate/helm/${deviceId}/config`;
}

/** Retained discovery config topic for a button. */
export function buttonConfigTopic(prefix: string, buttonId: string): string {
  return `${prefix}/button/helm/${buttonId}/config`;
}

export function buildClimateDiscovery(
  deviceId: string,
  name: string,
  config: IrClimateConfig,
) {
  const t = climateTopics(deviceId);
  return {
    name,
    unique_id: `helm_ir_climate_${deviceId}`,
    modes: haModes(config),
    mode_command_topic: t.modeSet,
    mode_state_topic: t.modeState,
    temperature_command_topic: t.tempSet,
    temperature_state_topic: t.tempState,
    min_temp: config.tempMin,
    max_temp: config.tempMax,
    temp_step: 1,
    fan_modes: config.fans,
    fan_mode_command_topic: t.fanSet,
    fan_mode_state_topic: t.fanState,
    device: HA_DEVICE,
    origin: ORIGIN,
  };
}

export function buildButtonDiscovery(
  buttonId: string,
  deviceName: string,
  buttonLabel: string,
) {
  return {
    name: `${deviceName} ${buttonLabel}`,
    unique_id: `helm_ir_btn_${buttonId}`,
    command_topic: buttonFireTopic(buttonId),
    payload_press: "PRESS",
    device: HA_DEVICE,
    origin: ORIGIN,
  };
}

/** The three retained state messages that report a climate state back to HA. */
export function climateStateMessages(
  deviceId: string,
  state: IrClimateState,
): { topic: string; payload: string }[] {
  const t = climateTopics(deviceId);
  return [
    { topic: t.modeState, payload: haModeFromState(state) },
    { topic: t.tempState, payload: String(state.tempC) },
    { topic: t.fanState, payload: state.fan },
  ];
}

/** MQTT topic filters the server must subscribe to catch HA commands. */
export const HA_COMMAND_FILTERS = [
  "helm/ir/+/mode/set",
  "helm/ir/+/temp/set",
  "helm/ir/+/fan/set",
  "helm/ir/button/+/fire",
] as const;

export type HaCommand =
  | { kind: "mode" | "temp" | "fan"; deviceId: string }
  | { kind: "fire"; buttonId: string };

/** Parse an incoming HA command topic into a structured command, or null. */
export function parseHaCommandTopic(topic: string): HaCommand | null {
  const parts = topic.split("/");
  // helm/ir/button/<id>/fire
  if (parts.length === 5 && parts[0] === "helm" && parts[1] === "ir" && parts[2] === "button" && parts[4] === "fire") {
    return { kind: "fire", buttonId: parts[3] };
  }
  // helm/ir/<id>/<mode|temp|fan>/set
  if (parts.length === 5 && parts[0] === "helm" && parts[1] === "ir" && parts[4] === "set") {
    const field = parts[3];
    if (field === "mode" || field === "temp" || field === "fan") {
      return { kind: field, deviceId: parts[2] };
    }
  }
  return null;
}
