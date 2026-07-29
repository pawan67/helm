/**
 * Centralised, typed access to environment variables.
 * Server-only. Never import this from a client component.
 */

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined || value === "") {
    // During `next build` some env vars are legitimately absent; only throw at
    // runtime when the value is actually used via the getters below.
    return "";
  }
  return value;
}

export const env = {
  get appPassword() {
    return required("APP_PASSWORD");
  },
  get sessionSecret() {
    return required("SESSION_SECRET", "dev-insecure-secret-change-me");
  },
  get databaseUrl() {
    return required("DATABASE_URL", "postgres://postgres:postgres@localhost:5432/pullups");
  },
  get mqttUrl() {
    return required("MQTT_URL", "mqtt://localhost:1883");
  },
  get mqttUser() {
    return required("MQTT_USER");
  },
  get mqttPass() {
    return required("MQTT_PASS");
  },
  get deviceId() {
    return required("DEVICE_ID", "bar-01");
  },
  get deviceKey() {
    return required("DEVICE_KEY");
  },
  get timezone() {
    return required("APP_TIMEZONE", "UTC");
  },
  /** Publish Home Assistant MQTT discovery for IR devices (default on). */
  get haDiscoveryEnabled() {
    return required("HA_DISCOVERY_ENABLED", "true").toLowerCase() !== "false";
  },
  /** HA MQTT discovery prefix (must match HA's `discovery_prefix`). */
  get haDiscoveryPrefix() {
    return required("HA_DISCOVERY_PREFIX", "homeassistant");
  },
  /**
   * Base URL the bar node uses to download a firmware image during an OTA push
   * (e.g. `http://192.168.1.50:3000`). Leave unset to derive it from the origin
   * the operator's browser used to trigger the push — correct in most setups.
   */
  get otaBaseUrl() {
    return required("OTA_BASE_URL");
  },
};

export const DEVICE_ID = env.deviceId;
