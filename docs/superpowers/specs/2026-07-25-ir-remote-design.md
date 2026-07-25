# IR Remote (Infrared Blaster) — Design Spec

**Date:** 2026-07-25
**Status:** Approved, building

## 1. Overview

Add infrared control to HELM so the operator can command IR devices from the
`/remote` console page (already stubbed "soon") and from Home Assistant. The IR
LEDs are driven by the **existing bar node** (same ESP32), so no multi-device
plumbing is needed — the bar node gains a transmit capability alongside its
detection/climate/buzzer duties.

Two devices at launch:

| # | Device | Kind | Path |
|---|--------|------|------|
| 1 | **Panasonic AC** | `climate` | `IRPanasonicAc` preset → climate card + HA `climate` entity |
| 2 | **Atomberg BLDC fan** | `generic` | NEC button set → button grid + HA `button` entities |

No IR receiver in hand, so codes come from **presets** (Panasonic protocol +
published Atomberg NEC codes). The schema/firmware are built so a future receiver
"learn" flow drops in without migration.

## 2. Hardware

Transmit-only blaster off the bar node's spare GPIO:

- **GPIO27** → 220Ω → **2N2222 base**; IR LED string (+ current-limit resistor)
  from the **5V rail → collector**; **emitter → GND**; **470µF** across the LED
  supply rails to buffer the current spikes when the LEDs pulse.
- GPIO27 is free (21/22 = I2C, 25 = DHT, 26 = buzzer) and RMT-capable.
- Existing sensors/buzzer are unchanged.

## 3. Firmware (`firmware/helm/helm.ino`)

- Add **IRremoteESP8266** (ESP32-compatible). `#define IR_LED_PIN 27`.
  - `IRsend irsend(IR_LED_PIN)` for generic protocols (`irsend.send(strToDecodeType(proto), code, bits, repeats)`).
  - `IRPanasonicAc ac(IR_LED_PIN)` for the AC (`setModel/setPower/setMode/setTemp/setFan/send`).
- Subscribe to a new command topic **`pullup/<id>/ir/cmd`** (QoS1, not retained).
  Two payload shapes:
  - `{"t":"climate","model":"DKE","power":true,"mode":"cool","tempC":24,"fan":"auto","swing":"auto"}`
  - `{"t":"button","protocol":"NEC","code":"00CF8976","bits":32,"repeats":0}`
  - (future) `{"t":"raw","freq":38000,"timings":[...]}` — schema-reserved, not sent in v1.
- **Never disturbs rep detection:** incoming commands enqueue in a small FIFO and
  transmit only when `state == IDLE` (same gating idea the DHT read uses). A
  Panasonic frame is ~130–200 ms; you are never firing the AC mid-set anyway.
- After a send, publish **`pullup/<id>/ir/ack`** `{"k":…,"ok":true,"kind":"climate|button"}`.
- Bump `FW_VERSION` to `1.2.0`. `config.h` is unchanged (pin is compiled in).

## 4. Data Model (Postgres, Drizzle) — new migration `0002`

`ir_device_kind` enum = `climate | generic`.

- **ir_devices**: id (uuid), name, kind, icon (lucide key), protocol
  (`PANASONIC_AC` / `NEC` / …), `config` jsonb (climate capabilities: model,
  tempMin/Max, modes[], fans[]), `state` jsonb (climate optimistic state:
  `{power,mode,tempC,fan,swing}`; null for generic), sortOrder, timestamps.
- **ir_buttons**: id, deviceId FK (cascade), label, icon, protocol (default
  `NEC`), code (hex string, no `0x`), bits (default 32), repeats, sortOrder.

Climate state is **optimistic / last-commanded** (IR is one-way; the AC never
reports back). The UI labels it *commanded, not verified*.

**Seeding:** `ensureIrSeed()` runs on first `/remote` read (mirrors the
`getSettings()` lazy-default pattern). Inserts the Panasonic AC + Atomberg fan
with the published NEC button set (power, speeds 1–5, boost, sleep, timer, LED)
only when the table is empty. All values editable in-app.

## 5. Server

- **`web/src/db/ir.ts`** — `getIrDevices()` (+buttons), `ensureIrSeed()`,
  device/button CRUD, `setIrClimateState(deviceId, patch)`.
- **`web/src/lib/ir-climate.ts`** (pure, node-free): climate tokens, `normalizeClimate`,
  `applyClimatePatch` (clamps temp, validates mode/fan, power), `buildClimateCmd`,
  `buildButtonCmd`, HA `mode`↔state mapping. Unit-tested.
