import mqtt, { type MqttClient } from "mqtt";
import { env } from "./env";
import {
  patchLiveState,
  publishLive,
  type DeviceState,
} from "./live-bus";
import { persistSession, persistEnvReading, getSettings } from "@/db/persist";
import { MIN_SESSION_HANG_MS } from "./detection";
import {
  getIrDevices,
  getIrButton,
  setIrClimateState,
  ensureIrSeed,
  type IrDeviceWithButtons,
} from "@/db/ir";
import {
  buildClimateCmd,
  buildButtonCmd,
  normalizeClimate,
  patchFromHaMode,
  DEFAULT_PANASONIC_CONFIG,
  type ClimatePatch,
  type IrClimateState,
} from "./ir-climate";
import {
  buildClimateDiscovery,
  buildButtonDiscovery,
  buildFanDiscovery,
  climateConfigTopic,
  buttonConfigTopic,
  fanConfigTopic,
  climateStateMessages,
  fanStateMessages,
  deriveFanMapping,
  parseHaCommandTopic,
  HA_COMMAND_FILTERS,
} from "./ha-discovery";
import type { IrDevice, IrButton } from "@/db/schema";

/**
 * Long-lived MQTT subscriber. Started once from instrumentation.ts. Bridges the
 * device to Postgres (persistence) and to browsers (live bus), and publishes
 * retained detection config so the device gets the latest thresholds on connect.
 */

const globalForMqtt = globalThis as unknown as { __mqttClient?: MqttClient };

function topics(deviceId: string) {
  return {
    telemetry: `pullup/${deviceId}/telemetry`,
    event: `pullup/${deviceId}/event`,
    status: `pullup/${deviceId}/status`,
    config: `pullup/${deviceId}/config`,
    env: `pullup/${deviceId}/env`,
    /** Server → device: one-shot IR command to transmit. */
    irCmd: `pullup/${deviceId}/ir/cmd`,
    /** Device → server: confirmation that an IR frame was sent. */
    irAck: `pullup/${deviceId}/ir/ack`,
    /** Server → device: firmware push {url, version, md5, size}. */
    ota: `pullup/${deviceId}/ota`,
    /** Device → server: OTA progress {phase, percent, version, error}. */
    otaStatus: `pullup/${deviceId}/ota/status`,
  };
}

type TelemetryMsg = {
  k?: string;
  distanceMm: number;
  state: DeviceState;
  /** Diagnostics (fw >= 1.3.2): raw VL53L0X range status + return signal MCps. */
  st?: number;
  sig?: number;
};
type EventMsg =
  | { k?: string; type: "session_start" }
  | { k?: string; type: "rep"; repNumber: number; upDurationMs: number; reps: number }
  | {
      k?: string;
      type: "session_end";
      reps: number;
      hangMs: number;
      durationMs: number;
      maxHangMs: number;
      repTimings?: { repNumber: number; offsetMs: number; upDurationMs: number }[];
    };
type StatusMsg = {
  k?: string;
  online: boolean;
  fw?: string;
  rssi?: number;
  /** Uptime in seconds (fw >= 1.4.0). */
  up?: number;
  /** Free heap in bytes (fw >= 1.4.0). */
  heap?: number;
  /** Device LAN IP (fw >= 1.4.0). */
  ip?: string;
};
type EnvMsg = { k?: string; tempC?: number; humidity?: number };
type IrAckMsg = { k?: string; ok?: boolean; kind?: string };
type OtaStatusMsg = {
  k?: string;
  phase?: "start" | "progress" | "success" | "error";
  percent?: number;
  version?: string;
  error?: string;
};

/** Verify the device shared-secret when present (defense in depth). */
function keyOk(k: string | undefined): boolean {
  if (!env.deviceKey) return true; // key not configured -> don't enforce
  return k === env.deviceKey;
}

