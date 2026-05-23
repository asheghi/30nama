# syntax=docker/dockerfile:1
# Build from the repo root:
#   docker build -t 30nama-web .
#   docker run -p 3000:3000 30nama-web

# ────────────────────────────────────────────────────────────
# Stage 1 – install all workspace dependencies
# ────────────────────────────────────────────────────────────
FROM node:22-slim AS deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

# Pin to the exact version declared in package.json#packageManager so the
# build is reproducible regardless of when the image is built.
RUN corepack enable && corepack prepare pnpm@11.2.2 --activate

WORKDIR /app

# Copy manifests first so the layer is cached until deps change
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/api/package.json packages/api/
COPY apps/web/package.json       apps/web/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ────────────────────────────────────────────────────────────
# Stage 2 – build
# ────────────────────────────────────────────────────────────
FROM deps AS builder

# Copy full source now that deps are cached
COPY . .

# @30nama/api has no separate compile step — it exports raw TypeScript and
# is bundled inline by Vite. The "|| true" keeps the layer from failing on
# that missing script while still running a real build if one is added later.
RUN pnpm --filter @30nama/api build || true
RUN pnpm --filter @30nama/web build

# `pnpm deploy` creates a standalone directory with a regular (non-symlinked)
# node_modules — safe to COPY into the lean runner stage.
RUN pnpm deploy --filter @30nama/web --prod --legacy /standalone && \
    cp -r /app/apps/web/dist       /standalone/dist && \
    cp     /app/apps/web/server.mjs /standalone/server.mjs

# ────────────────────────────────────────────────────────────
# Stage 3 – production image (lean)
# ────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# Run as a non-root user — required by most container security policies and
# a best practice even where it isn't enforced.
RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 --ingroup nodejs nodeapp

# /standalone contains: node_modules/ (prod-only, no pnpm symlinks),
# dist/ (client + server bundles), server.mjs (Node:http adapter)
COPY --from=builder --chown=nodeapp:nodejs /standalone .

USER nodeapp

EXPOSE 3000

# Lightweight liveness probe using Node's built-in fetch (no extra binaries).
# Hits the SSR root and expects a 2xx response within 5 s.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:' + (process.env.PORT||3000) + '/').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.mjs"]
