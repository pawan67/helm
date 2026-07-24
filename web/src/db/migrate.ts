import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { eq } from "drizzle-orm";
import { env } from "@/lib/env";
import { settings, DEFAULT_THRESHOLDS } from "./schema";

/**
 * Run pending migrations, then ensure the single settings row exists. Invoked
 * on container start (see Dockerfile CMD) and via `pnpm db:migrate`.
 */
async function main() {
  const sql = postgres(env.databaseUrl, { max: 1 });
  const database = drizzle(sql);

  console.log("[migrate] applying migrations…");
  await migrate(database, { migrationsFolder: "./drizzle" });

  // Seed the settings row if missing.
  const existing = await database.select().from(settings).where(eq(settings.id, 1));
  if (existing.length === 0) {
    console.log("[migrate] seeding default settings…");
    await database.insert(settings).values({
      id: 1,
      deviceId: env.deviceId,
      thresholds: DEFAULT_THRESHOLDS,
    });
  }

  console.log("[migrate] done.");
  await sql.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
