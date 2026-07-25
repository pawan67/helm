# HELM Bar-Node Firmware (ESP32)

Arduino sketch for the HELM **bar node**: it reads the VL53L0X to detect reps and
hang time, reads a DHT11 for room temperature and humidity, drives a passive buzzer,
**blasts IR to control an AC / fan / TV**, and streams everything to the server over
MQTT. The detection logic mirrors `web/src/lib/detection.ts` exactly, so the
TypeScript unit tests also validate the on-device algorithm.

## Hardware

| Part           | Pin → ESP32 |
|----------------|-------------|
| VL53L0X VIN    | 3V3         |
| VL53L0X GND    | GND         |
| VL53L0X SDA    | GPIO21      |
| VL53L0X SCL    | GPIO22      |
| DHT11 VCC      | 3V3         |
| DHT11 GND      | GND         |
| DHT11 DATA     | GPIO25 (10k pull-up to 3V3 if bare) |
| Buzzer +       | GPIO26 (passive piezo) |
| Buzzer −       | GND         |
| IR LED driver  | GPIO27      |

### IR blaster wiring (2N2222 + IR LEDs + 470µF)

The ESP32 can't drive a bright IR LED string directly, so a transistor switches it:

```
GPIO27 ──[220Ω]──► 2N2222 base
5V ──► IR LED(s) ──[current-limit R]──► 2N2222 collector
2N2222 emitter ──► GND
470µF electrolytic across the 5V/GND LED supply (buffers the pulse current)
```

- Put the LEDs on the **5V** rail (VIN/5V pin), not 3V3 — more range.
- Size the current-limit resistor for your LED count (e.g. ~22–47Ω for one or two
  LEDs at 5V); a single 470µF cap across the supply smooths the burst draw.
- Point the IR LEDs at the AC / fan you want to control (line-of-sight).

Mount the VL53L0X on the wall **10 cm above the bar**, centered, pointing
**outward** toward your body. When you hang, your head reads far/low in the beam;
at the top of a pull-up your head rises close to the sensor.

## Software setup

1. Install the **ESP32 board package** in the Arduino IDE
   (Boards Manager → "esp32" by Espressif, 2.0.2+).
2. Install these libraries (Library Manager):
   - **Adafruit VL53L0X**
   - **PubSubClient** (Nick O'Leary)
   - **ArduinoJson** (v7.x)
   - **DHT sensor library** (Adafruit) + **Adafruit Unified Sensor**
   - **IRremoteESP8266** (crankyoldgit — works on ESP32; drives the IR blaster)
3. In `firmware/helm/`, copy `config.example.h` → `config.h` and fill in your
   WiFi + MQTT details. `config.h` is gitignored.
4. Open `helm.ino`, select your ESP32 board + port, and upload.
5. Open Serial Monitor at **115200 baud** to watch it connect and detect reps.

## How it behaves

- Publishes raw distance continuously to `pullup/<DEVICE_ID>/telemetry`
  (for the live gauge + calibration).
- Publishes `session_start`, `rep`, and `session_end` events to
  `pullup/<DEVICE_ID>/event`.
- Publishes temperature and humidity every 60 s to `pullup/<DEVICE_ID>/env`
  (sampled only when idle so the DHT read never stalls a rep).
- Publishes retained online/offline status to `pullup/<DEVICE_ID>/status`
  (offline is delivered by the MQTT Last-Will if the device drops).
- Subscribes to the retained `pullup/<DEVICE_ID>/config` topic; whenever you
  change thresholds or the buzzer toggles in the web **Settings** page, the new
  values arrive instantly — **no reflashing needed**.
- Chirps the buzzer on each counted rep and plays a two-tone jingle on session
  end, both gated by the Settings sound toggles.
- Subscribes to `pullup/<DEVICE_ID>/ir/cmd` and transmits the IR frame — a
  Panasonic AC state frame (`{"t":"climate",…}`) or a generic protocol code
  (`{"t":"button","protocol":"NEC","code":"00CF8976","bits":32}`). Commands are
  queued and transmitted right away in any state, so the fan/AC responds
  instantly even while the bar sensor sees something (an IR burst only pauses
  distance sampling for a few tens of ms).
  It acks each send on `pullup/<DEVICE_ID>/ir/ack`. Devices/buttons are managed
  on the web **Remote** page; nothing is hard-coded in firmware.

## Calibration

Open the web app's **Settings** page (it shows the live distance reading) and:

1. Hang from the bar — note the resting distance.
2. Pull up to chin-over-bar — note the distance at the top.
3. Set **Rep line** just above the chin-over-bar reading so a full rep clearly
   crosses it, but a partial rep doesn't.
4. Set **Presence range** below your resting-standing distance so the session
   only starts when you're actually hanging.

Changes save straight to the device over MQTT.