export function startMqtt(): MqttClient {
  if (globalForMqtt.__mqttClient) return globalForMqtt.__mqttClient;

  const deviceId = env.deviceId;
  const t = topics(deviceId);

  const client = mqtt.connect(env.mqttUrl, {
    username: env.mqttUser || undefined,
    password: env.mqttPass || undefined,
    clientId: `pullup-server-${Math.floor(process.uptime() * 1000)}`,
    reconnectPeriod: 3000,
    clean: true,
  });

  globalForMqtt.__mqttClient = client;

  client.on("connect", async () => {
    console.log(`[mqtt] connected to ${env.mqttUrl}`);
    const subs = [t.telemetry, t.event, t.status, t.env, t.irAck, t.otaStatus];
    if (env.haDiscoveryEnabled) subs.push(...HA_COMMAND_FILTERS);
    client.subscribe(subs, { qos: 1 }, (err) => {
      if (err) console.error("[mqtt] subscribe error:", err);
    });
    await publishConfig();
    try {
      await ensureIrSeed(); // create the default IR devices on first run
    } catch (err) {
      console.error("[mqtt] ensureIrSeed failed:", err);
    }
    await publishHaDiscovery();
  });

  client.on("error", (err) => console.error("[mqtt] error:", err.message));
  client.on("reconnect", () => console.log("[mqtt] reconnecting…"));

  client.on("message", (topic, buf) => {
    // Home Assistant command topics carry plain-text payloads (e.g. "cool",
    // "24", "PRESS"), so they must be handled before the JSON parse below.
    const ha = parseHaCommandTopic(topic);
    if (ha) {
      void handleHaCommand(ha, buf.toString().trim());
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(buf.toString());
    } catch {
      console.warn("[mqtt] non-JSON payload on", topic);
      return;
    }

    if (topic === t.telemetry) handleTelemetry(payload as TelemetryMsg);
    else if (topic === t.event) void handleEvent(deviceId, payload as EventMsg);
    else if (topic === t.status) handleStatus(payload as StatusMsg);
    else if (topic === t.env) void handleEnv(deviceId, payload as EnvMsg);
    else if (topic === t.irAck) handleIrAck(payload as IrAckMsg);
    else if (topic === t.otaStatus) handleOtaStatus(payload as OtaStatusMsg);
  });

  return client;
}

function handleTelemetry(msg: TelemetryMsg) {
  if (!keyOk(msg.k)) return;
  const at = Date.now();
  // Phantom diagnostics: log any close reading with its raw sensor status +
  // signal. When nobody is on the bar, a <1000mm reading is a misfire — this
  // shows whether it came with a strong return (real reflection / electrical
  // garbage) or weak signal (noise), which tells us where the fault is.
  if (msg.distanceMm < 1000 && msg.st !== undefined) {
    console.log(
      `[telemetry] close d=${msg.distanceMm}mm state=${msg.state} status=${msg.st} sig=${msg.sig?.toFixed(2)}MCps`,
    );
  }
  patchLiveState({
    deviceOnline: true,
    state: msg.state,
    distanceMm: msg.distanceMm,
  });
  publishLive({ kind: "telemetry", distanceMm: msg.distanceMm, state: msg.state, at });
}

async function handleEvent(deviceId: string, msg: EventMsg) {
  if (!keyOk(msg.k)) return;
  const at = Date.now();

  if (msg.type === "session_start") {
    patchLiveState({
      state: "hanging",
      reps: 0,
      hangMs: 0,
      sessionStartedAt: at,
      deviceOnline: true,
    });
    publishLive({ kind: "session_start", at });
    return;
  }

  if (msg.type === "rep") {
    patchLiveState({ reps: msg.reps, state: "hanging" });
    publishLive({
      kind: "rep",
      repNumber: msg.repNumber,
      upDurationMs: msg.upDurationMs,
      at,
    });
    return;
  }

  if (msg.type === "session_end") {
    // Backstop against phantom sessions from sensor glitches (e.g. sunlight
    // briefly reading as a close target): a "workout" with at most one rep and
    // no sustained hang is almost never real training, so drop it before it
    // reaches the DB. A genuine set (2+ reps) or any real hang (>= the
    // min-session floor) always passes. This can occasionally discard a real
    // single quick rep done with almost no hang — an accepted trade to keep the
    // history phantom-free while the sensor-side cause is fixed. Tune the `<= 1`
    // here if it ever eats a rep you cared about.
    if (msg.reps <= 1 && msg.maxHangMs < MIN_SESSION_HANG_MS) {
      patchLiveState({ state: "idle", reps: 0, hangMs: 0, sessionStartedAt: null });
      console.log(
        `[mqtt] dropped phantom session (reps=${msg.reps}, maxHang=${msg.maxHangMs}ms, dur=${msg.durationMs}ms)`,
      );
      return;
    }

    // Convert device-relative durations into absolute timestamps using the
    // server clock (the ESP32 has no reliable wall clock).
    const endedAt = new Date(at);
    const startedAt = new Date(at - msg.durationMs);
    const repTimings = (msg.repTimings ?? []).map((r) => ({
      repNumber: r.repNumber,
      at: new Date(startedAt.getTime() + r.offsetMs).toISOString(),
      upDurationMs: r.upDurationMs,
    }));

    try {
      const { sessionId, brokenRecords } = await persistSession({
        deviceId,
        startedAt: startedAt.toISOString(),
        endedAt: endedAt.toISOString(),
        reps: msg.reps,
        hangMs: msg.hangMs,
        durationMs: msg.durationMs,
        maxHangMs: msg.maxHangMs,
        repTimings,
      });

      patchLiveState({
        state: "idle",
        reps: 0,
        hangMs: 0,
        sessionStartedAt: null,
      });
      publishLive({
        kind: "session_end",
        at,
        reps: msg.reps,
        hangMs: msg.hangMs,
        durationMs: msg.durationMs,
        maxHangMs: msg.maxHangMs,
        type: msg.reps > 0 ? "pullup_set" : "dead_hang",
        sessionId,
        brokenRecords,
      });
    } catch (err) {
      console.error("[mqtt] failed to persist session:", err);
    }
  }
}

