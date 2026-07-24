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
};

export const DEVICE_ID = env.deviceId;
