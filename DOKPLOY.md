# Deploying HELM on Dokploy

This deploys the web app + MQTT broker from `docker-compose.dokploy.yml`, with
**Postgres running as a separate Dokploy app** so your data survives every
rebuild and redeploy of HELM.

```
ESP32 ──MQTT/1883──▶ Mosquitto ──▶ web (Next.js) ──▶ Postgres (separate Dokploy app)
                                        ▲
                                   your Domain (Traefik)
```

Nothing secret lives in the repo: the Mosquitto password file is generated
from env vars at container start.

---

## 1. Create the Postgres app (do this first)

In Dokploy: **Create → Database → Postgres**.

- Give it a name, user, password, and database name (e.g. db `pullups`).
- Deploy it and let it start.
- Open its page and copy the **Internal** connection details. The internal
  host is the database's service name on `dokploy-network` — you'll use it in
  `DATABASE_URL` below. It looks like:

  ```
  postgres://<user>:<password>@<internal-host>:5432/<database>
  ```

> Keeping Postgres as its own app is the whole point: redeploying HELM never
> touches this database, and you can back it up independently.

## 2. Create the HELM Compose app

In Dokploy: **Create → Compose**.

- Point it at this Git repo (branch `main`).
- Set **Compose Path** to `docker-compose.dokploy.yml`.

## 3. Set environment variables

Copy `.env.dokploy.example` into the Compose app's **Environment** tab and fill
in real values:

| Variable | What it is |
|---|---|
| `DATABASE_URL` | The **internal** URL from your Postgres app (step 1) |
| `APP_PASSWORD` | Password you type to log into the web UI |
| `SESSION_SECRET` | Cookie signing secret — `openssl rand -hex 32` |
| `MQTT_SERVER_USER` / `MQTT_SERVER_PASS` | The web app's broker login |
| `MQTT_DEVICE_USER` / `MQTT_DEVICE_PASS` | The ESP32's broker login |
| `DEVICE_ID` / `DEVICE_KEY` | Must match the firmware `config.h` |
| `APP_TIMEZONE` | e.g. `America/New_York` — used for local-day rollups |

The MQTT broker's password file is built from `MQTT_*` values at startup, so
`server` and `device` users just work — no manual `mosquitto_passwd` step.

## 4. Deploy

Hit **Deploy**. On start, the `web` container applies pending DB migrations
(`node scripts/migrate-runner.mjs`) against your external Postgres, then boots
the Next.js server. If Postgres isn't reachable yet, the container restarts
until it is.

## 5. Map your domain

In the Compose app's **Domains** tab, add your domain pointing at:

- **Service:** `web`
- **Container Port:** `3000`

Dokploy's Traefik handles TLS and routes over `dokploy-network`.

## 6. Open MQTT to your ESP32

Port **1883** is published on the host for the ESP32 (which lives outside
Docker). Make sure it's reachable from where your device is:

- Open `1883/tcp` on the server's firewall / cloud security group.
- Point the firmware at `your-server-host:1883`.

## 7. Point the firmware at it

In `firmware/helm/config.h`, set:

- `MQTT_HOST` → your server host/IP
- `MQTT_PORT` → `1883`
- `MQTT_USERNAME` / `MQTT_PASSWORD` → the `MQTT_DEVICE_USER` / `MQTT_DEVICE_PASS`
  you set in step 3
- `DEVICE_ID` / `DEVICE_KEY` → same as the env vars

---

## Networking notes

- Both `web` and `mqtt` join the external `dokploy-network`. That's how `web`
  reaches your separate Postgres app and how Traefik reaches `web`. Dokploy
  creates this network; the compose file references it with `external: true`.
- If Dokploy ever reports `network dokploy-network not found`, redeploy from
  the Dokploy UI (it ensures the network exists) rather than running compose by
  hand.

## Updating / redeploying

Push to `main` and redeploy the Compose app in Dokploy. Only `web` and `mqtt`
are rebuilt — **your Postgres app and its data are untouched.**

## Local development

The original all-in-one `docker-compose.yml` (which bundles its own Postgres)
is still there for local use. This `docker-compose.dokploy.yml` is the one for
Dokploy with an external database.
