# IRONHANG Firmware (ESP32 + VL53L0X)

Arduino sketch that reads the VL53L0X, detects reps + hang time, and streams to
the server over MQTT. The detection logic mirrors
`web/src/lib/detection.ts` exactly, so the TypeScript unit tests also validate
the on-device algorithm.

## Hardware

| VL53L0X | ESP32     |
|---------|-----------|
| VIN     | 3V3       |
| GND     | GND       |
| SDA     | GPIO21    |
| SCL     | GPIO22    |

Mount the sensor on the wall **10 cm above the bar**, centered, pointing
**outward** toward your body. When you hang, your head reads far/low in the
beam; at the top of a pull-up your head rises close to the sensor.

## Software setup

1. Install the **ESP32 board package** in the Arduino IDE
   (Boards Manager → "esp32" by Espressif).
2. Install these libraries (Library Manager):
   - **Adafruit VL53L0X**
   - **PubSubClient** (Nick O'Leary)
   - **ArduinoJson** (v7.x)
3. In `firmware/pullup_tracker/`, copy `config.example.h` → `config.h` and fill
   in your WiFi + MQTT details. `config.h` is gitignored.
4. Open `pullup_tracker.ino`, select your ESP32 board + port, and upload.
5. Open Serial Monitor at **115200 baud** to watch it connect and detect reps.

## How it behaves

- Publishes raw distance continuously to `pullup/<DEVICE_ID>/telemetry`
  (for the live gauge + calibration).
- Publishes `session_start`, `rep`, and `session_end` events to
  `pullup/<DEVICE_ID>/event`.
- Publishes retained online/offline status to `pullup/<DEVICE_ID>/status`
  (offline is delivered by the MQTT Last-Will if the device drops).
- Subscribes to the retained `pullup/<DEVICE_ID>/config` topic; whenever you
  change thresholds in the web **Settings** page, the new values arrive
  instantly — **no reflashing needed**.

## Calibration

Open the web app's **Settings** page (it shows the live distance reading) and:

1. Hang from the bar — note the resting distance.
2. Pull up to chin-over-bar — note the distance at the top.
3. Set **Rep line** just above the chin-over-bar reading so a full rep clearly
   crosses it, but a partial rep doesn't.
4. Set **Presence range** below your resting-standing distance so the session
   only starts when you're actually hanging.

Changes save straight to the device over MQTT.
