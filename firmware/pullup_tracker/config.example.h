/*
 * Copy this file to `config.h` (same folder) and fill in your values.
 * config.h is gitignored so your secrets never get committed.
 */
#pragma once

// ---- WiFi ----
#define WIFI_SSID "your-wifi-name"
#define WIFI_PASSWORD "your-wifi-password"

// ---- MQTT broker (Mosquitto on your Dokploy host) ----
#define MQTT_HOST "your-server-domain-or-ip"  // e.g. "mqtt.example.com"
#define MQTT_PORT 1883
#define MQTT_USERNAME "device"                 // MQTT user for the device
#define MQTT_PASSWORD "change-me-device-pass"

// ---- Device identity ----
// DEVICE_ID must match the DEVICE_ID env var in the web app.
#define DEVICE_ID "bar-01"
// DEVICE_KEY must match the DEVICE_KEY env var in the web app (shared secret
// included in every payload so the server can reject spoofed messages).
#define DEVICE_KEY "change-me-device-key"
