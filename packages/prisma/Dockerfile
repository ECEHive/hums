# Kiosk Dockerfile - Multi-stage build for production
FROM node:22-slim AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

COPY . /usr/src/app
WORKDIR /usr/src/app

# Use BuildKit cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Extract only the prisma package for running migrations
RUN pnpm deploy --filter=@ecehive/prisma --prod --legacy /prisma

FROM base AS prisma-migrate
WORKDIR /prisma

# Command to run migrations
CMD ["pnpm", "--filter", "@ecehive/prisma", "migrate"]
