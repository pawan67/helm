# HELM web console

The Next.js console for HELM. It subscribes to the bar node over MQTT, persists
sessions and climate readings to Postgres, and streams live telemetry to the
browser over Server-Sent Events. The detection state machine in
`src/lib/detection.ts` is mirrored one-to-one on-device in
`firmware/helm/helm.ino`, so the unit tests validate both.

Setup, deployment, and hardware wiring live in the [root README](../README.md).
This file covers the web app itself.

## Stack

- Next.js 16 (App Router) + React 19, TypeScript
- Chakra UI v3 with a custom slate/lime theme (`src/theme/system.ts`)
- Drizzle ORM on Postgres
- `mqtt` for device telemetry, SSE for the browser, `jose` for the session cookie

## Scripts

```bash
pnpm dev          # dev server on http://localhost:3000
pnpm build        # production build
pnpm start        # serve the build
pnpm typecheck    # tsc --noEmit
pnpm test         # vitest: detection, streaks, env bucketing, IR + HA discovery
pnpm db:migrate   # apply pending migrations (also runs on boot)
pnpm db:generate  # generate a migration from schema.ts
```

No hardware? Simulate the bar node in another terminal:

```bash
pnpm mock-device reps 10   # a 10-rep set
pnpm mock-device hang 30   # a 30s dead hang
pnpm mock-device env 20    # 20 climate readings
pnpm mock-device loop      # random sessions forever
pnpm seed-env 30           # backfill 30 days of climate history
```

## Layout

```
src/app/          pages (App Router) + API routes
src/components/    app shell, charts, live screen, remote, settings
src/lib/           detection, mqtt, live bus, auth, streaks, env series
src/db/            schema, queries, persistence, migration runner
src/theme/         Chakra system (tokens, recipes)
scripts/           mock-device, seed-env, migrate-runner
```

Copy `.env.example` to `.env` to configure. The variables are documented in the
[root README](../README.md#environment-variables).
