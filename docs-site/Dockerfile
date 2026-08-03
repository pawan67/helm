# syntax=docker/dockerfile:1

# ---- deps: install all dependencies ----
FROM node:22-alpine AS deps
RUN corepack enable
WORKDIR /app
# fumadocs-mdx runs as a postinstall step; it inspects next.config.mjs to pick the
# Next (not Vite) codegen path and reads source.config.ts, so both must be present
# at install time or the postinstall crashes with a "Cannot find package 'vite'".
COPY package.json pnpm-lock.yaml next.config.mjs source.config.ts ./
RUN pnpm install --frozen-lockfile

# ---- builder: compile the Next.js standalone output ----
FROM node:22-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` (via createMDX) regenerates .source from the real content/ here.
RUN pnpm build
# This project has no public/ dir; create it so the runner's COPY below succeeds.
RUN mkdir -p public

# ---- runner: minimal production image ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Standalone server + static assets. This project has no public/ dir; the builder
# creates an empty one so this COPY never fails (and picks up assets if added).
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
