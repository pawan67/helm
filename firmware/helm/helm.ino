/*
 * HELM — bar-node firmware (ESP32 + VL53L0X + DHT11 + passive buzzer)
 * ---------------------------------------------------------------
 * The "bar node" of a HELM console: pull-up / dead-hang detection, ambient
 * temperature & humidity, and a buzzer, all streamed to the server over MQTT.
 * Reads a VL53L0X time-of-flight sensor mounted ~10cm above the bar (pointing
 * outward at the user), detects pull-up reps and dead-hang time with a state
 * machine, and streams everything to the server over MQTT.
 *
 * The detection logic mirrors web/src/lib/detection.ts one-to-one.
 *
 * Libraries (install via Arduino Library Manager):
 *   - Adafruit VL53L0X
 *   - PubSubClient  (by Nick O'Leary)
 *   - ArduinoJson   (v7.x)
 *   - DHT sensor library (by Adafruit) + Adafruit Unified Sensor
 *
 * Requires ESP32 Arduino core 2.0.2+ (uses tone()/noTone() for the buzzer).
 *
 * Board: any ESP32 dev module. Wiring:
 *   VL53L0X  VIN -> 3V3 | GND -> GND | SDA -> GPIO21 | SCL -> GPIO22
 *   DHT11    VCC -> 3V3 | GND -> GND | DATA -> GPIO25 (10k pull-up DATA->3V3
 *            if using a bare sensor; most modules have it onboard)
 *   Buzzer   passive piezo: + -> GPIO26 | - -> GND
 *
 * Copy config.example.h -> config.h and fill in your WiFi / MQTT details.
 */

#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_VL53L0X.h>
#include <DHT.h>
#include <IRremoteESP8266.h>
#include <IRsend.h>
#include <IRutils.h>
#include <ir_Panasonic.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Update.h>
#include "config.h"

#define FW_VERSION "1.4.0"

// A rep-free session whose longest continuous hang is shorter than this is
// treated as a sensor glitch, not a workout, and is discarded (no session_end
// published). Mirrors MIN_SESSION_HANG_MS in web/src/lib/detection.ts.
#define MIN_SESSION_HANG_MS 3000

// ---- Ambient sensor (DHT11) ----
#define DHT_PIN 25
#define DHT_TYPE DHT11
const unsigned long ENV_INTERVAL_MS = 60000;  // DHT11 maxes ~1Hz; sample once a minute

// ---- Passive buzzer ----
#define BUZZER_PIN 26

// ---- IR blaster ----
// GPIO27 -> 220Ω -> 2N2222 base; IR LED string on the collector off the 5V rail;
// 470µF across the LED supply to buffer the pulse current. Transmit-only.
#define IR_LED_PIN 27
IRsend irsend(IR_LED_PIN);            // generic protocols (NEC, etc.)
IRPanasonicAc panasonicAc(IR_LED_PIN);  // Panasonic AC state frames

// A tiny FIFO of pending IR command JSON strings. Commands are transmitted only
// while IDLE so an IR frame (a Panasonic frame is ~130-200ms) never stalls rep
// detection. You are never firing the AC mid-set anyway.
#define IR_QUEUE_LEN 8
String irQueue[IR_QUEUE_LEN];
int irQHead = 0, irQTail = 0, irQCount = 0;

// ---- Detection thresholds (defaults; overridden by retained MQTT config) ----
struct Thresholds {
  int presenceMaxMm = 900;
  int hangBandMm = 600;      // reserved / informational
  int repNearMm = 200;
  int repHysteresisMm = 80;
  long minRepMs = 400;
  long releaseMs = 1500;
  long presenceDebounceMs = 300;
};
Thresholds th;

// ---- Buzzer settings (defaults; overridden by retained MQTT config) ----
struct Sound {
  bool enabled = true;        // master switch
  bool onRep = true;          // chirp on each counted rep
  bool onSessionEnd = true;   // jingle when a set is saved
};
Sound snd;

// ---- Detection state ----
enum State { IDLE, HANGING, REP_UP };
State state = IDLE;

bool hasPresentSince = false;
unsigned long presentSince = 0;
bool hasAbsentSince = false;
unsigned long absentSince = 0;

