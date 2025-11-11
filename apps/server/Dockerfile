# Server Dockerfile - Multi-stage build for production
FROM node:22-slim AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Install required packages
RUN apt-get update \
    && apt-get -y install --no-install-recommends \
        git \
        ldap-utils \
        postgresql-client \
    && apt-get auto-remove -y \
    && apt-get clean -y

# Build stage - install all dependencies and build
FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app

# Use BuildKit cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Set dummy DATABASE_URL for Prisma generation
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy?schema=public"

# Generate Prisma client
RUN pnpm --filter @ecehive/prisma exec prisma generate

# Deploy stage - use pnpm deploy to extract only production dependencies for server
RUN pnpm deploy --filter=@ecehive/server --prod --legacy /prod/server

# Copy Prisma migrations and schema so the production image can run migrations at startup.
RUN mkdir -p /prod/server/prisma \
    && cp -R packages/prisma/migrations /prod/server/prisma/ || true \
    && cp packages/prisma/schema.prisma /prod/server/prisma/schema.prisma || true

# Production stage
FROM base AS server
COPY --from=build /prod/server /prod/server
WORKDIR /prod/server

# Set environment to production
ENV NODE_ENV=production

# Expose server port
EXPOSE 3000

# Start the server via entrypoint (runs migrations first)
CMD ["pnpm", "start"]
