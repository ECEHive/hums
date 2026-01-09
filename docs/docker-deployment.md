# Docker Deployment Guide

This document describes how to deploy HUMS using Docker.

## Architecture

HUMS is deployed as two Docker images:

1. **hums-server** - The API server (Bun + Fastify)
2. **hums-web** - NGINX serving the client and kiosk static files

Additionally, the server image includes a `prisma-migrate` target for running database migrations.

## Pre-built Images

Docker images are automatically built and published to GitHub Container Registry (ghcr.io) on each release:

```bash
# Server image (API)
ghcr.io/ecehive/hums-server:latest
ghcr.io/ecehive/hums-server:v1.0.0  # specific version

# Migrate image (Prisma migrations)
ghcr.io/ecehive/hums-migrate:latest
ghcr.io/ecehive/hums-migrate:v1.0.0  # specific version

# Web image (NGINX + client + kiosk)
ghcr.io/ecehive/hums-web:latest
ghcr.io/ecehive/hums-web:v1.0.0  # specific version
```

## Quick Start with Docker Compose

1. Create your environment file:

```bash
cp .env.sample .env
# Edit .env with your configuration
```

2. Start the services:

```bash
docker compose up -d
```

This will:
- Start a PostgreSQL database
- Run database migrations
- Start the API server
- Start the NGINX web server

## Configuration

### Environment Variables

The server is configured via environment variables. See [.env.sample](../.env.sample) for all available options.

Key configuration areas:
- **Database**: `DATABASE_URL`
- **Authentication**: `AUTH_PROVIDER`, `AUTH_CAS_*`
- **Email**: `EMAIL_PROVIDER`, `EMAIL_*`
- **Observability**: `CLIENT_SENTRY_DSN`, `KIOSK_SENTRY_DSN`

### Client Configuration

Unlike traditional Vite applications, HUMS does **not** use `VITE_*` environment variables at build time. Instead, the client and kiosk fetch their configuration at runtime from the `/api/config` endpoint.

This design allows:
- Pre-built Docker images that work in any environment
- No rebuild needed when changing configuration
- Simpler deployment pipeline

The `/api/config` endpoint exposes these values (configured on the server):
- `authProvider` - Authentication method (CAS or CAS_PROXIED)
- `casLoginUrl` - CAS login URL
- `casProxyUrl` - CAS proxy URL (for proxied auth)
- `clientSentryDsn` - Sentry DSN for client error tracking
- `kioskSentryDsn` - Sentry DSN for kiosk error tracking
- `timezone` - Application timezone
- `clientBaseUrl` - Base URL for the client application

## Building Images Locally

If you need to build images locally:

```bash
# Build server image
docker build -f Dockerfile.server --target server -t hums-server .

# Build migration image
docker build -f Dockerfile.server --target prisma-migrate -t hums-migrate .

# Build web image
docker build -f Dockerfile.web --target web -t hums-web .
```

## Using Pre-built Images

To use pre-built images instead of building locally, set these environment variables:

```bash
export SERVER_IMAGE=ghcr.io/ecehive/hums-server:v1.0.0
export MIGRATE_IMAGE=ghcr.io/ecehive/hums-migrate:v1.0.0
export WEB_IMAGE=ghcr.io/ecehive/hums-web:v1.0.0
docker compose up -d
```

## Health Checks

Both images include health checks:

- **Server**: `GET /api` (returns 200 when healthy)
- **Web**: `GET /` (returns 200 when NGINX is serving)

## Ports

- **80**: NGINX (client + kiosk + API proxy)
- **44830**: Server (internal, not exposed by default)
- **5432**: PostgreSQL (internal, not exposed by default)

## Multi-Platform Support

Images are built for both `linux/amd64` and `linux/arm64` architectures.

## Troubleshooting

### Checking logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f server
docker compose logs -f nginx
```

### Database connection issues

Ensure the database is healthy before the server starts:

```bash
docker compose ps
```

The `prisma-migrate` service should show "Exited (0)" and the `server` should be "Up".

### Client not loading configuration

Check that the server is reachable from the NGINX container:

```bash
docker compose exec nginx wget -qO- http://server:44830/api/config
```
