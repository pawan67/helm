"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { LiveEvent, LiveState } from "@/lib/live-types";
import type { IrClimateState } from "@/lib/ir-climate";

type SessionEnd = Extract<LiveEvent, { kind: "session_end" }>;
type RepEvent = Extract<LiveEvent, { kind: "rep" }>;

type LiveContextValue = {
  state: LiveState;
  connected: boolean;
  /** Monotonic counter that increments on every rep — drives pop animations. */
  repTick: number;
  lastRep: RepEvent | null;
  /** The most recent finished session, for the summary overlay. */
  lastSessionEnd: SessionEnd | null;
  clearSessionEnd: () => void;
  /** Optimistic climate state per IR device (from the console or Home Assistant). */
  irClimate: Record<string, IrClimateState>;
  /** Monotonic counter that ticks each time the device confirms an IR send. */
  irAckTick: number;
};

const defaultState: LiveState = {
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

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LiveState>(defaultState);
  const [connected, setConnected] = useState(false);
  const [repTick, setRepTick] = useState(0);
  const [lastRep, setLastRep] = useState<RepEvent | null>(null);
  const [lastSessionEnd, setLastSessionEnd] = useState<SessionEnd | null>(null);
  const [irClimate, setIrClimate] = useState<Record<string, IrClimateState>>({});
  const [irAckTick, setIrAckTick] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource("/api/live");
    esRef.current = es;

    es.onopen = () => setConnected(true);
    es.onerror = () => setConnected(false);

    es.onmessage = (msg) => {
      let ev: LiveEvent;
      try {
        ev = JSON.parse(msg.data);
      } catch {
        return;
      }

      switch (ev.kind) {
        case "snapshot":
          setState(ev.state);
          break;
        case "telemetry":
          setState((s) => ({
            ...s,
            distanceMm: ev.distanceMm,
            state: ev.state,
            deviceOnline: true,
          }));
          break;
        case "session_start":
          setLastSessionEnd(null);
          setState((s) => ({
            ...s,
            state: "hanging",
            reps: 0,
            hangMs: 0,
            sessionStartedAt: ev.at,
            deviceOnline: true,
          }));
          break;
        case "rep":
          setLastRep(ev);
          setRepTick((n) => n + 1);
          setState((s) => ({ ...s, reps: ev.repNumber }));
          break;
        case "session_end":
          setLastSessionEnd(ev);
          setState((s) => ({
            ...s,
            state: "idle",
            reps: 0,
            hangMs: 0,
            sessionStartedAt: null,
          }));
          break;
        case "device_status":
          setState((s) => ({
            ...s,
            deviceOnline: ev.online,
            state: ev.online ? s.state : "offline",
          }));
          break;
        case "env":
          setState((s) => ({
            ...s,
            tempC: ev.tempC,
            humidity: ev.humidity,
            deviceOnline: true,
          }));
          break;
        case "ir_state":
          setIrClimate((m) => ({ ...m, [ev.deviceId]: ev.state }));
          break;
        case "ir_ack":
          setIrAckTick((n) => n + 1);
          break;
        default:
          break;
      }
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, []);

  return (
    <LiveContext.Provider
      value={{
        state,
        connected,
        repTick,
        lastRep,
        lastSessionEnd,
        clearSessionEnd: () => setLastSessionEnd(null),
        irClimate,
        irAckTick,
      }}
    >
      {children}
    </LiveContext.Provider>
  );
}

export function useLive(): LiveContextValue {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error("useLive must be used within <LiveProvider>");
  return ctx;
}
