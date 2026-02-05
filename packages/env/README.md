# `@ecehive/env`

Environment variable validation and loading for HUMS applications.

## Overview

This package provides typed environment variables with runtime validation using Zod schemas. All environment variables are validated when the module is imported, ensuring configuration errors are caught at startup.

## Usage

```typescript
import { env } from "@ecehive/env";

// Type-safe access to environment variables
console.log(env.DATABASE_URL);
console.log(env.AUTH_SECRET);
```

## Security Requirements

### Secret Length Enforcement

The following secrets **must be at least 32 characters** long:

- `AUTH_SECRET` - Used to sign authentication tokens
- `ICAL_SECRET` - Used to sign calendar sync tokens

Generate secure secrets with:

```sh
openssl rand -base64 32
```

### Production Requirements

In production (`NODE_ENV=production`), the following are enforced:

- `CORS_ORIGINS` must be explicitly set (no wildcard allowed)
- Secrets must meet minimum length requirements

## Configuration

See [`apps/server/.env.sample`](../../apps/server/.env.sample) for development configuration examples.

See [`.env.sample`](../../.env.sample) for production/Docker configuration examples.

## Schema

The environment schema is defined in [`src/schema.ts`](./src/schema.ts). It includes:

- **Base Configuration**: `NODE_ENV`, `PORT`, `TZ`, `DATABASE_URL`, `CLIENT_BASE_URL`, `CORS_ORIGINS`
- **Authentication**: CAS SSO configuration, secrets, system users
- **Data Providers**: LDAP (legacy) or BuzzAPI for user lookups
- **Email Providers**: Amazon SES, SMTP, or disabled