unsigned long sessionStart = 0;
int reps = 0;
double hangMs = 0;
double maxHangMs = 0;
bool hasHangSegment = false;
unsigned long hangSegmentStart = 0;
bool hasLastSample = false;
unsigned long lastSampleT = 0;
bool hasRepStart = false;
unsigned long repStart = 0;

// Rep timeline (offsets from session start), capped to keep MQTT payload small.
#define MAX_REPS 80
long repOffset[MAX_REPS];
long repUpDuration[MAX_REPS];
int repTimingCount = 0;

// ---- Median smoothing ----
#define SMOOTH_N 5
int smoothBuf[SMOOTH_N];
int smoothCount = 0;
int smoothIdx = 0;

// ---- Ambient sensor + buzzer ----
DHT dht(DHT_PIN, DHT_TYPE);
unsigned long lastEnv = 0;
bool envPrimed = false;  // first reading fires a few seconds after boot

// Non-blocking beep scheduler: a tiny queue of {frequency, duration} steps so
// multi-tone jingles play without ever stalling the detection loop. freq 0 = a
// silent gap between tones.
#define MAX_BEEP_STEPS 6
struct BeepStep { int freq; int durMs; };
BeepStep beepSteps[MAX_BEEP_STEPS];
int beepCount = 0;
int beepIdx = 0;
bool beeping = false;
unsigned long beepStepStart = 0;

// ---- Networking ----
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
Adafruit_VL53L0X lox = Adafruit_VL53L0X();

String topicTelemetry, topicEvent, topicStatus, topicConfig, topicEnv, topicIrCmd, topicIrAck;
// OTA: server publishes a firmware push on topicOta; we stream progress back on
// topicOtaStatus and reboot into the new image on success.
String topicOta, topicOtaStatus;

unsigned long lastTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 80;
State lastPublishedState = IDLE;
int lastPublishedDistance = -1;

// Status heartbeat: republish the retained status (rssi/uptime/heap/ip) on a
// slow timer so the console's device-health panel stays fresh and a silent crash
// surfaces as a stale reading even before the MQTT last-will fires.
unsigned long lastStatusPub = 0;
const unsigned long STATUS_INTERVAL_MS = 15000;

// A firmware push arrives inside the MQTT callback; we stash it and run the
// (blocking) download+flash from the main loop to avoid re-entering mqtt.loop().
String otaCmd;
bool otaPending = false;

// ------------------------------------------------------------------
//  Helpers
// ------------------------------------------------------------------
const char* stateName(State s) {
  switch (s) {
    case HANGING: return "hanging";
    case REP_UP: return "rep_up";
    default: return "idle";
  }
}

int smooth(int distance) {
  smoothBuf[smoothIdx] = distance;
  smoothIdx = (smoothIdx + 1) % SMOOTH_N;
  if (smoothCount < SMOOTH_N) smoothCount++;
  int tmp[SMOOTH_N];
  for (int i = 0; i < smoothCount; i++) tmp[i] = smoothBuf[i];
  // insertion sort (tiny array)
  for (int i = 1; i < smoothCount; i++) {
    int key = tmp[i], j = i - 1;
    while (j >= 0 && tmp[j] > key) { tmp[j + 1] = tmp[j]; j--; }
    tmp[j + 1] = key;
  }
  return tmp[smoothCount / 2];
}

void resetSession() {
  hasPresentSince = false;
  hasAbsentSince = false;
  sessionStart = 0;
  reps = 0;
  hangMs = 0;
  maxHangMs = 0;
  hasHangSegment = false;
  hasLastSample = false;
  hasRepStart = false;
  repTimingCount = 0;
  smoothCount = 0;
  smoothIdx = 0;
}

// ------------------------------------------------------------------
//  Buzzer (non-blocking)
// ------------------------------------------------------------------
void startBeepSeq(const BeepStep* steps, int n) {
  if (!snd.enabled) return;
  if (n > MAX_BEEP_STEPS) n = MAX_BEEP_STEPS;
  for (int i = 0; i < n; i++) beepSteps[i] = steps[i];
  beepCount = n;
  beepIdx = 0;
  beeping = true;
  beepStepStart = millis();
  if (beepSteps[0].freq > 0) tone(BUZZER_PIN, beepSteps[0].freq);
  else noTone(BUZZER_PIN);
}

