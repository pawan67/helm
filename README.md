# IRONHANG — Pull-up & Dead-Hang Tracker

A self-hosted, full-stack tracker for pull-ups and dead hangs. A **VL53L0X**
time-of-flight sensor on an **ESP32** detects reps and hang time at the bar and
streams them live to a **Next.js** web app you can open from anywhere.

- **Live workout screen** — real-time rep counter, on-bar timer, and a distance
  gauge that shows the sensor beam, updating over SSE.
- **History + charts** — reps/day and hang-time/day over 7/30/90-day windows.
- **Personal records** — most reps in a set / in a day, longest dead hang, with
  on-the-bar celebration when you beat one.
- **Streaks & goals** — daily/weekly rep goals and streak tracking.
- **Live threshold tuning** — adjust detection thresholds in the app; they push
  to the device instantly over MQTT, no reflashing.

Single-user, password-protected. Deploys with Docker Compose (built for Dokploy).

## Architecture

```
ESP32 + VL53L0X  ──MQTT──▶  Mosquitto  ──sub──▶  Next.js server  ──SSE──▶  Browser
   (detects reps,            (broker)              (persists +               (live UI)
    streams distance)                               relays)  ──▶  Postgres
```

The ESP32 runs the detection state machine locally **and** streams raw distance.
The Next.js server subscribes to MQTT, persists finished sessions to Postgres,
and relays live data to the browser over Server-Sent Events. The detection logic
lives in two mirrored places — `web/src/lib/detection.ts` (reference + tests) and
`firmware/pullup_tracker/pullup_tracker.ino` (on-device) — so the unit tests
validate the on-device algorithm too.

See [`docs/superpowers/specs/2026-07-24-pullup-tracker-design.md`](docs/superpowers/specs/2026-07-24-pullup-tracker-design.md)
for the full design.

## Repository layout

```
web/                 Next.js 15 app (App Router, TS, Tailwind v4, Drizzle)
  src/app/           pages + API routes
  src/lib/           detection, mqtt, live bus, auth, streaks
  src/db/            schema, queries, persistence, migration runner
  scripts/           mock-device.ts (no-hardware simulator)
firmware/            ESP32 Arduino sketch + config template + wiring guide
mosquitto/           broker config
docker-compose.yml   web + Postgres + Mosquitto
```

## Local development

Prereqs: Node 22, pnpm, Docker.

```bash
# 1. Start Postgres + Mosquitto (or use your own)
docker run -d --name pt-db  -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=pullups -p 5432:5432 postgres:16-alpine
docker run -d --name pt-mqtt -p 1883:1883 -v "$PWD/mosquitto/dev.conf:/mosquitto/config/mosquitto.conf" eclipse-mosquitto:2

# 2. Configure + install
cd web
cp .env.example .env        # then edit values (see below)
pnpm install

# 3. Migrate + run
pnpm db:migrate
pnpm dev                    # http://localhost:3000

# 4. No hardware? Simulate a device in another terminal:
pnpm mock-device reps 10    # a 10-rep set
pnpm mock-device hang 30    # a 30-second dead hang
pnpm mock-device loop       # random sessions forever
```

For local Mosquitto without auth, a minimal `mosquitto/dev.conf` is just:
`listener 1883` + `allow_anonymous true`.

Tests and checks:

```bash
pnpm test         # detection state machine + streak logic
pnpm typecheck
pnpm build
```

## Deployment (Dokploy)

1. **Point your domain** at your Dokploy host (an A record to the server IP).
2. **Create the MQTT password file** so the broker isn't open:
   ```bash
   # from the repo root
   docker run --rm -v "$PWD/mosquitto:/m" eclipse-mosquitto:2 \
     sh -c "mosquitto_passwd -b -c /m/passwd server 'YOUR_SERVER_PASS' && \
            mosquitto_passwd -b /m/passwd device 'YOUR_DEVICE_PASS'"
   ```
   This creates `mosquitto/passwd` with two users: `server` (the web app) and
   `device` (the ESP32).
3. **In Dokploy**, create a **Compose** app pointing at this repo. Set the
   environment variables from [`.env.example`](.env.example):
   `POSTGRES_PASSWORD`, `APP_PASSWORD`, `SESSION_SECRET` (`openssl rand -hex 32`),
   `MQTT_SERVER_USER`/`MQTT_SERVER_PASS` (must match the `server` user above),
   `DEVICE_ID`, `DEVICE_KEY`, `APP_TIMEZONE`.
4. **Deploy.** The `web` container runs migrations then starts. Map your domain
   to the `web` service (port 3000) in Dokploy, and make sure port **1883**
   (Mosquitto) is reachable from where your ESP32 lives.
5. **Log in** at your domain with `APP_PASSWORD`.

The web app applies database migrations automatically on every start
(`scripts/migrate-runner.mjs` runs before the server boots).

## Flashing the ESP32

Full details in [`firmware/README.md`](firmware/README.md). In short:

1. Wire the VL53L0X (I2C: SDA→GPIO21, SCL→GPIO22), mount it 10 cm above the bar
   center, pointing outward.
2. In `firmware/pullup_tracker/`, copy `config.example.h` → `config.h` and set
   WiFi + MQTT (`device` user) + `DEVICE_ID`/`DEVICE_KEY` (must match the web env).
3. Install libraries: Adafruit VL53L0X, PubSubClient, ArduinoJson v7.
4. Upload from the Arduino IDE.

## Calibration

Open **Settings** in the app (it shows the live distance reading). Hang, then
pull to chin-over-bar, and set the **Rep line** just above your top-of-rep
reading. Set **Presence range** below your standing height so sessions only start
when you're actually hanging. Changes save straight to the device over MQTT.

## Environment variables

| Var | Where | Purpose |
|-----|-------|---------|
| `APP_PASSWORD` | web | Login password |
| `SESSION_SECRET` | web | Signs the session cookie |
| `DATABASE_URL` | web | Postgres connection (set by compose) |
| `MQTT_URL` / `MQTT_USER` / `MQTT_PASS` | web | Broker + server credentials |
| `DEVICE_ID` | web + firmware | Which bar/device (topic namespace) |
| `DEVICE_KEY` | web + firmware | Shared secret in every device payload |
| `APP_TIMEZONE` | web | Local day for streaks/goals (e.g. `America/New_York`) |
