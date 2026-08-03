#!/usr/bin/env bash
#
# Build & flash the HELM bar-node firmware WITHOUT the Arduino IDE.
#
# Uses arduino-cli: headless, and it caches compilation so incremental builds
# take seconds instead of the IDE's full rebuild-every-time. Four modes:
#
#   ./flash.sh            # compile + export the .bin  (default)
#   ./flash.sh usb        # compile + flash over USB serial
#   ./flash.sh ota        # compile + upload to the console + trigger an OTA push
#   ./flash.sh setup      # one-time: install the ESP32 core + all libraries
#
# Config: override any variable below via the environment or a `build.env` file
# next to this script (copy build.env.example). At minimum, `ota` needs HELM_URL
# and HELM_PASSWORD.
#
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKETCH="$HERE/helm"
BUILD_DIR="$HERE/build"

# Load optional local config (gitignored).
if [ -f "$HERE/build.env" ]; then set -a; . "$HERE/build.env"; set +a; fi

# ESP32 Dev Module + the "Minimal SPIFFS (1.9MB APP with OTA)" partition scheme,
# which the firmware REQUIRES for OTA to fit. Change the board via FQBN if yours
# differs — the ...:PartitionScheme=min_spiffs suffix must stay for OTA.
FQBN="${FQBN:-esp32:esp32:esp32:PartitionScheme=min_spiffs}"
PORT="${PORT:-/dev/ttyUSB0}"
HELM_URL="${HELM_URL:-http://localhost:3000}"
HELM_PASSWORD="${HELM_PASSWORD:-}"

BIN="$BUILD_DIR/helm.ino.bin"          # app-only image (0xE9 magic) — the OTA target

die()  { echo "error: $*" >&2; exit 1; }
have() { command -v "$1" >/dev/null 2>&1; }

require_cli() {
  have arduino-cli || die "arduino-cli not found. Install it:
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
then run:  ./flash.sh setup"
}

# --- one-time toolchain + libraries -----------------------------------------
cmd_setup() {
  require_cli
  arduino-cli config init --overwrite >/dev/null 2>&1 || true
  arduino-cli config add board_manager.additional_urls \
    https://espressif.github.io/arduino-esp32/package_esp32_index.json
  arduino-cli core update-index
  arduino-cli core install esp32:esp32
  # Everything the sketch #includes (IRremoteESP8266 covers send + receive):
  arduino-cli lib install \
    "Adafruit VL53L0X" \
    "PubSubClient" \
    "ArduinoJson" \
    "DHT sensor library" \
    "Adafruit Unified Sensor" \
    "IRremoteESP8266"
  echo "✔ setup complete — try: ./flash.sh"
}

# --- compile ----------------------------------------------------------------
cmd_build() {
  require_cli
  mkdir -p "$BUILD_DIR"
  arduino-cli compile --fqbn "$FQBN" --output-dir "$BUILD_DIR" "$SKETCH"
  [ -f "$BIN" ] || die "expected $BIN after compile"
  echo "✔ built $(du -h "$BIN" | cut -f1) → $BIN"
}

# --- flash over USB ---------------------------------------------------------
cmd_usb() {
  cmd_build
  # A serial monitor holding the port makes the ESP32 "stop responding" mid-flash
  # — close any open monitor first.
  arduino-cli upload --fqbn "$FQBN" --port "$PORT" --input-dir "$BUILD_DIR" "$SKETCH"
  echo "✔ flashed over USB on $PORT"
}

# --- build + OTA push via the console API -----------------------------------
cmd_ota() {
  have curl || die "curl is required for OTA"
  have python3 || die "python3 is required to parse the API response"
  [ -n "$HELM_PASSWORD" ] || die "set HELM_PASSWORD (env or build.env) for OTA"
  cmd_build

  local ver jar id
  ver="$(sed -nE 's/.*FW_VERSION[[:space:]]+"([^"]+)".*/\1/p' "$SKETCH/helm.ino" | head -1)"
  jar="$(mktemp)"; trap 'rm -f "$jar"' RETURN

  echo "→ logging in to $HELM_URL"
  curl -fsS -c "$jar" -X POST "$HELM_URL/api/auth/login" \
    -H 'content-type: application/json' \
    -d "{\"password\":$(printf '%s' "$HELM_PASSWORD" | python3 -c 'import json,sys;print(json.dumps(sys.stdin.read()))')}" \
    >/dev/null || die "login failed (check HELM_PASSWORD / HELM_URL)"

  echo "→ uploading ${ver:-dev} ($(basename "$BIN"))"
  id="$(curl -fsS -b "$jar" -X POST "$HELM_URL/api/system/firmware" \
        -F "file=@$BIN" -F "version=${ver:-dev}" \
        | python3 -c 'import json,sys;print(json.load(sys.stdin)["firmware"]["id"])')" \
    || die "upload failed"
  [ -n "$id" ] || die "no firmware id returned"

  echo "→ pushing OTA to the device"
  curl -fsS -b "$jar" -X POST "$HELM_URL/api/system/firmware/$id/push" >/dev/null \
    || die "push failed (broker not connected / device offline?)"

  echo "✔ OTA pushed v${ver:-dev} — watch progress on the console's Device panel."
}

case "${1:-build}" in
  setup) cmd_setup ;;
  build) cmd_build ;;
  usb)   cmd_usb ;;
  ota)   cmd_ota ;;
  -h|--help|help) sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//' ;;
  *) die "unknown mode '${1}'. Use: setup | build | usb | ota" ;;
esac