void updateBeep(unsigned long now) {
  if (!beeping) return;
  if ((long)(now - beepStepStart) < beepSteps[beepIdx].durMs) return;
  beepIdx++;
  if (beepIdx >= beepCount) {
    noTone(BUZZER_PIN);
    beeping = false;
    return;
  }
  beepStepStart = now;
  if (beepSteps[beepIdx].freq > 0) tone(BUZZER_PIN, beepSteps[beepIdx].freq);
  else noTone(BUZZER_PIN);
}

// Short chirp when a rep is counted.
void beepRep() {
  static const BeepStep seq[] = { {2000, 60} };
  startBeepSeq(seq, 1);
}

// Two rising tones when a set is saved.
void beepSessionEnd() {
  static const BeepStep seq[] = { {1568, 90}, {0, 40}, {2093, 150} };
  startBeepSeq(seq, 3);
}

// Silence immediately (e.g. when sound is turned off mid-beep).
void stopBeep() {
  noTone(BUZZER_PIN);
  beeping = false;
}

// ------------------------------------------------------------------
//  MQTT publishing
// ------------------------------------------------------------------
void publishTelemetry(int distanceMm, State s, int rangeStatus, float signalMcps) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["distanceMm"] = distanceMm;
  doc["state"] = stateName(s);
  // Diagnostics: raw VL53L0X range status + return signal rate (MCps). Lets the
  // server tell a genuine strong return from noise / electrical garbage when a
  // phantom close reading appears with nothing on the bar.
  doc["st"] = rangeStatus;
  doc["sig"] = signalMcps;
  char buf[160];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicTelemetry.c_str(), (const uint8_t*)buf, n, false);
}

void publishSessionStart() {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["type"] = "session_start";
  char buf[96];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicEvent.c_str(), (const uint8_t*)buf, n, false);
}

void publishRep(int repNumber, long upDurationMs) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["type"] = "rep";
  doc["repNumber"] = repNumber;
  doc["upDurationMs"] = upDurationMs;
  doc["reps"] = repNumber;
  char buf[128];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicEvent.c_str(), (const uint8_t*)buf, n, false);
}

void publishSessionEnd(long durationMs) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["type"] = "session_end";
  doc["reps"] = reps;
  doc["hangMs"] = (long)(hangMs + 0.5);
  doc["durationMs"] = durationMs;
  doc["maxHangMs"] = (long)(maxHangMs + 0.5);
  JsonArray arr = doc["repTimings"].to<JsonArray>();
  for (int i = 0; i < repTimingCount; i++) {
    JsonObject o = arr.add<JsonObject>();
    o["repNumber"] = i + 1;
    o["offsetMs"] = repOffset[i];
    o["upDurationMs"] = repUpDuration[i];
  }
  char buf[3072];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicEvent.c_str(), (const uint8_t*)buf, n, false);
}

void publishStatus(bool online) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["online"] = online;
  doc["fw"] = FW_VERSION;
  doc["rssi"] = WiFi.RSSI();
  doc["up"] = (uint32_t)(millis() / 1000);   // uptime, seconds
  doc["heap"] = (uint32_t)ESP.getFreeHeap();  // free heap, bytes
  doc["ip"] = WiFi.localIP().toString();
  char buf[224];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicStatus.c_str(), (const uint8_t*)buf, n, true);  // retained
}

void publishEnv(float tempC, float humidity) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["tempC"] = tempC;
  doc["humidity"] = humidity;
  char buf[96];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicEnv.c_str(), (const uint8_t*)buf, n, false);
}

// Read the DHT11 and publish; skips silently on a failed (NaN) read.
void readAndPublishEnv() {
  float t = dht.readTemperature();  // Celsius
  float h = dht.readHumidity();
  if (isnan(t) || isnan(h)) {
    Serial.println("[env] DHT read failed");
    return;
  }
  publishEnv(t, h);
  Serial.printf("[env] %.1fC %.0f%%\n", t, h);
}

// ------------------------------------------------------------------
//  IR blaster — transmit commands the server publishes on ir/cmd
// ------------------------------------------------------------------
void enqueueIr(const String& json) {
  if (irQCount >= IR_QUEUE_LEN) {  // full: drop the oldest
    irQHead = (irQHead + 1) % IR_QUEUE_LEN;
    irQCount--;
  }
  irQueue[irQTail] = json;
  irQTail = (irQTail + 1) % IR_QUEUE_LEN;
  irQCount++;
}

