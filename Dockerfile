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
RUN corepack enable && corepack prepare pnpm@latest --activate

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

# Build the API package first, then the web app
RUN pnpm --filter @30nama/api build || true
RUN pnpm --filter @30nama/web build

# `pnpm deploy` creates a standalone directory with a regular (non-symlinked)
# node_modules — safe to COPY into the lean runner stage.
# The dist/ output and server.mjs are layered on top afterwards.
RUN pnpm deploy --filter @30nama/web --prod --legacy /standalone && \
    cp -r /app/apps/web/dist   /standalone/dist && \
    cp     /app/apps/web/server.mjs /standalone/server.mjs

# ────────────────────────────────────────────────────────────
# Stage 3 – production image (lean)
# ────────────────────────────────────────────────────────────
FROM node:22-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app

# /standalone contains: node_modules/ (prod-only, no pnpm symlinks),
# dist/ (client + server bundles), server.mjs (Node:http adapter)
COPY --from=builder /standalone .

EXPOSE 3000

CMD ["node", "server.mjs"]
