/*
 * Standalone migration runner. Applies the SQL files drizzle-kit generated in
 * ./drizzle, tracking applied ones in a `_migrations` table. Uses only the
 * `postgres` driver (no drizzle-orm migrator) so it can run as a plain
 * `node scripts/migrate-runner.mjs` step at container start — outside the Next
 * bundle, avoiding webpack's node: scheme issues.
 *
 * Dev:  pnpm db:migrate
 * Prod: run automatically before `node server.js` (see Dockerfile CMD).
 */
import postgres from "postgres";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

try {
  process.loadEnvFile(".env");
} catch {
  /* no .env file — rely on process.env */
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("[migrate] DATABASE_URL is not set");
  process.exit(1);
}

const dir = process.env.MIGRATIONS_DIR ?? "./drizzle";
const sql = postgres(url, { max: 1 });

async function main() {
  await sql`
    CREATE TABLE IF NOT EXISTS _migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`;

  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const done = await sql`SELECT 1 FROM _migrations WHERE id = ${file}`;
    if (done.length > 0) {
      console.log(`[migrate] skip ${file}`);
      continue;
    }

    const raw = readFileSync(join(dir, file), "utf8");
    const statements = raw
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);

    await sql.begin(async (tx) => {
      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }
      await tx`INSERT INTO _migrations (id) VALUES (${file})`;
    });
    console.log(`[migrate] applied ${file}`);
  }

  console.log("[migrate] database up to date");
}

main()
  .then(() => sql.end())
  .catch(async (err) => {
    console.error("[migrate] failed:", err);
    await sql.end();
    process.exit(1);
  });
