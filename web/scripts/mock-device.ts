/*
 * Mock device — publishes synthetic MQTT telemetry + events exactly like the
 * ESP32 firmware, so you can exercise the live screen and persistence without
 * hardware.
 *
 *   pnpm mock-device            # one pull-up set (8 reps)
 *   pnpm mock-device reps 12    # a set of 12 reps
 *   pnpm mock-device hang 20    # a 20-second dead hang
 *   pnpm mock-device loop       # random sessions forever
 *
 * Reads MQTT settings from web/.env (or process.env). The published payloads
 * match those the firmware sends, driven by the same Detector as the tests.
 */
import mqtt from "mqtt";
import { Detector, type DetectionEvent } from "../src/lib/detection";
import { DEFAULT_THRESHOLDS } from "../src/db/schema";

try {
  // Node 22: load web/.env if present.
  (process as unknown as { loadEnvFile: (p?: string) => void }).loadEnvFile(".env");
} catch {
  /* no .env — rely on process.env */
}

const MQTT_URL = process.env.MQTT_URL ?? "mqtt://localhost:1883";
const MQTT_USER = process.env.MQTT_USER ?? process.env.MQTT_SERVER_USER ?? "server";
const MQTT_PASS = process.env.MQTT_PASS ?? process.env.MQTT_SERVER_PASS ?? "";
const DEVICE_ID = process.env.DEVICE_ID ?? "bar-01";
const DEVICE_KEY = process.env.DEVICE_KEY ?? "";

const T = DEFAULT_THRESHOLDS;
const base = `pullup/${DEVICE_ID}`;

const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USER || undefined,
  password: MQTT_PASS || undefined,
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function pub(topic: string, payload: object, retain = false) {
  client.publish(topic, JSON.stringify({ k: DEVICE_KEY, ...payload }), { qos: 1, retain });
}

// Detector translates our synthetic distance stream into firmware-shaped events.
const detector = new Detector(T);
let sessionStartAt: number | null = null;

function handleEvents(events: DetectionEvent[]) {
  for (const ev of events) {
    if (ev.type === "session_start") {
      sessionStartAt = ev.at;
      pub(`${base}/event`, { type: "session_start" });
      console.log("→ session_start");
    } else if (ev.type === "rep") {
      pub(`${base}/event`, {
        type: "rep",
        repNumber: ev.repNumber,
        upDurationMs: ev.upDurationMs,
        reps: ev.repNumber,
      });
      console.log(`→ rep #${ev.repNumber}`);
    } else if (ev.type === "session_end") {
      const start = sessionStartAt ?? ev.at - ev.durationMs;
      pub(`${base}/event`, {
        type: "session_end",
        reps: ev.reps,
        hangMs: ev.hangMs,
        durationMs: ev.durationMs,
        maxHangMs: ev.maxHangMs,
        repTimings: ev.repTimings.map((r) => ({
          repNumber: r.repNumber,
          offsetMs: r.at - start,
          upDurationMs: r.upDurationMs,
        })),
      });
      console.log(`→ session_end reps=${ev.reps} maxHang=${ev.maxHangMs}ms`);
      sessionStartAt = null;
    }
  }
}

const DT = 40; // ms per sample (~25 Hz)
let clock = 0;

async function emit(distanceMm: number) {
  clock += DT;
  const jittered = Math.max(30, distanceMm + Math.round((Math.sin(clock / 30) * 6)));
  const events = detector.push({ t: clock, distanceMm: jittered });
  pub(`${base}/telemetry`, { distanceMm: jittered, state: detector.state });
  handleEvents(events);
  await sleep(DT);
}

/** Ramp distance from -> to over `ms`. */
async function ramp(from: number, to: number, ms: number) {
  const steps = Math.max(1, Math.round(ms / DT));
  for (let i = 1; i <= steps; i++) {
    await emit(Math.round(from + ((to - from) * i) / steps));
  }
}

async function hold(dist: number, ms: number) {
  const steps = Math.round(ms / DT);
  for (let i = 0; i < steps; i++) await emit(dist);
}

async function idle(ms: number, dist = 1500) {
  await hold(dist, ms);
}

async function doReps(count: number) {
  await idle(500); // nobody there
  await ramp(1500, 700, 400); // grab the bar
  await hold(700, 500); // settle -> session starts
  for (let n = 0; n < count; n++) {
    await ramp(700, 120, 350); // pull up (crosses rep line)
    await hold(120, 500); // hold at the top (clears the 400ms min-rep floor)
    await ramp(120, 700, 350); // lower down (re-arms above hysteresis)
    await hold(720, 400); // brief hang between reps
  }
  await ramp(700, 1600, 400); // let go
  await idle(2200, 1600); // stay off -> session ends
}

async function doHang(seconds: number) {
  await idle(500);
  await ramp(1500, 650, 400); // grab
  await idle(seconds * 1000, 650); // hang still (no reps)
  await ramp(650, 1600, 400); // let go
  await idle(2200, 1600);
}

async function main() {
  await new Promise<void>((resolve, reject) => {
    client.on("connect", () => resolve());
    client.on("error", reject);
  });
  console.log(`mock-device connected to ${MQTT_URL} as ${DEVICE_ID}`);

  const [mode, arg] = process.argv.slice(2);

  if (mode === "loop") {
    // Random sessions forever.
    let n = 0;
    while (true) {
      if (n % 3 === 2) await doHang(8 + Math.floor(Math.random() * 20));
      else await doReps(4 + Math.floor(Math.random() * 10));
      n++;
      await idle(3000, 1600);
    }
  } else if (mode === "hang") {
    await doHang(Number(arg) || 15);
  } else {
    await doReps(mode === "reps" ? Number(arg) || 8 : 8);
  }

  await sleep(500);
  client.end();
  console.log("done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
