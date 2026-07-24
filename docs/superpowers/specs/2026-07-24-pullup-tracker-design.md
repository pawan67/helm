# Pull-up & Dead-Hang Tracker — Design Spec

**Date:** 2026-07-24
**Status:** Approved, building

## 1. Overview

A full-stack, self-hosted tracker for pull-ups and dead hangs. A VL53L0X
time-of-flight distance sensor on an ESP32 detects reps and hang time at the
bar and streams them live to a Next.js web app the user can open from anywhere.
Single-user, deployed on a public domain via Dokploy.

## 2. Hardware & Physical Setup

- **Sensor:** VL53L0X ToF distance sensor (reliable to ~1.2 m).
- **Mounting:** on the wall, 10 cm above the bar, centered, pointing **outward**
  toward the user's body.
- **Geometry:** hanging → head sits below the beam (far / hanging band). Pulling
  up → head rises into the beam, distance drops toward ~10 cm at the top.
- **MCU:** ESP32 (WiFi). Firmware in an Arduino `.ino` sketch, in-repo.

## 3. Detection (runs on ESP32)

Sample rate ~20–30 Hz, median-of-N smoothing to kill VL53L0X spikes.

**Tunable thresholds** (stored on device, overridable live from the app):
- `PRESENCE_MAX` — beyond this / no return = idle (nobody on bar).
- `HANG_BAND` — present but low = hanging.
- `REP_NEAR` — head close = top of a pull-up.
- `REP_HYSTERESIS`, `MIN_REP_MS`, `RELEASE_MS`, `PRESENCE_DEBOUNCE_MS`.

**State machine:**
```
IDLE ─(distance < PRESENCE_MAX, stable ~300ms)→ SESSION ACTIVE
SESSION ACTIVE:
  distance < REP_NEAR                      → REP_UP (armed)
  REP_UP then rises > REP_NEAR+hysteresis  → reps++, back to ACTIVE
  not mid-rep                              → accumulate hang_ms
  distance > PRESENCE_MAX for > RELEASE_MS → END SESSION
END SESSION → classify reps>0 ? pullup_set : dead_hang → publish summary
```

Anti-false-count: hysteresis on `REP_NEAR`, `MIN_REP_MS` floor, median smoothing,
debounced presence (someone walking past won't start a session).

`hang_ms` accumulates while on the bar and not mid-rep. `max_hang_ms` = longest
continuous hang within a session (drives the dead-hang PR).

## 4. Architecture (Hybrid: ESP32 detects + full raw telemetry)

```
ESP32 ──MQTT──▶ Mosquitto ──sub──▶ Next.js server ──SSE──▶ Browser
                                        │
                                        ▼
                                     Postgres
```

- ESP32 counts reps/times hangs locally AND streams full raw distance.
- Next.js server (long-running Node container) subscribes to MQTT via
  `instrumentation.ts`, persists sessions to Postgres, keeps a `liveState`
  snapshot + an in-process `EventEmitter` bus, and fans live data to browsers
  over **SSE**.
- Browser ↔ server: login session cookie. ESP32 ↔ broker: dedicated MQTT
  user/pass. Broker not exposed to the public browser.
- Single instance on Dokploy → in-memory bus is sufficient (no Redis).

**MQTT topics:**
- `pullup/<deviceId>/telemetry` — `{ts, distance_mm, state}` high-rate.
- `pullup/<deviceId>/event` — `{ts, type, sessionId, reps, hang_ms, ...}`
  (session start / rep / end-summary).
- `pullup/<deviceId>/status` — online/offline (MQTT Last-Will), fw version, RSSI.
- `pullup/<deviceId>/config` — retained; server publishes thresholds+goal so the
  device gets latest on connect and live updates when tuned from the app.

**Offline resilience:** ESP32 keeps counting if network blips; publishes the
completed session summary (QoS 1) on reconnect so it still lands in Postgres.

## 5. Data Model (Postgres, Drizzle ORM)

- **sessions**: id, device_id, type(`pullup_set`|`dead_hang`), started_at,
  ended_at, reps, hang_ms, duration_ms, max_hang_ms, created_at.
- **rep_events**: id, session_id FK, rep_number, at, up_duration_ms.
- **daily_stats** (rollup, rebuildable): date PK, total_reps, total_hang_ms,
  sessions_count, goal_reps.
- **personal_records**: record_type(`most_reps_set`|`most_reps_day`|
  `longest_hang`), value, session_id, achieved_at.
- **settings** (single row): daily_goal_reps, weekly_goal_reps, detection
  thresholds, device_id.

Source of truth = sessions + rep_events. daily_stats & personal_records are
recomputed from them. Streaks computed from daily_stats (consecutive days
meeting goal).

## 6. Web App (Next.js 15 App Router, TS, Tailwind v4)

- **Auth:** single password (env `APP_PASSWORD`), signed session cookie (`jose`
  JWT), middleware-protected. `/login` page.
- **Pages:**
  - `/` Dashboard — today's reps vs goal, streak, quick stats, recent sessions.
  - `/live` Live workout — real-time rep counter, hang timer, live distance
    graph, current state, PR-beat celebration. Reads `/api/live` SSE.
  - `/history` — session list + charts (reps/day, hang/day) over time (Recharts).
  - `/records` — PRs with when-achieved.
  - `/settings` — goals + detection thresholds (writes settings → publishes
    retained MQTT config), device status.
- **API routes:**
  - `GET /api/live` — SSE stream (snapshot + live events).
  - `GET /api/sessions`, `GET /api/stats`, `GET /api/records`.
  - `GET/PUT /api/settings`.
  - `POST /api/auth/login`, `POST /api/auth/logout`.
- **Server MQTT** started once in `instrumentation.ts`; message handlers update
  `liveState`, persist on `end`, recompute rollups/PRs, emit to live bus.

**Design direction:** polished, athletic, dark theme with an energetic accent;
big legible live numbers; smooth count-up animations; not a generic dashboard.
Uses the frontend-design skill.

## 7. Firmware (Arduino `.ino`)

- Libraries: `Adafruit_VL53L0X`, `WiFi`, `PubSubClient` (MQTT), `ArduinoJson`.
- Config header for WiFi + MQTT creds + device id + default thresholds.
- Loop: read → smooth → state machine → publish telemetry + events. Subscribes
  to retained `config` topic to update thresholds live. MQTT Last-Will for
  offline status. Reconnect logic for WiFi + MQTT.

## 8. Deployment (Docker Compose → Dokploy)

- **Services:** `web` (Next.js standalone, multi-stage Dockerfile), `db`
  (Postgres, volume), `mqtt` (Mosquitto, config + password file).
- Next `output: 'standalone'`; migrations run on start.
- Env: `DATABASE_URL`, `APP_PASSWORD`, `SESSION_SECRET`, `MQTT_URL`,
  `MQTT_USER`, `MQTT_PASS`, `DEVICE_ID`, `DEVICE_KEY`.
- README covers: flashing the ESP32, pointing the domain at Dokploy, setting env
  vars, provisioning Postgres via compose, Mosquitto password setup, calibrating
  thresholds.

## 9. Testing

- Unit-test the detection state machine (ported logic) and stats/PR/streak
  computations with synthetic distance traces.
- Typecheck + production build must pass.
- A `mock-device` script that publishes synthetic MQTT telemetry so the live
  screen + persistence can be exercised without hardware.

## 10. Out of Scope (YAGNI)

Multi-user accounts, OAuth, mobile native app, multiple devices, social features.