bool dequeueIr(String& out) {
  if (irQCount == 0) return false;
  out = irQueue[irQHead];
  irQHead = (irQHead + 1) % IR_QUEUE_LEN;
  irQCount--;
  return true;
}

void publishIrAck(const char* kind) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["ok"] = true;
  doc["kind"] = kind;
  char buf[96];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicIrAck.c_str(), (const uint8_t*)buf, n, false);
}

panasonic_ac_remote_model_t panasonicModel(const char* m) {
  if (!strcmp(m, "NKE")) return kPanasonicNke;
  if (!strcmp(m, "LKE")) return kPanasonicLke;
  if (!strcmp(m, "JKE")) return kPanasonicJke;
  if (!strcmp(m, "CKP")) return kPanasonicCkp;
  if (!strcmp(m, "RKR")) return kPanasonicRkr;
  return kPanasonicDke;  // default
}

uint8_t panasonicMode(const char* m) {
  if (!strcmp(m, "auto")) return kPanasonicAcAuto;
  if (!strcmp(m, "heat")) return kPanasonicAcHeat;
  if (!strcmp(m, "dry")) return kPanasonicAcDry;
  if (!strcmp(m, "fan")) return kPanasonicAcFan;
  return kPanasonicAcCool;  // default
}

uint8_t panasonicFan(const char* f) {
  if (!strcmp(f, "min")) return kPanasonicAcFanMin;
  if (!strcmp(f, "low")) return kPanasonicAcFanLow;
  if (!strcmp(f, "med")) return kPanasonicAcFanMed;
  if (!strcmp(f, "high")) return kPanasonicAcFanHigh;
  if (!strcmp(f, "max")) return kPanasonicAcFanMax;
  return kPanasonicAcFanAuto;  // default
}

uint8_t panasonicSwing(const char* s) {
  if (!strcmp(s, "highest")) return kPanasonicAcSwingVHighest;
  if (!strcmp(s, "high")) return kPanasonicAcSwingVHigh;
  if (!strcmp(s, "middle")) return kPanasonicAcSwingVMiddle;
  if (!strcmp(s, "low")) return kPanasonicAcSwingVLow;
  if (!strcmp(s, "lowest")) return kPanasonicAcSwingVLowest;
  return kPanasonicAcSwingVAuto;  // default
}

void sendClimate(JsonDocument& doc) {
  const char* model = doc["model"] | "DKE";
  bool power = doc["power"] | false;
  const char* mode = doc["mode"] | "cool";
  int tempC = doc["tempC"] | 24;
  const char* fan = doc["fan"] | "auto";
  const char* swing = doc["swing"] | "auto";

  panasonicAc.setModel(panasonicModel(model));
  panasonicAc.setPower(power);
  panasonicAc.setMode(panasonicMode(mode));
  panasonicAc.setTemp((uint8_t)tempC);
  panasonicAc.setFan(panasonicFan(fan));
  panasonicAc.setSwingVertical(panasonicSwing(swing));
  panasonicAc.send();
  Serial.printf("[ir] climate %s power=%d %s %dC fan=%s\n", model, power, mode, tempC, fan);
}

void sendButton(JsonDocument& doc) {
  const char* protocol = doc["protocol"] | "NEC";
  const char* codeStr = doc["code"] | "0";
  uint16_t bits = doc["bits"] | 32;
  uint16_t repeats = doc["repeats"] | 0;
  uint64_t code = strtoull(codeStr, nullptr, 16);

  decode_type_t proto = strToDecodeType(protocol);
  if (proto == decode_type_t::UNKNOWN) proto = decode_type_t::NEC;
  bool ok = irsend.send(proto, code, bits, repeats);
  Serial.printf("[ir] button %s 0x%llX bits=%d ok=%d\n", protocol, (unsigned long long)code, bits, ok);
}