function handleStatus(msg: StatusMsg) {
  if (!keyOk(msg.k)) return;
  const at = Date.now();
  const rssi = num(msg.rssi);
  const fwVersion = msg.fw ?? null;
  const uptimeSec = num(msg.up);
  const heapFree = num(msg.heap);
  const ipAddress = typeof msg.ip === "string" && msg.ip ? msg.ip : null;

  const patch: Parameters<typeof patchLiveState>[0] = {
    deviceOnline: msg.online,
    rssi,
    fwVersion,
    lastStatusAt: at,
  };
  // A last-will "offline" carries no telemetry; keep the last-known health.
  if (msg.online) {
    patch.uptimeSec = uptimeSec;
    patch.heapFree = heapFree;
    patch.ipAddress = ipAddress;
  } else {
    // Only force state to "offline" when going offline; keep it otherwise.
    patch.state = "offline";
  }
  patchLiveState(patch);
  publishLive({
    kind: "device_status",
    online: msg.online,
    at,
    rssi,
    fwVersion,
    uptimeSec: msg.online ? uptimeSec : null,
    heapFree: msg.online ? heapFree : null,
    ipAddress: msg.online ? ipAddress : null,
  });
}

/** OTA progress from the device during a firmware push — relay it to the console. */
function handleOtaStatus(msg: OtaStatusMsg) {
  if (!keyOk(msg.k)) return;
  const phase = msg.phase ?? "progress";
  console.log(
    `[ota] ${phase}${msg.percent != null ? ` ${msg.percent}%` : ""}` +
      `${msg.version ? ` v${msg.version}` : ""}${msg.error ? ` — ${msg.error}` : ""}`,
  );
  publishLive({
    kind: "ota_progress",
    phase,
    percent: num(msg.percent),
    version: msg.version ?? null,
    error: msg.error ?? null,
    at: Date.now(),
  });
}

/**
 * Ambient temperature/humidity from the on-bar DHT11. Always updates the live
 * state (so current temp shows regardless), but only persists a history row
 * when temperature logging is enabled in settings.
 */
async function handleEnv(deviceId: string, msg: EnvMsg) {
  if (!keyOk(msg.k)) return;
  const at = Date.now();
  const tempC = num(msg.tempC);
  const humidity = num(msg.humidity);
  if (tempC == null && humidity == null) return; // nothing usable

  patchLiveState({ tempC, humidity, deviceOnline: true });
  publishLive({ kind: "env", tempC, humidity, at });

  try {
    const s = await getSettings();
    if (s.tempLoggingEnabled) {
      await persistEnvReading({ deviceId, at: new Date(at), tempC, humidity });
    }
  } catch (err) {
    console.error("[mqtt] failed to persist env reading:", err);
  }
}

/** Coerce to a finite number or null (rejects NaN / non-numeric payloads). */
function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Publish the current detection thresholds + goals as a *retained* config
 * message so the device receives them immediately on (re)connect, and live
 * whenever settings change.
 */
export async function publishConfig() {
  const client = globalForMqtt.__mqttClient;
  if (!client || !client.connected) return;
  try {
    const s = await getSettings();
    const payload = JSON.stringify({
      ...s.thresholds,
      dailyGoalReps: s.dailyGoalReps,
      soundEnabled: s.soundEnabled,
      beepOnRep: s.beepOnRep,
      beepOnSessionEnd: s.beepOnSessionEnd,
    });
    client.publish(topics(s.deviceId).config, payload, { qos: 1, retain: true });
    console.log("[mqtt] published retained config");
  } catch (err) {
    console.error("[mqtt] publishConfig failed:", err);
  }
}

