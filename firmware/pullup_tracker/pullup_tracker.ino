/*
 * IRONHANG — ESP32 + VL53L0X pull-up & dead-hang tracker firmware
 * ---------------------------------------------------------------
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
 *
 * Board: any ESP32 dev module. Wiring (I2C):
 *   VL53L0X VIN -> 3V3 | GND -> GND | SDA -> GPIO21 | SCL -> GPIO22
 *
 * Copy config.example.h -> config.h and fill in your WiFi / MQTT details.
 */

#include <WiFi.h>
#include <Wire.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Adafruit_VL53L0X.h>
#include "config.h"

#define FW_VERSION "1.0.0"

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

// ---- Networking ----
WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);
Adafruit_VL53L0X lox = Adafruit_VL53L0X();

String topicTelemetry, topicEvent, topicStatus, topicConfig;

unsigned long lastTelemetry = 0;
const unsigned long TELEMETRY_INTERVAL_MS = 80;
State lastPublishedState = IDLE;
int lastPublishedDistance = -1;

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
//  MQTT publishing
// ------------------------------------------------------------------
void publishTelemetry(int distanceMm, State s) {
  JsonDocument doc;
  doc["k"] = DEVICE_KEY;
  doc["distanceMm"] = distanceMm;
  doc["state"] = stateName(s);
  char buf[128];
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
  char buf[128];
  size_t n = serializeJson(doc, buf, sizeof(buf));
  mqtt.publish(topicStatus.c_str(), (const uint8_t*)buf, n, true);  // retained
}

// ------------------------------------------------------------------
//  Config (retained) from server
// ------------------------------------------------------------------
void onMessage(char* topic, byte* payload, unsigned int len) {
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
  Serial.printf("[config] repNear=%d presenceMax=%d\n", th.repNearMm, th.presenceMaxMm);
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
  publishSessionEnd(durationMs);
  Serial.printf("[session] end reps=%d hang=%ldms max=%ldms\n",
                reps, (long)hangMs, (long)maxHangMs);
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
    String clientId = String("ironhang-") + DEVICE_ID;
    // Last-Will: mark device offline (retained) if the connection drops.
    String willPayload = String("{\"k\":\"") + DEVICE_KEY + "\",\"online\":false}";
    bool ok = mqtt.connect(
      clientId.c_str(), MQTT_USERNAME, MQTT_PASSWORD,
      topicStatus.c_str(), 1, true, willPayload.c_str());
    if (ok) {
      Serial.println(" connected");
      mqtt.subscribe(topicConfig.c_str(), 1);
      publishStatus(true);
    } else {
      Serial.printf(" failed rc=%d, retry in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

void setup() {
  Serial.begin(115200);
  delay(200);
  Serial.println("\nIRONHANG firmware " FW_VERSION);

  Wire.begin();
  if (!lox.begin()) {
    Serial.println("[vl53l0x] NOT FOUND — check wiring!");
    while (true) delay(1000);
  }
  Serial.println("[vl53l0x] ready");

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
  int distance = (measure.RangeStatus != 4) ? measure.RangeMilliMeter : 9999;

  unsigned long now = millis();
  processSample(distance, now);

  // Stream raw telemetry (throttled, or immediately on state/large change).
  bool stateChanged = (state != lastPublishedState);
  bool bigChange = abs(distance - lastPublishedDistance) > 15;
  if (stateChanged || (now - lastTelemetry >= TELEMETRY_INTERVAL_MS && bigChange) ||
      now - lastTelemetry >= 500) {
    publishTelemetry(distance, state);
    lastTelemetry = now;
    lastPublishedState = state;
    lastPublishedDistance = distance;
  }
}
