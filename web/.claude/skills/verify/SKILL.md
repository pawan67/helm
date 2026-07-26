---
name: verify
description: Build/launch/drive recipe for verifying the Helm web app at runtime — including screenshotting authenticated pages.
---

# Verifying the Helm web app

Runtime observation for `web/`. Next.js 16 (webpack) + Chakra v3 + Postgres (Drizzle) + MQTT.

## Handles that already exist
- **Dev server**: usually already running on `http://localhost:3000` (from `web/`). Next 16 allows only one dev instance — don't start a second (`npm run dev` will just print "Another next dev server is already running"). If none is up, `npm run dev` (reads `.env`).
- **Postgres**: docker container `pt-dev-db` on host port **5455**, db `pullups`, user `postgres`. Query with `docker exec pt-dev-db psql -U postgres -d pullups -tc "..."`.
- **MQTT**: docker container `pt-dev-mqtt` on 1884.

## Auth (needed for everything except /login)
Password lives in `web/.env` as `APP_PASSWORD`. Session cookie name is `pt_session` (signed, `web/src/lib/session.ts`).
```bash
PW=$(grep '^APP_PASSWORD=' .env | cut -d= -f2-)
curl -s -c /tmp/cj.txt -H 'Content-Type: application/json' -d "{\"password\":\"$PW\"}" \
  http://localhost:3000/api/auth/login    # -> {"ok":true}, writes pt_session to /tmp/cj.txt
```
Then hit the API surface directly: `curl -s -b /tmp/cj.txt "http://localhost:3000/api/sessions?type=dead_hang&from=2026-07-25&to=2026-07-25&page=2"`.

## Screenshotting an authenticated page (GUI surface)
Playwright/puppeteer are NOT installed. Use headless `google-chrome-stable` driven over CDP from a Node script (Node 22 has a global `WebSocket`). Inject the `pt_session` cookie via `Network.setCookie`, navigate, then `Page.captureScreenshot`. A reusable pair of scripts (screenshot + interaction-driver) was written to the session scratchpad — pattern:
1. spawn `google-chrome-stable --headless=new --remote-debugging-port=PORT --remote-allow-origins=* --user-data-dir=$(mktemp -d) --no-sandbox --window-size=1440,3200`
2. `GET http://localhost:PORT/json` → find target with `type:"page"` → connect its `webSocketDebuggerUrl`
3. `Network.enable` → `Network.setCookie {name:"pt_session", value:<from /tmp/cj.txt>, domain:"localhost", path:"/", httpOnly:true}` → `Page.enable` → `Page.navigate` → **sleep ~9s** (dev-mode first-compile + client fetch are slow) → `Page.captureScreenshot {captureBeyondViewport:true}`.
4. To drive UI, `Runtime.evaluate` with `returnByValue:true` (e.g. click `thead input[type=checkbox]`, click a segment by text, click `[aria-label="Next page"]`), then read back `document.body.innerText`.

Gotchas:
- `--remote-allow-origins=*` is required (Chrome ≥111 rejects CDP WS otherwise).
- Charts (recharts `ResponsiveContainer`) render blank for the first few seconds in headless until the container is measured — wait before shooting.
- The `/history` client table fetches `/api/sessions` on mount; give it time before asserting row content.

## Don't
- Don't treat `npm test` / `tsc --noEmit` as verification (they're CI). Drive the running app.
