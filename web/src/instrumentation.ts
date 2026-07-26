/**
 * Next.js runs this once when the server process starts (dev + standalone prod).
 * We open the long-lived MQTT subscription here.
 *
 * The `process.env.NEXT_RUNTIME === "nodejs"` guard wrapping the dynamic import
 * is load-bearing: Next replaces NEXT_RUNTIME with a literal per build, so the
 * Edge build dead-code-eliminates this block entirely and never tries to bundle
 * the Node-only MQTT / postgres graph (which imports net/tls/perf_hooks).
 *
 * Database migrations run as a separate startup step (scripts/migrate-runner.mjs
 * via the Dockerfile CMD, or `pnpm db:migrate` in dev), not from here.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startMqtt } = await import("@/lib/mqtt");
    startMqtt();
    const { startScheduler } = await import("@/lib/scheduler");
    startScheduler();
  }
}
