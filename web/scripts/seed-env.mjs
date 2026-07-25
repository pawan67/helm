/*
 * Seed synthetic ambient readings into env_readings across the past N days, so
 * the Environment view + getEnvSeries() aggregation have data to render without
 * waiting for real samples (the server stamps live env with receive time, so it
 * can only ever fill the current bucket).
 *
 *   pnpm seed-env          # 30 days, one reading every 10 minutes
 *   pnpm seed-env 7        # last 7 days only
 *
 * Uses the raw `postgres` driver (like migrate-runner) to avoid the Next bundle.
 */
import postgres from "postgres";

try {
  process.loadEnvFile(".env");
} catch {
  /* no .env — rely on process.env */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[seed-env] DATABASE_URL is not set");
  process.exit(1);
}

const deviceId = process.env.DEVICE_ID ?? "bar-01";
const days = Number(process.argv[2]) || 30;
const stepMs = 10 * 60 * 1000; // one reading every 10 minutes
const sql = postgres(url, { max: 1 });

/** A gentle daily cycle: coolest ~5am, warmest ~3pm, plus a little noise. */
function sample(at) {
  const hour = at.getHours() + at.getMinutes() / 60;
  const phase = ((hour - 9) / 24) * 2 * Math.PI; // peak mid-afternoon
  const tempC = Math.round((22 + Math.sin(phase) * 3 + (Math.random() - 0.5)) * 10) / 10;
  const humidity = Math.round(50 - Math.sin(phase) * 10 + (Math.random() - 0.5) * 4);
  return { tempC, humidity };
}

async function main() {
  const now = Date.now();
  const rows = [];
  for (let t = now - days * 24 * 60 * 60 * 1000; t <= now; t += stepMs) {
    const at = new Date(t);
    const { tempC, humidity } = sample(at);
    rows.push({ device_id: deviceId, at, temp_c: tempC, humidity });
  }

  // Insert in chunks to keep statements a sane size.
  const CHUNK = 1000;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await sql`INSERT INTO env_readings ${sql(chunk, "device_id", "at", "temp_c", "humidity")}`;
  }

  console.log(`[seed-env] inserted ${rows.length} readings over ${days} days for ${deviceId}`);
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("[seed-env] failed:", err);
    await sql.end();
    process.exit(1);
  });