// Parse and transmit one queued IR command, then ack the server.
void sendIrCmd(const String& json) {
  JsonDocument doc;
  if (deserializeJson(doc, json)) {
    Serial.println("[ir] bad command JSON");
    return;
  }
  const char* t = doc["t"] | "";
  if (!strcmp(t, "climate")) sendClimate(doc);
  else if (!strcmp(t, "button")) sendButton(doc);
  else { Serial.printf("[ir] unknown t=%s\n", t); return; }
  publishIrAck(t);
}

// ------------------------------------------------------------------
//  OTA firmware update (pushed from the console over MQTT)
// ------------------------------------------------------------------
// The server publishes {url, version, md5, size} on topicOta; we download the
// image over HTTP(S) straight from the console and flash it, streaming progress
// back on topicOtaStatus so the panel can show a live bar. On success we reboot
// into the new partition; on any failure we abort cleanly and keep running.
void publishOtaStatus(const char* phase, int percent, const char* version, const char* error) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["phase"] = phase;
  if (percent >= 0) doc["percent"] = percent;
  if (version && version[0]) doc["version"] = version;
  if (error && error[0]) doc["error"] = error;
  char buf[224];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicOtaStatus.c_str(), (const uint8_t*)buf, n, false);
  mqtt.loop();  // flush the outgoing packet before we block on the download
}

void performOta(const String& url, const String& version, const String& md5, int expectedSize) {
  Serial.printf("[ota] push v%s <- %s (%d bytes)\n", version.c_str(), url.c_str(), expectedSize);
  publishOtaStatus("start", 0, version.c_str(), nullptr);

  // Pick a plain or TLS client from the URL scheme. setInsecure() skips cert
  // validation — fine for pulling a signed-by-md5 image off your own console.
  WiFiClientSecure secureClient;
  WiFiClient plainClient;
  WiFiClient* netClient;
  if (url.startsWith("https")) {
    secureClient.setInsecure();
    netClient = &secureClient;
  } else {
    netClient = &plainClient;
  }

  HTTPClient http;
  if (!http.begin(*netClient, url)) {
    publishOtaStatus("error", -1, nullptr, "http begin failed");
    return;
  }
  http.setTimeout(15000);
  int code = http.GET();
  if (code != HTTP_CODE_OK) {
    char e[40];
    snprintf(e, sizeof(e), "http %d", code);
    http.end();
    publishOtaStatus("error", -1, nullptr, e);
    return;
  }

  int len = http.getSize();
  if (len <= 0) len = expectedSize;  // chunked / no Content-Length: fall back
  if (len <= 0) {
    http.end();
    publishOtaStatus("error", -1, nullptr, "unknown size");
    return;
  }

  if (!Update.begin(len)) {
    http.end();
    publishOtaStatus("error", -1, nullptr, "no OTA space");
    return;
  }
  if (md5.length() == 32) Update.setMD5(md5.c_str());  // integrity check on end()

  WiFiClient* stream = http.getStreamPtr();
  uint8_t buf[1024];
  int written = 0;
  int lastPct = -10;
  unsigned long lastData = millis();

  while (written < len) {
    size_t avail = stream->available();
    if (avail) {
      int toRead = avail > sizeof(buf) ? sizeof(buf) : (int)avail;
      int r = stream->readBytes(buf, toRead);
      if (r > 0) {
        if (Update.write(buf, r) != (size_t)r) {
          Update.abort();
          http.end();
          publishOtaStatus("error", -1, nullptr, "flash write failed");
          return;
        }
        written += r;
        lastData = millis();
        int pct = (int)((long)written * 100 / len);
        if (pct - lastPct >= 10) {
          publishOtaStatus("progress", pct, nullptr, nullptr);
          lastPct = pct;
        }
      }
    } else {
      if (!http.connected() && written < len) break;  // socket closed early
      if (millis() - lastData > 15000) {               // stalled download
        Update.abort();
        http.end();
        publishOtaStatus("error", -1, nullptr, "download stalled");
        return;
      }
      delay(1);
    }
  }

  if (!Update.end(true) || !Update.isFinished()) {
    char e[64];
    snprintf(e, sizeof(e), "verify failed: %s", Update.errorString());
    http.end();
    publishOtaStatus("error", -1, nullptr, e);
    return;
  }
  http.end();

  Serial.println("[ota] flashed OK, rebooting into new image");
  publishOtaStatus("success", 100, version.c_str(), nullptr);
  delay(500);
  ESP.restart();
}

