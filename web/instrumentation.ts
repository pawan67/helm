/**
 * Next.js runs this once when the server process starts (both dev and the
 * standalone production server). We use it to open the long-lived MQTT
 * subscription. Guarded to the Node.js runtime so it never runs on the Edge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMqtt } = await import("@/lib/mqtt");
    startMqtt();
  }
}
