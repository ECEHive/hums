# Kiosk Dockerfile - Multi-stage build for production
FROM node:22-slim AS base

# Enable pnpm
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Build stage - install dependencies and build
FROM base AS build
COPY . /usr/src/app
WORKDIR /usr/src/app

# Use BuildKit cache mount for pnpm store
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build the kiosk app
RUN pnpm --filter @ecehive/kiosk build

# Production stage with Caddy
FROM caddy:2-alpine AS kiosk

# Copy built static files
COPY --from=build /usr/src/app/apps/kiosk/dist /srv

# Create Caddyfile for serving the kiosk app with /kiosk/ base path
RUN echo $'{\n\
    auto_https off\n\
}\n\
\n\
:80 {\n\
    root * /srv\n\
    encode gzip\n\
    file_server\n\
    try_files {path} /index.html\n\
}' > /etc/caddy/Caddyfile

# Expose port
EXPOSE 80

CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile"]