// Parse a stashed OTA command and run it. Called from loop() while IDLE.
void runPendingOta() {
  if (!otaPending) return;
  otaPending = false;
  JsonDocument doc;
  if (deserializeJson(doc, otaCmd)) {
    publishOtaStatus("error", -1, nullptr, "bad command json");
    return;
  }
  String url = doc["url"] | "";
  String version = doc["version"] | "";
  String md5 = doc["md5"] | "";
  int size = doc["size"] | 0;
  if (url.length() == 0) {
    publishOtaStatus("error", -1, nullptr, "missing url");
    return;
  }
  performOta(url, version, md5, size);
}

// ------------------------------------------------------------------
//  Config (retained) from server
// ------------------------------------------------------------------
void onMessage(char* topic, byte* payload, unsigned int len) {
  // A firmware push: verify the shared secret, stash the command, and let the
  // main loop run the blocking download (never re-enter mqtt.loop() from here).
  if (String(topic) == topicOta) {
    JsonDocument doc;
    if (deserializeJson(doc, payload, len)) return;
    const char* k = doc["k"] | "";
    if (strlen(DEVICE_KEY) > 0 && strcmp(k, DEVICE_KEY) != 0) {
      Serial.println("[ota] rejected: bad key");
      return;
    }
    char buf[512];
    unsigned int n = len < sizeof(buf) - 1 ? len : sizeof(buf) - 1;
    memcpy(buf, payload, n);
    buf[n] = 0;
    otaCmd = String(buf);
    otaPending = true;
    return;
  }
  // IR commands arrive on their own topic; queue them for IDLE transmission.
  if (String(topic) == topicIrCmd) {
    char buf[256];
    unsigned int n = len < sizeof(buf) - 1 ? len : sizeof(buf) - 1;
    memcpy(buf, payload, n);
    buf[n] = 0;
    enqueueIr(String(buf));
    return;
  }
  if (String(topic) != topicConfig) return;
  JsonDocument doc;
  if (deserializeJson(doc, payload, len)) return;
  if (doc["presenceMaxMm"].is<int>()) th.presenceMaxMm = doc["presenceMaxMm"];
  if (doc["hangBandMm"].is<int>()) th.hangBandMm = doc["hangBandMm"];
  if (doc["repNearMm"].is<int>()) th.repNearMm = doc["repNearMm"];
  if (doc["repHysteresisMm"].is<int>()) th.repHysteresisMm = doc["repHysteresisMm"];
  if (doc["minRepMs"].is<long>()) th.minRepMs = doc["minRepMs"];
  if (doc["releaseMs"].is<long>()) th.releaseMs = doc["releaseMs"];
  if (doc["presenceDebounceMs"].is<long>()) th.presenceDebounceMs = doc["presenceDebounceMs"];
  if (doc["soundEnabled"].is<bool>()) snd.enabled = doc["soundEnabled"];
  if (doc["beepOnRep"].is<bool>()) snd.onRep = doc["beepOnRep"];
  if (doc["beepOnSessionEnd"].is<bool>()) snd.onSessionEnd = doc["beepOnSessionEnd"];
  if (!snd.enabled) stopBeep();  // silence any beep in progress
  Serial.printf("[config] repNear=%d presenceMax=%d sound=%d\n",
                th.repNearMm, th.presenceMaxMm, snd.enabled);
}

// ------------------------------------------------------------------
//  Detection state machine (mirrors detection.ts)
// ------------------------------------------------------------------
void finishHangSegment(unsigned long now) {
  if (hasHangSegment) {
    double seg = (double)(now - hangSegmentStart);
    if (seg > maxHangMs) maxHangMs = seg;
    hasHangSegment = false;
  }
}

void endSession(unsigned long endAt) {
  finishHangSegment(endAt);
  unsigned long start = sessionStart ? sessionStart : endAt;
  long durationMs = (long)(endAt - start);
  // Keep a session only if it holds a real signal: at least one counted rep, or
  // a sustained hang. Anything shorter is a glitch — drop it silently (no
  // publish, no end jingle) so it never becomes a phantom row.
  bool real = (reps > 0) || (maxHangMs >= (double)MIN_SESSION_HANG_MS);
  if (real) {
    publishSessionEnd(durationMs);
    if (snd.onSessionEnd) beepSessionEnd();
    Serial.printf("[session] end reps=%d hang=%ldms max=%ldms\n",
                  reps, (long)hangMs, (long)maxHangMs);
  } else {
    Serial.printf("[session] discarded phantom reps=%d max=%ldms\n",
                  reps, (long)maxHangMs);
  }
  resetSession();
  state = IDLE;
}

