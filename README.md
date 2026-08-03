# HELM — self-hosted home & body console

A self-hosted console for the physical systems under your own roof. One operator,
one server, no cloud account. Sensors around the house report to it and devices
take orders from it, all over MQTT, all yours.

Today it runs the **bar node**: an **ESP32** with a **VL53L0X** time-of-flight
sensor that detects pull-up reps and dead-hang time, a **DHT11** that reports room
temperature and humidity, and a **buzzer**. Everything streams live to a **Next.js**
console you can open from anywhere.

- **Live workout screen** — real-time rep counter, on-bar timer, and a distance
  gauge that shows the sensor beam, over SSE.
- **History + charts** — reps/day and hang-time/day over 7/30/90-day windows, plus
  edit or delete any recorded session (totals and records recompute automatically).
- **Climate** — room temperature and humidity, with 7-day (hourly) and 30-day
  (daily) trends.
- **Personal records** — most reps in a set / in a day, longest dead hang, with an
  on-the-bar celebration when you beat one.
- **Streaks & goals** — daily/weekly rep goals and streak tracking.
- **Buzzer + live tuning** — chirp on each rep and a jingle on session end (toggle
  in Settings), plus detection thresholds that push to the device instantly over
  MQTT, no reflashing.
- **Device health + OTA firmware** — a **Device** panel with live signal, uptime,
  free memory and IP, plus **over-the-air firmware updates**: upload a compiled
  `.bin` in the console and push it to the bar node, which verifies, flashes and
  reboots itself — no USB cable.

**Planned:** a **Remote** node (IR blaster) to command the TV, AC, and anything
else that speaks infrared, from the same console.

Single-user, password-protected. Deploys with Docker Compose (built for Dokploy).

## Architecture

```
ESP32 bar node   ──MQTT──▶  Mosquitto  ──sub──▶  Next.js server  ──SSE──▶  Browser
 VL53L0X (reps)             (broker)             (persists +               (live UI)
 DHT11 (climate)                                  relays)  ──▶  Postgres
 buzzer
```

The ESP32 runs the detection state machine locally **and** streams raw distance,
temperature, and humidity. The Next.js server subscribes to MQTT, persists finished
sessions and climate readings to Postgres, and relays live data to the browser over
Server-Sent Events. The detection logic lives in two mirrored places,
`web/src/lib/detection.ts` (reference + tests) and `firmware/helm/helm.ino`
(on-device), so the unit tests validate the on-device algorithm too.

See [`docs/superpowers/specs/2026-07-24-pullup-tracker-design.md`](docs/superpowers/specs/2026-07-24-pullup-tracker-design.md)
for the original bar-node design.

## Repository layout

```
web/                 Next.js 16 app (App Router, TS, Chakra UI v3, Drizzle)
  src/app/           pages + API routes
  src/lib/           detection, mqtt, live bus, auth, streaks, env series
  src/db/            schema, queries, persistence, migration runner
  scripts/           mock-device.ts (no-hardware simulator), seed-env.mjs
firmware/helm/       ESP32 Arduino sketch + config template + wiring guide
mosquitto/           broker config
docker-compose.yml   web + Postgres + Mosquitto
docs-site/           Fumadocs documentation site (hardware, firmware, console, integrations)
```

## Documentation

A full build & setup guide — hardware and pin mapping, flashing, the console, and
Google Home voice control — lives in [`docs-site/`](docs-site/README.md), a
[Fumadocs](https://fumadocs.dev) site. Run it with `cd docs-site && pnpm install &&
pnpm dev`.

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

# 4. No hardware? Simulate the bar node in another terminal:
pnpm mock-device reps 10    # a 10-rep set
pnpm mock-device hang 30    # a 30-second dead hang
pnpm mock-device env 20     # 20 climate readings
pnpm mock-device loop       # random sessions forever
pnpm seed-env 30            # backfill 30 days of climate history for charts
```

Or run the whole stack (db + broker + migrations + dev server) with `./dev.sh`
(add `--mock` to stream a simulated device alongside it).

For local Mosquitto without auth, a minimal `mosquitto/dev.conf` is just:
`listener 1883` + `allow_anonymous true`.

Tests and checks:

```bash
pnpm test         # detection state machine, streaks, env bucketing
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

## Flashing the bar node

Full details in [`firmware/README.md`](firmware/README.md). In short:

1. Wire the VL53L0X (I2C: SDA→GPIO21, SCL→GPIO22, mounted 10 cm above the bar
   center, pointing outward), the DHT11 (DATA→GPIO25), and the buzzer (→GPIO26).
2. In `firmware/helm/`, copy `config.example.h` → `config.h` and set WiFi + MQTT
   (`device` user) + `DEVICE_ID`/`DEVICE_KEY` (must match the web env).
3. Install libraries: Adafruit VL53L0X, PubSubClient, ArduinoJson v7, DHT sensor
   library (+ Adafruit Unified Sensor).
4. Upload `helm.ino` from the Arduino IDE.

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
| `DEVICE_ID` | web + firmware | Which node/device (topic namespace) |
| `DEVICE_KEY` | web + firmware | Shared secret in every device payload |
| `APP_TIMEZONE` | web | Local day for streaks/goals (e.g. `America/New_York`) |
| `OTA_BASE_URL` | web | *(optional)* URL the device downloads firmware from during an OTA push. Unset = derive from the browser's origin; set to the app's LAN IP if the device can't reach that |
