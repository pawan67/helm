import mqtt, { type MqttClient } from "mqtt";
import { env } from "./env";
import {
  patchLiveState,
  publishLive,
  type DeviceState,
} from "./live-bus";
import { persistSession, getSettings } from "@/db/persist";

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
  };
}

type TelemetryMsg = { k?: string; distanceMm: number; state: DeviceState };
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
type StatusMsg = { k?: string; online: boolean; fw?: string; rssi?: number };

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
    client.subscribe([t.telemetry, t.event, t.status], { qos: 1 }, (err) => {
      if (err) console.error("[mqtt] subscribe error:", err);
    });
    await publishConfig();
  });

  client.on("error", (err) => console.error("[mqtt] error:", err.message));
  client.on("reconnect", () => console.log("[mqtt] reconnecting…"));

  client.on("message", (topic, buf) => {
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
  });

  return client;
}

function handleTelemetry(msg: TelemetryMsg) {
  if (!keyOk(msg.k)) return;
  const at = Date.now();
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
  const patch: Parameters<typeof patchLiveState>[0] = {
    deviceOnline: msg.online,
    rssi: msg.rssi ?? null,
    fwVersion: msg.fw ?? null,
  };
  // Only force state to "offline" when going offline; keep it otherwise.
  if (!msg.online) patch.state = "offline";
  patchLiveState(patch);
  publishLive({ kind: "device_status", online: msg.online, at: Date.now() });
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
    });
    client.publish(topics(s.deviceId).config, payload, { qos: 1, retain: true });
    console.log("[mqtt] published retained config");
  } catch (err) {
    console.error("[mqtt] publishConfig failed:", err);
  }
}