void handleAbsence(unsigned long now) {
  if (!hasAbsentSince) { hasAbsentSince = true; absentSince = now; }
  if ((long)(now - absentSince) >= th.releaseMs) {
    endSession(absentSince);
  }
}

void processSample(int rawDistance, unsigned long now) {
  int d = smooth(rawDistance);
  bool present = d < th.presenceMaxMm;

  // Accumulate hang time while hanging (time on bar, not mid-rep).
  if (state == HANGING && hasLastSample) {
    long dt = (long)(now - lastSampleT);
    if (dt > 0) hangMs += dt;
  }
  hasLastSample = true;
  lastSampleT = now;

  switch (state) {
    case IDLE:
      if (present) {
        if (!hasPresentSince) { hasPresentSince = true; presentSince = now; }
        if ((long)(now - presentSince) >= th.presenceDebounceMs) {
          resetSession();
          hasLastSample = true;
          lastSampleT = now;
          state = HANGING;
          sessionStart = now;
          hasHangSegment = true;
          hangSegmentStart = now;
          publishSessionStart();
          Serial.println("[session] start");
        }
      } else {
        hasPresentSince = false;
      }
      break;

    case HANGING:
      if (d < th.repNearMm) {
        finishHangSegment(now);
        state = REP_UP;
        hasRepStart = true;
        repStart = now;
      } else if (!present) {
        handleAbsence(now);
      } else {
        hasAbsentSince = false;
      }
      break;

    case REP_UP:
      if (d > th.repNearMm + th.repHysteresisMm) {
        long dur = hasRepStart ? (long)(now - repStart) : 0;
        if (dur >= th.minRepMs) {
          reps++;
          if (repTimingCount < MAX_REPS) {
            repOffset[repTimingCount] = (long)(now - sessionStart);
            repUpDuration[repTimingCount] = dur;
            repTimingCount++;
          }
          publishRep(reps, dur);
          if (snd.onRep) beepRep();
          Serial.printf("[rep] #%d up=%ldms\n", reps, dur);
        }
        hasRepStart = false;
        state = HANGING;
        hasHangSegment = true;
        hangSegmentStart = now;
      }
      break;
  }
}

// ------------------------------------------------------------------
//  Setup / connectivity
// ------------------------------------------------------------------
void setupTopics() {
  String base = String("pullup/") + DEVICE_ID + "/";
  topicTelemetry = base + "telemetry";
  topicEvent = base + "event";
  topicStatus = base + "status";
  topicConfig = base + "config";
  topicEnv = base + "env";
  topicIrCmd = base + "ir/cmd";
  topicIrAck = base + "ir/ack";
  topicOta = base + "ota";
  topicOtaStatus = base + "ota/status";
}

void connectWifi() {
  Serial.printf("[wifi] connecting to %s", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(400);
    Serial.print(".");
  }
  Serial.printf("\n[wifi] connected, IP=%s RSSI=%d\n",
                WiFi.localIP().toString().c_str(), WiFi.RSSI());
}