// ---------------------------------------------------------------------------
//  IR remote — publish commands down to the bar node, bridge acks + Home
//  Assistant. The device is a dumb transmitter; the server owns state.
// ---------------------------------------------------------------------------

/** Device confirmed it transmitted an IR frame — pulse the console. */
function handleIrAck(msg: IrAckMsg) {
  if (!keyOk(msg.k)) return;
  publishLive({ kind: "ir_ack", deviceId: null, ok: msg.ok !== false, at: Date.now() });
}

/** Publish one IR command to the device (QoS 1, not retained). */
function publishIrCmd(payload: object): boolean {
  const client = globalForMqtt.__mqttClient;
  if (!client || !client.connected) return false;
  const body = JSON.stringify({ k: env.deviceKey || undefined, ...payload });
  client.publish(topics(env.deviceId).irCmd, body, { qos: 1, retain: false });
  return true;
}

/**
 * Push a firmware image to the bar node. The device pulls the `.bin` from `url`
 * (served by this app), verifies `md5`, flashes it, and reboots. Not retained —
 * a push is a one-shot command, never replayed on reconnect.
 */
export function publishOtaCommand(cmd: {
  url: string;
  version: string;
  md5: string;
  size: number;
}): boolean {
  const client = globalForMqtt.__mqttClient;
  if (!client || !client.connected) return false;
  const body = JSON.stringify({ k: env.deviceKey || undefined, ...cmd });
  client.publish(topics(env.deviceId).ota, body, { qos: 1, retain: false });
  console.log(`[mqtt] pushed OTA v${cmd.version} (${cmd.size} bytes) -> ${cmd.url}`);
  return true;
}

/**
 * Apply a climate patch: persist the optimistic state, transmit the AC frame,
 * and broadcast the new state to the console (live bus) and Home Assistant.
 * Shared by the API route and the HA command handler. Returns the new state.
 */
export async function applyClimateAndBroadcast(
  deviceId: string,
  patch: ClimatePatch,
): Promise<IrClimateState | null> {
  const result = await setIrClimateState(deviceId, patch);
  if (!result) return null;
  const { device, state } = result;
  const config = device.config ?? DEFAULT_PANASONIC_CONFIG;

  publishIrCmd(buildClimateCmd(state, config));
  publishLive({ kind: "ir_state", deviceId, state, at: Date.now() });
  publishClimateStateToHa(deviceId, state);
  return state;
}

/** Fire a generic button by id. Returns false if the button is unknown. */
export async function fireIrButton(buttonId: string): Promise<boolean> {
  const button = await getIrButton(buttonId);
  if (!button) return false;
  return publishIrCmd(buildButtonCmd(button));
}

// Optimistic on/off + speed per fan device. IR is one-way, so this is best-effort
// and resets on restart (HA re-seeds it as off via the retained discovery state).
type FanState = { on: boolean; speed: number };
const fanStates = new Map<string, FanState>();

/**
 * Apply a fan command from HA: map on/off → the Power button (toggle) and a
 * speed (1..N) → the matching Speed button, then publish the new optimistic
 * state back. No-ops for devices whose buttons don't form a fan.
 */
async function applyFanCommand(
  deviceId: string,
  cmd: { on?: boolean; speed?: number },
): Promise<void> {
  const device = (await getIrDevices()).find((d) => d.id === deviceId);
  if (!device || device.kind !== "generic") return;
  const mapping = deriveFanMapping(device.buttons);
  if (!mapping) return;

  const prev = fanStates.get(deviceId) ?? { on: false, speed: 1 };
  let next: FanState = { ...prev };

  if (cmd.speed != null && Number.isFinite(cmd.speed)) {
    const idx =
      Math.min(mapping.speedButtonIds.length, Math.max(1, Math.round(cmd.speed))) - 1;
    const btnId = mapping.speedButtonIds[idx];
    if (btnId) {
      await fireIrButton(btnId);
      next = { on: true, speed: idx + 1 }; // setting a speed also powers the fan on
    }
  } else if (cmd.on != null && cmd.on !== prev.on) {
    await fireIrButton(mapping.powerButtonId); // Power is a toggle
    next.on = cmd.on;
  }

  fanStates.set(deviceId, next);
  publishFanStateToHa(deviceId, next);
}

/** Publish a fan's retained on/off + speed state to HA. */
function publishFanStateToHa(deviceId: string, state: FanState) {
  if (!env.haDiscoveryEnabled) return;
  const client = globalForMqtt.__mqttClient;
  if (!client || !client.connected) return;
  for (const m of fanStateMessages(deviceId, state)) {
    client.publish(m.topic, m.payload, { qos: 1, retain: true });
  }
}

