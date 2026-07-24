import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/lib/env";
import * as schema from "./schema";

/**
 * A single postgres connection pool reused across hot reloads in dev and for the
 * lifetime of the process in production.
 */
const globalForDb = globalThis as unknown as {
  __sql?: ReturnType<typeof postgres>;
};

const sql =
  globalForDb.__sql ??
  postgres(env.databaseUrl, {
    max: 10,
    // Long-lived server; keep connections warm.
    idle_timeout: 20,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sql = sql;
}

export const db = drizzle(sql, { schema });
export { schema };
