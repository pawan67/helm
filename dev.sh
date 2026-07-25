#!/usr/bin/env bash
#
# dev.sh — one command to run the whole HELM web stack locally.
#
# Brings up Postgres + Mosquitto (in Docker), applies DB migrations, then starts
# the Next.js dev server — all wired to the ports/credentials in web/.env.
# Optionally streams a simulated ESP32 so the live screen has data with no hardware.
#
# Usage:
#   ./dev.sh              start db + mqtt, migrate, run the dev server (foreground)
#   ./dev.sh --mock       ...and also run the mock device in loop mode alongside it
#   ./dev.sh down         stop & remove the dev containers (DB data is kept)
#   ./dev.sh reset        wipe the DB volume for a clean slate, then start fresh
#   ./dev.sh -h|--help    show this help
#
# Containers keep running after you Ctrl+C the dev server, so restarts are fast.
# Run `./dev.sh down` when you want to tear them down.
#
set -euo pipefail

SELF="${BASH_SOURCE[0]}"
ROOT="$(cd "$(dirname "$SELF")" && pwd)"
WEB="$ROOT/web"

DB_CONTAINER=pt-dev-db
MQTT_CONTAINER=pt-dev-mqtt
DB_VOLUME=pt-dev-db-data
PG_IMAGE=postgres:16-alpine
MQTT_IMAGE=eclipse-mosquitto:2

# --- pretty logging -----------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BLUE=$'\033[34m'; C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'; C_RED=$'\033[31m'; C_DIM=$'\033[2m'
else
  C_RESET=; C_BLUE=; C_GREEN=; C_YELLOW=; C_RED=; C_DIM=
fi
info() { printf '%s▸%s %s\n' "$C_BLUE" "$C_RESET" "$*"; }
ok()   { printf '%s✓%s %s\n' "$C_GREEN" "$C_RESET" "$*"; }
warn() { printf '%s!%s %s\n' "$C_YELLOW" "$C_RESET" "$*"; }
err()  { printf '%s✗%s %s\n' "$C_RED" "$C_RESET" "$*" >&2; }

usage() {
  sed -n '3,17p' "$SELF" | sed 's/^# \{0,1\}//'
}

# --- arg parsing --------------------------------------------------------------
MOCK=0
CMD=start
for arg in "$@"; do
  case "$arg" in
    --mock|mock)   MOCK=1 ;;
    down|stop)     CMD=down ;;
    reset|fresh)   CMD=reset ;;
    -h|--help)     usage; exit 0 ;;
    *) err "unknown argument: $arg"; echo; usage; exit 1 ;;
  esac
done

# --- prerequisites ------------------------------------------------------------
command -v docker >/dev/null 2>&1 || { err "docker is required but not found on PATH"; exit 1; }
docker info >/dev/null 2>&1 || { err "docker daemon is not reachable — is Docker running?"; exit 1; }

if [[ "$CMD" == "start" || "$CMD" == "reset" ]]; then
  command -v pnpm >/dev/null 2>&1 || {
    err "pnpm is required but not found. Enable it with:  corepack enable"
    exit 1
  }
fi

# --- config from web/.env -----------------------------------------------------
if [[ ! -f "$WEB/.env" ]]; then
  cp "$WEB/.env.example" "$WEB/.env"
  warn "created web/.env from .env.example — review the secrets in it before real use"
fi

# Read a KEY=value line from web/.env (last wins), stripping CR and surrounding quotes.
env_val() {
  grep -E "^$1=" "$WEB/.env" 2>/dev/null | tail -n1 | cut -d= -f2- | tr -d '\r' \
    | sed -E "s/^\"(.*)\"$/\1/; s/^'(.*)'$/\1/"
}

DATABASE_URL="$(env_val DATABASE_URL)"
MQTT_URL="$(env_val MQTT_URL)"

# Parse the Postgres URL: postgres://USER:PASS@HOST:PORT/DB
PG_USER="$(sed -E 's#^postgres(ql)?://([^:]+):.*#\2#'   <<<"$DATABASE_URL")"
PG_PASS="$(sed -E 's#^postgres(ql)?://[^:]+:([^@]+)@.*#\2#' <<<"$DATABASE_URL")"
PG_DB="$(  sed -E 's#.*/([^/?]+)(\?.*)?$#\1#'           <<<"$DATABASE_URL")"
DB_PORT="$(sed -E 's#.*@[^:]+:([0-9]+)/.*#\1#'          <<<"$DATABASE_URL")"
MQTT_PORT="$(sed -E 's#.*:([0-9]+).*#\1#'               <<<"$MQTT_URL")"

