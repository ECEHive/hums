# Prisma Migration Runner - Optimized for minimal size
FROM node:22-alpine AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# =============================================================================
# Build Stage - Install dependencies and generate Prisma client
# =============================================================================
FROM base AS build

# Copy package manifests for dependency installation
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/prisma/package.json ./packages/prisma/
COPY packages/env/package.json ./packages/env/
COPY packages/config/package.json ./packages/config/

# Install dependencies with cache mount
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @ecehive/prisma...

# Copy source files
COPY packages/prisma ./packages/prisma
COPY packages/env ./packages/env
COPY packages/config ./packages/config

# Set dummy DATABASE_URL for Prisma generation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Generate Prisma client
RUN pnpm --filter @ecehive/prisma exec prisma generate

# Deploy with production dependencies only
RUN pnpm deploy --filter=@ecehive/prisma --prod --legacy /prod/prisma

# =============================================================================
# Migration Runner Stage - Minimal production image
# =============================================================================
FROM base AS prisma-migrate

# Install only postgresql-client for database connectivity
RUN apk add --no-cache postgresql-client

# Copy production dependencies and generated client
COPY --from=build /prod/prisma /prod/prisma

WORKDIR /prod/prisma

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /prod/prisma

USER nodejs

# Command to run migrations
CMD ["pnpm", "migrate"]