- **`web/src/lib/ha-discovery.ts`** (pure, node-free): `buildClimateDiscovery`,
  `buildButtonDiscovery`, HA topic helpers, `parseHaCommandTopic`. Unit-tested.
- **`web/src/lib/mqtt.ts`**: `publishIrClimate`/`publishIrButton` → `ir/cmd`;
  subscribe `ir/ack` → live bus; on connect, `publishHaDiscovery()` and subscribe
  the HA command wildcards; translate HA sets/fires → DB + IR cmd + state publish.
- **`web/src/lib/env.ts`**: `haDiscoveryEnabled` (default true), `haDiscoveryPrefix`
  (default `homeassistant`).

## 6. API routes (Node runtime, auth via `proxy.ts`)

- `POST /api/remote/climate` — `{deviceId, patch}`: normalize → persist optimistic
  state → publish IR cmd → publish `ir_state` to live bus → publish HA state.
- `POST /api/remote/fire` — `{buttonId}`: look up → publish IR cmd (fire-and-forget).
- `POST /api/remote/devices`, `PATCH|DELETE /api/remote/devices/[id]`.
- `POST /api/remote/buttons`, `PATCH|DELETE /api/remote/buttons/[id]`.
- Any catalog mutation re-publishes HA discovery.

## 7. Home Assistant (MQTT Discovery, no ESPHome)

On MQTT connect + on catalog change, publish **retained** discovery under
`<prefix>/…/config`:

- **climate** entity per AC → HA card (modes incl. `off`; `off` = power off,
  Panasonic `fan` = HA `fan_only`), temp min/max/step, fan modes.
- **button** entity per generic button.

Command topics are **server-owned** (`helm/ir/<id>/mode|temp|fan/set`,
`helm/ir/button/<id>/fire`) so preset expansion + optimistic state happen
server-side; state topics (`…/state`) report the commanded state back. HELM and HA
stay in sync on the same broker. Gated by `HA_DISCOVERY_ENABLED`.

## 8. Live / UI

- **`live-provider.tsx`**: track `irClimate: Record<deviceId, IrClimateState>` (from
  `ir_state` events) + `lastIrAck` (from `ir_ack`), over the existing single SSE
  connection. Unknown-kind events already no-op, so nothing else breaks.
- **`/remote`** (`app/(app)/remote/page.tsx`, server component): `ensureIrSeed()` →
  `getIrDevices()` → `<RemoteView>`.
  - **`climate-card.tsx`** — power, mode segmented control, temp stepper, fan
    selector; shows commanded state; "commanded · not verified" note; hazard flash on ack.
  - **`device-card.tsx`** — generic button grid; each press POSTs `/api/remote/fire`;
    brief hazard flash.
  - **`edit-dialogs.tsx`** — add/edit device (name, kind, icon; climate → Panasonic
    model) and button (label, icon, protocol, code, bits, repeats).
- **`app-shell.tsx`**: drop `soon: true` on the Remote nav item.
- Style: steel + one hazard accent, reusing `Eyebrow`/`Metric`/`Readout`/`Card`.

## 9. Testing & verification

- Unit: `ir-climate.test.ts` (reducer/clamp/HA mode map), `ha-discovery.test.ts`
  (discovery payload + topic parse), `ir-command.test.ts` (cmd JSON the firmware expects).
- `mock-device.ts`: subscribe `ir/cmd`, log it, echo `ir/ack {ok:true}` — exercises
  the whole `/remote` flow with no hardware.
- Gate: `pnpm typecheck`, `pnpm test`, `pnpm build`, and a live drive of `/remote`
  against the running dev broker/DB.

## 10. Honest caveats

- **Atomberg codes are unverified** (no receiver). Seeded from the published
  Gorilla Efficio 32-bit NEC set; a different remote generation may need different
  codes — buttons are editable, and worst case a ~₹50 receiver + a future learn
  flow captures the exact ones. Cross-library NEC bit-order can also differ.
- **Panasonic model** defaults to `DKE`; selectable per-device if the AC ignores it.
- **AC state is optimistic** — shown as commanded, never sensor-verified.

## 11. Out of scope (YAGNI)

Learn/capture flow (schema-ready, not built), RF remotes, additional devices,
per-button HA state, availability templating, a global IR enable toggle.