# Fall back to the .env.example defaults if anything failed to parse.
[[ "$DB_PORT"   =~ ^[0-9]+$ ]] || DB_PORT=5455
[[ "$MQTT_PORT" =~ ^[0-9]+$ ]] || MQTT_PORT=1884
[[ -n "$PG_USER" ]] || PG_USER=postgres
[[ -n "$PG_PASS" ]] || PG_PASS=postgres
[[ -n "$PG_DB"   ]] || PG_DB=pullups

# --- container helpers --------------------------------------------------------
container_state() { docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || echo missing; }

db_up() {
  case "$(container_state "$DB_CONTAINER")" in
    true)  ok "postgres already running  (localhost:$DB_PORT)" ;;
    false) docker start "$DB_CONTAINER" >/dev/null; ok "postgres started  (localhost:$DB_PORT)" ;;
    *)
      info "creating postgres container on localhost:$DB_PORT ..."
      docker run -d --name "$DB_CONTAINER" \
        -e POSTGRES_USER="$PG_USER" \
        -e POSTGRES_PASSWORD="$PG_PASS" \
        -e POSTGRES_DB="$PG_DB" \
        -p "$DB_PORT:5432" \
        -v "$DB_VOLUME:/var/lib/postgresql/data" \
        "$PG_IMAGE" >/dev/null
      ok "postgres created  (localhost:$DB_PORT)"
      ;;
  esac
}

mqtt_up() {
  case "$(container_state "$MQTT_CONTAINER")" in
    true)  ok "mosquitto already running  (localhost:$MQTT_PORT)" ;;
    false) docker start "$MQTT_CONTAINER" >/dev/null; ok "mosquitto started  (localhost:$MQTT_PORT)" ;;
    *)
      info "creating mosquitto container on localhost:$MQTT_PORT ..."
      docker run -d --name "$MQTT_CONTAINER" \
        -p "$MQTT_PORT:1883" \
        -v "$ROOT/mosquitto/dev.conf:/mosquitto/config/mosquitto.conf:ro" \
        "$MQTT_IMAGE" >/dev/null
      ok "mosquitto created  (localhost:$MQTT_PORT)"
      ;;
  esac
}

wait_db() {
  info "waiting for postgres to accept connections ..."
  for _ in $(seq 1 30); do
    if docker exec "$DB_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null 2>&1; then
      ok "postgres ready"
      return 0
    fi
    sleep 1
  done
  err "postgres did not become ready in time"
  exit 1
}

down() {
  info "stopping dev containers ..."
  docker rm -f "$DB_CONTAINER" "$MQTT_CONTAINER" >/dev/null 2>&1 || true
  ok "containers removed  ${C_DIM}(DB volume '$DB_VOLUME' kept — use 'reset' to wipe)${C_RESET}"
}

reset() {
  down
  docker volume rm "$DB_VOLUME" >/dev/null 2>&1 || true
  ok "database volume wiped — starting with a clean database"
}

# --- commands -----------------------------------------------------------------
if [[ "$CMD" == "down" ]]; then
  down
  exit 0
fi

if [[ "$CMD" == "reset" ]]; then
  reset
fi

printf '\n%s╭─ HELM dev stack ─────────────────────────────────╮%s\n' "$C_DIM" "$C_RESET"
printf   '%s│%s db   postgres   localhost:%-5s  db=%s\n' "$C_DIM" "$C_RESET" "$DB_PORT" "$PG_DB"
printf   '%s│%s mqtt mosquitto  localhost:%-5s  (anonymous)\n' "$C_DIM" "$C_RESET" "$MQTT_PORT"
printf   '%s│%s web  next dev   http://localhost:3000\n' "$C_DIM" "$C_RESET"
printf   '%s╰──────────────────────────────────────────────────╯%s\n\n' "$C_DIM" "$C_RESET"

db_up
mqtt_up
wait_db

if [[ ! -d "$WEB/node_modules" ]]; then
  info "installing web dependencies (pnpm install) ..."
  (cd "$WEB" && pnpm install)
fi

info "applying database migrations ..."
(cd "$WEB" && pnpm db:migrate)

# Optional: stream a simulated device so the live screen has data.
MOCK_PID=
_CLEANED=0
cleanup() {
  [[ "$_CLEANED" == 1 ]] && return
  _CLEANED=1
  [[ -n "$MOCK_PID" ]] && kill "$MOCK_PID" 2>/dev/null || true
  echo
  info "dev server stopped. Containers left running — './dev.sh down' to remove them."
}
trap cleanup EXIT INT TERM

if [[ "$MOCK" == 1 ]]; then
  info "starting mock device (loop mode) ..."
  (cd "$WEB" && pnpm mock-device loop) &
  MOCK_PID=$!
fi

info "starting Next.js dev server → ${C_GREEN}http://localhost:3000${C_RESET}  ${C_DIM}(Ctrl+C to stop)${C_RESET}"
(cd "$WEB" && pnpm dev)
