# Docker Deployment

This guide provides instructions for deploying HUMS using Docker.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Prerequisites](#prerequisites)
- [Pre-built Docker Images](#pre-built-docker-images)
- [Quick Start](#quick-start)
- [Docker Compose Configuration](#docker-compose-configuration)
- [NGINX Reverse Proxy](#nginx-reverse-proxy)
- [Database Migrations](#database-migrations)
- [Health Checks](#health-checks)
- [Multi-Platform Support](#multi-platform-support)
- [Networking](#networking)
- [Volumes and Persistence](#volumes-and-persistence)
- [Troubleshooting](#troubleshooting)

---

## Architecture Overview

HUMS is deployed as a multi-container application with the following components:

| Container | Image | Description |
|-----------|-------|-------------|
| `hums-server` | `ghcr.io/ecehive/hums-server` | API server (Bun + Fastify) |
| `hums-web` | `ghcr.io/ecehive/hums-web` | NGINX serving static files + reverse proxy |
| `hums-migrate` | `ghcr.io/ecehive/hums-migrate` | One-shot Prisma migration runner |
| `hums-db` | `pgvector/pgvector:pg16` | PostgreSQL 16 with pgvector extension |

### Web Application Routes

The NGINX container serves multiple Single Page Applications (SPAs):

| Route | Application | Description |
|-------|-------------|-------------|
| `/` | Client | Main management dashboard |
| `/kiosk` | Kiosk | Check-in/check-out kiosk |
| `/inventory` | Inventory | Inventory management kiosk |
| `/overview` | Overview | Public overview display |
| `/control-kiosk` | Control | Control point management |

---

## Prerequisites

### System Requirements

- **Docker**: Version 20.10 or higher
- **Docker Compose**: Version 2.0 or higher (included with Docker Desktop)
- **Memory**: Minimum 2GB RAM available for containers
- **Disk**: At least 2GB free space for images and database

### Database Requirements

HUMS requires **PostgreSQL 16+**.

The default `docker-compose.sample.yml` uses the `pgvector/pgvector:pg16` image which includes the vector extension pre-installed.

**If using an external PostgreSQL database:**

1. Ensure PostgreSQL 16 or higher is installed
2. Install the pgvector extension:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```
3. The migration runner should handle the rest automatically

---

## Pre-built Docker Images

Docker images are automatically built and published to GitHub Container Registry (ghcr.io) on each release.

### Available Images

```bash
# Server image (API)
ghcr.io/ecehive/hums-server:latest
ghcr.io/ecehive/hums-server:v1.0.0  # specific version

# Migrate image (Prisma migrations)
ghcr.io/ecehive/hums-migrate:latest
ghcr.io/ecehive/hums-migrate:v1.0.0  # specific version

# Web image (NGINX + all frontend SPAs)
ghcr.io/ecehive/hums-web:latest
ghcr.io/ecehive/hums-web:v1.0.0  # specific version
```

### Pulling Images

```bash
docker pull ghcr.io/ecehive/hums-server:latest
docker pull ghcr.io/ecehive/hums-migrate:latest
docker pull ghcr.io/ecehive/hums-web:latest
```

---

## Quick Start

### 1. Create Environment File

```bash
cp .env.sample .env
```

Edit `.env` with your configuration. At minimum, you must set:

- `AUTH_SECRET` - Authentication token signing secret (min 32 characters)
- `ICAL_SECRET` - Calendar sync token signing secret (min 32 characters)
- `DATABASE_URL` - PostgreSQL connection string
- `AUTH_CAS_SERVER` - CAS authentication server URL
- `CLIENT_BASE_URL` - Public URL of your deployment
- `CORS_ORIGINS` - Allowed CORS origins for API requests

Generate secure secrets with:

```bash
openssl rand -base64 32
```

### 2. Start Services

```bash
# Using docker-compose.sample.yml as reference
cp docker-compose.sample.yml docker-compose.yml
docker compose up -d
```

### 3. Verify Deployment

```bash
# Check all containers are running
docker compose ps

# View logs
docker compose logs -f

# Check server health
curl http://localhost:4483/api
```

The application should be available at `http://localhost:4483`.

---

## Docker Compose Configuration

### Sample Configuration

```yaml
services:
  # PostgreSQL Database with pgvector extension
  db:
    image: pgvector/pgvector:pg16
    container_name: hums-db
    restart: unless-stopped
    environment:
      POSTGRES_DB: hums
      POSTGRES_USER: hums
      POSTGRES_PASSWORD: ${DB_PASSWORD:-changeme}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - hums-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hums"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Prisma migration runner (one-shot)
  migrate:
    image: ghcr.io/ecehive/hums-migrate:latest
    container_name: hums-migrate
    restart: "no"
    depends_on:
      db:
        condition: service_healthy
    environment:
      DATABASE_URL: postgresql://hums:${DB_PASSWORD:-changeme}@db:5432/hums
    networks:
      - hums-network

  # Server application
  server:
    image: ghcr.io/ecehive/hums-server:latest
    container_name: hums-server
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
      migrate:
        condition: service_completed_successfully
    env_file:
      - .env
    environment:
      DATABASE_URL: postgresql://hums:${DB_PASSWORD:-changeme}@db:5432/hums
      NODE_ENV: production
      PORT: 44830
    expose:
      - "44830"
    networks:
      - hums-network

  # NGINX reverse proxy with all frontend SPAs
  web:
    image: ghcr.io/ecehive/hums-web:latest
    container_name: hums-web
    restart: unless-stopped
    ports:
      - "4483:80"
    depends_on:
      - server
    networks:
      - hums-network

networks:
  hums-network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

### Using Specific Version Tags

For production deployments, pin to specific versions:

```yaml
services:
  migrate:
    image: ghcr.io/ecehive/hums-migrate:v1.0.0
  server:
    image: ghcr.io/ecehive/hums-server:v1.0.0
  web:
    image: ghcr.io/ecehive/hums-web:v1.0.0
```

---

## NGINX Reverse Proxy

The web container uses NGINX to:

1. **Serve static files** for all frontend SPAs with proper caching
2. **Proxy API requests** to the server container
3. **Handle SPA routing** with fallback to `index.html`

### Key NGINX Configuration

```nginx
# API requests are proxied to the server
location /api {
    proxy_pass http://server:44830;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}

# Static assets with long cache duration
location /assets/ {
    root /usr/share/nginx/html/client;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# SPA routing - fallback to index.html
location / {
    root /usr/share/nginx/html/client;
    try_files $uri $uri/ /index.html;
}
```

### Gzip Compression

The NGINX configuration includes gzip compression for optimal performance:

```nginx
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript 
           application/json application/javascript 
           application/xml+rss application/rss+xml 
           font/truetype font/opentype 
           application/vnd.ms-fontobject image/svg+xml;
```

### Client Max Body Size

File uploads are limited to 10MB:

```nginx
client_max_body_size 10M;
```

---

## Database Migrations

### Automatic Migrations

The `hums-migrate` container runs automatically before the server starts:

```yaml
migrate:
  image: ghcr.io/ecehive/hums-migrate:latest
  restart: "no"
  depends_on:
    db:
      condition: service_healthy

server:
  depends_on:
    migrate:
      condition: service_completed_successfully
```

### Manual Migration

To run migrations manually:

```bash
docker compose run --rm migrate
```

### Checking Migration Status

```bash
docker compose logs migrate
```

A successful migration shows exit code 0:
```
hums-migrate exited with code 0
```

---

## Health Checks

### Server Health Check

The server container includes a health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=40s \
    CMD wget --no-verbose --tries=1 --spider http://localhost:44830/api || exit 1
```

### Web Health Check

The web container includes a health check:

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
```

### Database Health Check

```yaml
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U hums"]
  interval: 10s
  timeout: 5s
  retries: 5
```

### Checking Health Status

```bash
docker compose ps
# Shows health status for each container

docker inspect --format='{{.State.Health.Status}}' hums-server
```

---

## Multi-Platform Support

All images are built for both:

- `linux/amd64` (Intel/AMD 64-bit)
- `linux/arm64` (Apple Silicon, ARM servers)

Docker will automatically pull the correct architecture for your system.

---

## Networking

### Internal Network

All containers communicate over the `hums-network` bridge network:

- Database: `db:5432`
- Server: `server:44830`
- Web: `web:80`

### Exposed Ports

By default, only the web container exposes a port to the host:

| Container | Internal Port | Host Port | Description |
|-----------|---------------|-----------|-------------|
| web | 80 | 4483 | HTTP access |

### Custom Port Mapping

To change the exposed port:

```yaml
web:
  ports:
    - "8080:80"  # Access at http://localhost:8080
```

### HTTPS/TLS

For production, place a reverse proxy (like Traefik, Caddy, or another NGINX) in front of the web container to handle TLS termination:

```yaml
web:
  ports: []  # Don't expose directly
  labels:
    - "traefik.enable=true"
    - "traefik.http.routers.hums.rule=Host(`hums.example.com`)"
    - "traefik.http.routers.hums.tls=true"
```

For our current production deployment, we use a Cloudflare tunnel which handles HTTPS for us.

---

## Volumes and Persistence

### Database Volume

PostgreSQL data is persisted in a named volume:

```yaml
volumes:
  postgres_data:
    driver: local
```

### Backup Database

```bash
docker compose exec db pg_dump -U hums hums > backup.sql
```

### Restore Database

```bash
docker compose exec -T db psql -U hums hums < backup.sql
```

---

## Troubleshooting

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f server
docker compose logs -f web
docker compose logs -f db
```

### Container Status

```bash
docker compose ps
```

### Database Connection Issues

1. Check database is healthy:
   ```bash
   docker compose exec db pg_isready -U hums
   ```

2. Verify DATABASE_URL format:
   ```
   postgresql://username:password@host:port/database
   ```

3. Check network connectivity:
   ```bash
   docker compose exec server ping db
   ```

### Client Not Loading Configuration

The frontend apps fetch configuration from `/api/config`. Verify it's accessible:

```bash
docker compose exec web wget -qO- http://server:44830/api/config
```

### CORS Errors

Ensure `CORS_ORIGINS` is set correctly in `.env`:

```bash
CORS_ORIGINS=https://your-domain.com
```

### Resetting Everything

```bash
# Stop and remove containers, networks, volumes
docker compose down -v

# Rebuild and start fresh
docker compose up -d --build
```

### Checking Image Versions

```bash
docker compose images
```