/** Handle a command that arrived from Home Assistant on a server-owned topic. */
async function handleHaCommand(
  ha: ReturnType<typeof parseHaCommandTopic>,
  payload: string,
): Promise<void> {
  if (!ha) return;
  try {
    if (ha.kind === "fire") {
      await fireIrButton(ha.buttonId);
      return;
    }
    if (ha.kind === "fan_on") {
      await applyFanCommand(ha.deviceId, { on: payload.toUpperCase() !== "OFF" });
      return;
    }
    if (ha.kind === "fan_pct") {
      await applyFanCommand(ha.deviceId, { speed: Number(payload) });
      return;
    }
    let patch: ClimatePatch;
    if (ha.kind === "mode") patch = patchFromHaMode(payload);
    else if (ha.kind === "temp") patch = { tempC: Number(payload) };
    else if (ha.kind === "swing") patch = { swing: payload as IrClimateState["swing"] };
    else patch = { fan: payload as IrClimateState["fan"] };
    await applyClimateAndBroadcast(ha.deviceId, patch);
  } catch (err) {
    console.error("[mqtt] HA command failed:", err);
  }
}

/** Publish the retained HA state messages for a climate device. */
function publishClimateStateToHa(deviceId: string, state: IrClimateState) {
  if (!env.haDiscoveryEnabled) return;
  const client = globalForMqtt.__mqttClient;
  if (!client || !client.connected) return;
  for (const m of climateStateMessages(deviceId, state)) {
    client.publish(m.topic, m.payload, { qos: 1, retain: true });
  }
}

/**
 * Publish Home Assistant MQTT discovery for the whole IR catalog (retained), so
 * HA auto-creates a climate card per AC and a button per generic command. Also
 * seeds each climate device's current state. Called on connect and whenever the
 * catalog changes.
 */
export async function publishHaDiscovery(): Promise<void> {
  if (!env.haDiscoveryEnabled) return;
  const client = globalForMqtt.__mqttClient;
  if (!client || !client.connected) return;
  const prefix = env.haDiscoveryPrefix;

  let devices: IrDeviceWithButtons[];
  try {
    devices = await getIrDevices();
  } catch (err) {
    console.error("[mqtt] publishHaDiscovery: failed to read catalog:", err);
    return;
  }

  for (const device of devices) {
    if (device.kind === "climate") {
      const config = device.config ?? DEFAULT_PANASONIC_CONFIG;
      client.publish(
        climateConfigTopic(prefix, device.id),
        JSON.stringify(buildClimateDiscovery(device.id, device.name, config)),
        { qos: 1, retain: true },
      );
      publishClimateStateToHa(device.id, normalizeClimate(device.state, config));
    } else {
      // Promote Power + Speed N into one `fan`; keep any other buttons as buttons.
      const mapping = deriveFanMapping(device.buttons);
      const mapped = mapping
        ? new Set([mapping.powerButtonId, ...mapping.speedButtonIds])
        : new Set<string>();

      if (mapping) {
        client.publish(
          fanConfigTopic(prefix, device.id),
          JSON.stringify(
            buildFanDiscovery(device.id, device.name, mapping.speedButtonIds.length),
          ),
          { qos: 1, retain: true },
        );
        publishFanStateToHa(device.id, fanStates.get(device.id) ?? { on: false, speed: 1 });
      }

      for (const button of device.buttons) {
        const topic = buttonConfigTopic(prefix, button.id);
        if (mapped.has(button.id)) {
          // Now part of the fan entity — retire its standalone button in HA.
          client.publish(topic, "", { qos: 1, retain: true });
        } else {
          client.publish(
            topic,
            JSON.stringify(buildButtonDiscovery(button.id, device.name, button.label)),
            { qos: 1, retain: true },
          );
        }
      }
    }
  }
  console.log(`[mqtt] published HA discovery for ${devices.length} IR device(s)`);
}

/** Clear a removed device's / button's retained HA discovery config. */
export function clearHaDiscovery(entries: { kind: "climate" | "button"; id: string }[]): void {
  if (!env.haDiscoveryEnabled) return;
  const client = globalForMqtt.__mqttClient;
  if (!client || !client.connected) return;
  const prefix = env.haDiscoveryPrefix;
  for (const e of entries) {
    const topic =
      e.kind === "climate" ? climateConfigTopic(prefix, e.id) : buttonConfigTopic(prefix, e.id);
    client.publish(topic, "", { qos: 1, retain: true }); // empty retained = delete
  }
}

// Re-export row types so API routes can annotate without importing the schema.
export type { IrDevice, IrButton };