void connectMqtt() {
  while (!mqtt.connected()) {
    Serial.print("[mqtt] connecting...");
    String clientId = String("helm-") + DEVICE_ID;
    // Last-Will: mark device offline (retained) if the connection drops.
    String willPayload = String("{\"k\":\"") + DEVICE_KEY + "\",\"online\":false}";
    bool ok = mqtt.connect(
      clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD,
      topicStatus.c_str(), 1, true, willPayload.c_str());
    if (ok) {
      Serial.println(" connected");
      mqtt.subscribe(topicConfig.c_str(), 1);
      mqtt.subscribe(topicIrCmd.c_str(), 1);
      mqtt.subscribe(topicOta.c_str(), 1);
      publishStatus(true);
      lastStatusPub = millis();
    } else {
      Serial.printf(" failed rc=%d, retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nHELM bar-node firmware " FW_VERSION);

  Wire.begin();
  // LONG_RANGE is required here: DEFAULT mode only reaches ~20cm on a head
  // (hair absorbs IR), which is too short for a hanging body. We briefly tried
  // DEFAULT to reject weak-signal noise, but it killed real detection AND the
  // phantom readings persisted anyway — proving the phantoms are NOT weak-signal
  // noise. So we keep LONG_RANGE for range and diagnose the real cause via the
  // RangeStatus/signal fields now added to telemetry.
  if (!lox.begin(VL53L0X_I2C_ADDR, false, &Wire,
                 Adafruit_VL53L0X::VL53L0X_SENSE_LONG_RANGE)) {
    Serial.println("[vl53l0x] NOT FOUND — check wiring!");
    while (true) delay(1000);
  }
  // Larger timing budget = steadier readings + better ambient rejection
  // (slower sampling). 66ms -> ~15Hz, still ample for rep detection and a bit
  // more noise-resistant than the old 50ms.
  lox.setMeasurementTimingBudgetMicroSeconds(66000);
  Serial.println("[vl53l0x] ready (long-range)");

  dht.begin();
  pinMode(BUZZER_PIN, OUTPUT);
  noTone(BUZZER_PIN);

  irsend.begin();
  panasonicAc.begin();
  Serial.println("[ir] blaster ready on GPIO27");

  setupTopics();
  connectWifi();

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setBufferSize(3200);
  mqtt.setCallback(onMessage);
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  VL53L0X_RangingMeasurementData_t measure;
  lox.rangingTest(&measure, false);
  // VL53L0X RangeStatus: 0 = valid; 1 = sigma fail (noisy), 2 = signal fail
  // (no real target — often reports a bogus *small* distance), 3 = min-range,
  // 4 = phase fail / out of range. Trust ONLY status 0: any other status means
  // there is no reliable target, so we report it as far away (9999). This is
  // the fix for phantom sets/hangs — a signal-fail reading could previously
  // masquerade as someone on the bar and auto-count reps (with a beep).
  int distance = (measure.RangeStatus == 0) ? measure.RangeMilliMeter : 9999;
  // Return signal strength (FixPoint16.16 MCps) — a diagnostic streamed with
  // telemetry to characterise phantom readings.
  float signalMcps = measure.SignalRateRtnMegaCps / 65536.0f;

  unsigned long now = millis();
  updateBeep(now);
  processSample(distance, now);

  // A firmware push blocks (download + flash + reboot); only run it between sets
  // so it never interrupts an active session.
  if (otaPending && state == IDLE) runPendingOta();

  // Periodic retained status heartbeat (rssi/uptime/heap/ip) for the panel.
  if (now - lastStatusPub >= STATUS_INTERVAL_MS) {
    publishStatus(true);
    lastStatusPub = now;
  }

  // Sample ambient temp/humidity on a slow timer. Only when idle so the DHT's
  // blocking read never stalls mid-rep (first reading a few seconds after boot).
  bool envDue = envPrimed ? (now - lastEnv >= ENV_INTERVAL_MS) : (now >= 2500);
  if (envDue && state == IDLE) {
    readAndPublishEnv();
    lastEnv = now;
    envPrimed = true;
  }

  // Transmit any queued IR command right away, in any state, so control feels
  // instant — a fan/AC must respond even while the bar sensor sees something in
  // front of it. An IR frame briefly (~tens of ms) pauses distance sampling;
  // firing one during an active pull-up is rare and at worst nudges a single
  // rep's timing slightly, which is an acceptable trade for responsive control.
  if (irQCount > 0) {
    String cmd;
    if (dequeueIr(cmd)) sendIrCmd(cmd);
  }

  // Stream raw telemetry (throttled, or immediately on state/large change).
  bool stateChanged = (state != lastPublishedState);
  bool bigChange = abs(distance - lastPublishedDistance) > 15;
  if (stateChanged || (now - lastTelemetry >= TELEMETRY_INTERVAL_MS && bigChange) ||
      now - lastTelemetry >= 500) {
    publishTelemetry(distance, state, measure.RangeStatus, signalMcps);
    lastTelemetry = now;
    lastPublishedState = state;
    lastPublishedDistance = distance;
  }
}
