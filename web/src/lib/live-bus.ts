import { EventEmitter } from "node:events";
import type { DeviceState, LiveState, LiveEvent } from "./live-types";

/**
 * In-process pub/sub bridging the MQTT subscriber (producer) and the SSE route
 * handlers (consumers). Single-instance deployment, so an in-memory bus is
 * sufficient — no Redis. A module-level singleton survives Next.js hot reloads
 * via globalThis.
 */

export type { DeviceState, LiveState, LiveEvent } from "./live-types";

type Bus = {
  emitter: EventEmitter;
  state: LiveState;
};

const initialState: LiveState = {
  deviceOnline: false,
  state: "offline",
  distanceMm: null,
  reps: 0,
  hangMs: 0,
  sessionStartedAt: null,
  rssi: null,
  fwVersion: null,
  tempC: null,
  humidity: null,
  updatedAt: 0,
};

const globalForBus = globalThis as unknown as { __liveBus?: Bus };

function getBus(): Bus {
  if (!globalForBus.__liveBus) {
    const emitter = new EventEmitter();
    // Many SSE clients could subscribe; lift the default cap.
    emitter.setMaxListeners(100);
    globalForBus.__liveBus = { emitter, state: { ...initialState } };
  }
  return globalForBus.__liveBus;
}

export function getLiveState(): LiveState {
  return getBus().state;
}

export function patchLiveState(patch: Partial<LiveState>) {
  const bus = getBus();
  bus.state = { ...bus.state, ...patch, updatedAt: Date.now() };
}

export function publishLive(event: LiveEvent) {
  getBus().emitter.emit("event", event);
}

export function subscribeLive(listener: (event: LiveEvent) => void): () => void {
  const bus = getBus();
  bus.emitter.on("event", listener);
  return () => bus.emitter.off("event", listener);
}
