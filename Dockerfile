# =============================================================================
# Base Stage - Common setup for all services
# =============================================================================
FROM node:22-alpine AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install runtime dependencies once for reuse
# Only server needs these, but we install them here to cache the layer
RUN apk add --no-cache \
    git

WORKDIR /app

# =============================================================================
# Dependencies Stage - Install all dependencies with cache mounting
# =============================================================================
FROM base AS deps

# Copy package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json ./apps/server/
COPY apps/client/package.json ./apps/client/
COPY apps/kiosk/package.json ./apps/kiosk/
COPY packages/auth/package.json ./packages/auth/
COPY packages/config/package.json ./packages/config/
COPY packages/env/package.json ./packages/env/
COPY packages/features/package.json ./packages/features/
COPY packages/ldap/package.json ./packages/ldap/
COPY packages/prisma/package.json ./packages/prisma/
COPY packages/trpc/package.json ./packages/trpc/
COPY packages/workers/package.json ./packages/workers/

# Install dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# =============================================================================
# Build Stage - Build all applications
# =============================================================================
FROM deps AS build

ARG VITE_CAS_PROXY_URL
ENV VITE_CAS_PROXY_URL=$VITE_CAS_PROXY_URL

# Copy source code
COPY . .

# Set dummy DATABASE_URL for Prisma generation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Generate Prisma client
RUN pnpm --filter @ecehive/prisma exec prisma generate

# Build all apps in parallel
RUN pnpm --filter @ecehive/client build
RUN pnpm --filter @ecehive/kiosk build

# =============================================================================
# Server Production Dependencies
# =============================================================================
FROM build AS server-prod-deps

# Deploy server with production dependencies only
RUN pnpm deploy --filter=@ecehive/server --prod --legacy /prod/server

# Copy Prisma files for migrations
RUN mkdir -p /prod/server/prisma && \
    cp -R packages/prisma/migrations /prod/server/prisma/ 2>/dev/null || true && \
    cp packages/prisma/schema.prisma /prod/server/prisma/schema.prisma 2>/dev/null || true

# =============================================================================
# Prisma Production Dependencies
# =============================================================================
FROM build AS prisma-prod-deps

# Deploy prisma with production dependencies only
RUN pnpm deploy --filter=@ecehive/prisma --prod --legacy /prod/prisma

# =============================================================================
# Prisma Migration Runner (one-shot)
# =============================================================================
FROM base AS prisma-migrate

# Copy production prisma artifacts
COPY --from=prisma-prod-deps /prod/prisma /prod/prisma

WORKDIR /prod/prisma

# Create non-root user and fix ownership
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /prod/prisma

USER nodejs

# Default command to run migrations (override at runtime as needed)
CMD ["pnpm", "migrate"]

# =============================================================================
# Server Production Image
# =============================================================================

FROM base AS server

# Install runtime-only packages needed by the server (kept out of the shared base
# layer to reduce build-stage image sizes)
RUN apk add --no-cache openldap-clients

# Copy production dependencies and code
COPY --from=server-prod-deps /prod/server /prod/server

WORKDIR /prod/server

# Set environment to production
ENV NODE_ENV=production

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /prod/server

USER nodejs

# Expose server port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:80/api/health || exit 1

# Start the server
CMD ["pnpm", "start"]

# =============================================================================
# Client Production Image
# =============================================================================
FROM caddy:2-alpine AS client

# Copy built static files
COPY --from=build /app/apps/client/dist /srv

# Create optimized Caddyfile
RUN printf '{\n\
    auto_https off\n\
    admin off\n\
}\n\
\n\
:80 {\n\
    root * /srv\n\
    encode gzip zstd\n\
    file_server\n\
    try_files {path} /index.html\n\
    \n\
    header {\n\
        -Server\n\
        X-Content-Type-Options "nosniff"\n\
        X-Frame-Options "DENY"\n\
        Referrer-Policy "no-referrer-when-downgrade"\n\
    }\n\
    \n\
    @static {\n\
        path *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.woff *.woff2\n\
    }\n\
    header @static Cache-Control "public, max-age=31536000, immutable"\n\
}' > /etc/caddy/Caddyfile

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]

# =============================================================================
# Kiosk Production Image
# =============================================================================
FROM caddy:2-alpine AS kiosk

# Copy built static files
COPY --from=build /app/apps/kiosk/dist /srv

# Create optimized Caddyfile
RUN printf '{\n\
    auto_https off\n\
    admin off\n\
}\n\
\n\
:80 {\n\
    root * /srv\n\
    encode gzip zstd\n\
    file_server\n\
    try_files {path} /index.html\n\
    \n\
    header {\n\
        -Server\n\
        X-Content-Type-Options "nosniff"\n\
        X-Frame-Options "DENY"\n\
        Referrer-Policy "no-referrer-when-downgrade"\n\
    }\n\
    \n\
    @static {\n\
        path *.js *.css *.png *.jpg *.jpeg *.gif *.ico *.woff *.woff2\n\
    }\n\
    header @static Cache-Control "public, max-age=31536000, immutable"\n\
}' > /etc/caddy/Caddyfile

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
