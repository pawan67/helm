# syntax=docker/dockerfile:1

# ---- deps: install all dependencies ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile the Next.js standalone output ----
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build
# Next.js standalone doesn't require a public/ dir, and this project has none.
# Ensure it exists so the runner's COPY below never fails (and works if assets
# are added later).
RUN mkdir -p public

# ---- runner: minimal production image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone server + assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# Migration SQL + runner, applied at container start (before the server boots).
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=nextjs:nodejs /app/scripts/migrate-runner.mjs ./scripts/migrate-runner.mjs

USER nextjs
EXPOSE 3000
# Apply pending migrations, then start the standalone server.
CMD ["sh", "-c", "node scripts/migrate-runner.mjs && node server.js"]
