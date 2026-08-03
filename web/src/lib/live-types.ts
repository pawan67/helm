/**
 * Shared types for the live data stream. Kept free of any Node.js imports so
 * both server (live-bus, mqtt) and client (LiveProvider) can import them.
 */
import type { IrClimateState } from "./ir-climate";

export type DeviceState = "idle" | "hanging" | "rep_up" | "offline";

export type LiveState = {
  deviceOnline: boolean;
  state: DeviceState;
  distanceMm: number | null;
  reps: number;
  hangMs: number;
  sessionStartedAt: number | null;
  rssi: number | null;
  fwVersion: string | null;
  /** Device uptime in seconds (from the status heartbeat), null until first read. */
  uptimeSec: number | null;
  /** Free heap in bytes (from the status heartbeat). */
  heapFree: number | null;
  /** Device LAN IP address (from the status heartbeat). */
  ipAddress: string | null;
  /** Server receive time (epoch ms) of the last status heartbeat. */
  lastStatusAt: number | null;
  /** Latest ambient temperature (°C) from the on-bar DHT11, null until first read. */
  tempC: number | null;
  /** Latest relative humidity (%), null until first read. */
  humidity: number | null;
  updatedAt: number;
};

/** OTA lifecycle phase reported by the device during a firmware push. */
export type OtaPhase = "start" | "progress" | "success" | "error";

export type LiveEvent =
  | { kind: "snapshot"; state: LiveState }
  | { kind: "telemetry"; distanceMm: number; state: DeviceState; at: number }
  | { kind: "session_start"; at: number }
  | { kind: "rep"; repNumber: number; upDurationMs: number; at: number }
  | {
      kind: "session_end";
      at: number;
      reps: number;
      hangMs: number;
      durationMs: number;
      maxHangMs: number;
      type: "pullup_set" | "dead_hang";
      sessionId: string;
      brokenRecords: string[];
    }
  | {
      kind: "device_status";
      online: boolean;
      at: number;
      rssi: number | null;
      fwVersion: string | null;
      uptimeSec: number | null;
      heapFree: number | null;
      ipAddress: string | null;
    }
  | {
      kind: "ota_progress";
      phase: OtaPhase;
      percent: number | null;
      version: string | null;
      error: string | null;
      at: number;
    }
  | { kind: "env"; tempC: number | null; humidity: number | null; at: number }
  /** A climate device's optimistic state changed (from the console or HA). */
  | { kind: "ir_state"; deviceId: string; state: IrClimateState; at: number }
  /** The device confirmed it transmitted an IR command. */
  | { kind: "ir_ack"; deviceId: string | null; ok: boolean; at: number }
  /** A remote frame was captured in learn mode (auto-fills a button). */
  | { kind: "ir_learned"; protocol: string; code: string; bits: number; at: number }
  | { kind: "heartbeat" };

export const RECORD_LABELS: Record<string, string> = {
  most_reps_set: "Most reps in a set",
  most_reps_day: "Most reps in a day",
  longest_hang: "Longest dead hang",
};
