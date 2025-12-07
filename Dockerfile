# =============================================================================
# Base Stage - Bun runtime
# =============================================================================
FROM oven/bun:1 AS base

WORKDIR /app

# =============================================================================
# Install Dependencies Stage
# =============================================================================
FROM base AS install

# Copy manifests and workspaces (respects .dockerignore) so Bun can resolve workspace:* links
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages

# Install all dependencies
RUN bun install --frozen-lockfile

# =============================================================================
# Install Dependencies Stage (production only)
# =============================================================================
FROM base AS install-prod

# Copy manifests and workspaces (respects .dockerignore) so Bun can resolve workspace:* links
COPY package.json bun.lock ./
COPY apps ./apps
COPY packages ./packages

# Install only production dependencies
RUN bun install --frozen-lockfile --production

# =============================================================================
# Build Stage - Server only (avoid frontend env leakage)
# =============================================================================
FROM install AS build-server

# OpenSSL needed for Prisma engines during build
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Set dummy DATABASE_URL for Prisma generation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Generate Prisma client from prisma workspace
WORKDIR /app/packages/prisma
RUN bun x prisma generate
WORKDIR /app

# Build server using Bun bundler
WORKDIR /app/apps/server
RUN bun run build
WORKDIR /app

# =============================================================================
# Build Stage - Frontends only (explicit build args)
# =============================================================================
FROM install AS build-web

ARG VITE_CAS_PROXY_URL
ARG VITE_CLIENT_SENTRY_DSN
ARG VITE_KIOSK_SENTRY_DSN
ARG TZ
ENV VITE_CAS_PROXY_URL=$VITE_CAS_PROXY_URL
ENV VITE_CLIENT_SENTRY_DSN=$VITE_CLIENT_SENTRY_DSN
ENV VITE_KIOSK_SENTRY_DSN=$VITE_KIOSK_SENTRY_DSN
ENV TZ=${TZ:-America/New_York}

# Build client and kiosk with Vite
WORKDIR /app/apps/client
RUN bun run build
WORKDIR /app/apps/kiosk
RUN bun run build
WORKDIR /app

# =============================================================================
# Prisma Migration Runner (one-shot)
# =============================================================================
FROM install-prod AS prisma-migrate

WORKDIR /app/packages/prisma

# OpenSSL needed for Prisma engines at runtime
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user if missing (oven/bun already provides `bun` user)
RUN id -u bun >/dev/null 2>&1 || useradd -m -u 1001 bun
RUN chown -R bun:bun /app

USER bun

# Default command to run migrations
CMD ["bun", "x", "prisma", "migrate", "deploy"]

# =============================================================================
# Server Production Image
# =============================================================================
FROM base AS server

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ldap-utils \
    openssl \
    && rm -rf /var/lib/apt/lists/*

# Copy built server code
COPY --from=build-server /app/apps/server/dist /app/apps/server/dist

# Copy Prisma files for runtime access
COPY --from=build-server /app/packages/prisma /app/packages/prisma

# Copy production dependency set
COPY --from=install-prod /app/node_modules /app/node_modules
COPY --from=install-prod /app/package.json /app/package.json
COPY --from=install-prod /app/apps/server/package.json /app/apps/server/package.json
COPY --from=install-prod /app/bun.lock /app/bun.lock

WORKDIR /app

# Set environment to production
ENV NODE_ENV=production

# Create non-root user if missing (oven/bun already provides `bun` user)
RUN id -u bun >/dev/null 2>&1 || useradd -m -u 1001 bun
RUN chown -R bun:bun /app

USER bun

# Expose server port (default 44830)
EXPOSE 44830

# Health check against running server (uses /api root which returns 200)
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:44830/api || exit 1

# Start the server using the built index.js
CMD ["bun", "/app/apps/server/dist/index.js"]

# =============================================================================
# NGINX Proxy with Client and Kiosk Static Files
# =============================================================================
FROM nginx:alpine AS nginx

ARG VITE_CAS_PROXY_URL
ARG VITE_CLIENT_SENTRY_DSN
ARG VITE_KIOSK_SENTRY_DSN
ARG TZ

# Copy built static files
COPY --from=build-web /app/apps/client/dist /usr/share/nginx/html/client
COPY --from=build-web /app/apps/kiosk/dist /usr/share/nginx/html/kiosk

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
