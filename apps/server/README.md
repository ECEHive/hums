# Hive Scheduler Server

Backend server for the Hive Shift Scheduler.

## Running

When developing the server, use the `dev` script to run the server with hot-reloads on changes.

```sh
bun dev
```

Use the `start` script to run the server without hot-reloads.

```sh
bun start
```

## Environment Variables

All environment variables are validated using Zod schemas. See [packages/env](../../packages/env/README.md) for more details.

### Base Configuration

| Variable | Required | Default | Description |
| - | - | - | - |
| `NODE_ENV` | No | `development` | Environment mode: `development`, `production`, or `test` |
| `PORT` | No | `44830` | Port to run the server on |
| `DATABASE_URL` | Yes | - | PostgreSQL connection URL (format: `postgresql://user:pass@host:port/db`) |
| `TZ` | No | `America/New_York` | Primary timezone for the application |
| `CLIENT_BASE_URL` | Yes | - | Base URL of the client application (no trailing slash) |

### Authentication Configuration

| Variable | Required | Default | Description |
| - | - | - | - |
| `AUTH_SECRET` | Yes | - | Secret used to sign and validate authentication tokens (generate with `openssl rand -base64 32`) |
| `AUTH_PROVIDER` | No | `CAS_PROXIED` | Authentication provider: `CAS` (direct) or `CAS_PROXIED` (via proxy) |
| `AUTH_CAS_SERVER` | Yes | - | Base URL of the CAS server (used to derive default endpoints) |
| `AUTH_CAS_LOGIN_URL` | No | `<AUTH_CAS_SERVER>/cas/login` | CAS login endpoint URL |
| `AUTH_CAS_VALIDATE_URL` | No | `<AUTH_CAS_SERVER>/cas/serviceValidate` | CAS 2.0 validation endpoint URL |
| `AUTH_CAS_LOGOUT_URL` | No | `<AUTH_CAS_SERVER>/cas/logout` | CAS logout endpoint URL |
| `AUTH_CAS_PROXY_URL` | Conditional | - | CAS proxy entrypoint URL (required when `AUTH_PROVIDER=CAS_PROXIED`) |
| `SYSTEM_USERS` | No | `""` | Comma-separated list of usernames with admin access |

### Data Provider Configuration

Choose **ONE** of the following provider configurations:

#### Option 1: Legacy Provider (LDAP)

| Variable | Required | Default | Description |
| - | - | - | - |
| `DATA_PROVIDER` | Yes | `legacy` | Set to `legacy` to use LDAP for user lookups |
| `LDAP_HOST` | Yes | `whitepages.gatech.edu` | LDAP server hostname |
| `LDAP_BASE_DN` | Yes | `dc=whitepages,dc=gatech,dc=edu` | Base DN for LDAP searches |
| `FALLBACK_EMAIL_DOMAIN` | No | `gatech.edu` | Domain appended when LDAP doesn't return an email |

#### Option 2: BuzzAPI Provider

| Variable | Required | Default | Description |
| - | - | - | - |
| `DATA_PROVIDER` | Yes | - | Set to `buzzapi` to use Georgia Tech's BuzzAPI |
| `BUZZAPI_BASE_URL` | Yes | - | Base URL of the BuzzAPI instance |
| `BUZZAPI_USER` | Yes | - | Service account username for BuzzAPI |
| `BUZZAPI_PASSWORD` | Yes | - | Service account password for BuzzAPI |
| `FALLBACK_EMAIL_DOMAIN` | No | `gatech.edu` | Domain appended when API doesn't return an email |

### Email Provider Configuration

Choose **ONE** of the following email provider configurations:

#### Common Settings (All Providers)

| Variable | Required | Default | Description |
| - | - | - | - |
| `EMAIL_PROVIDER` | No | `SMTP` | Email provider: `SES` (Amazon SES), `SMTP` (generic SMTP), or `NONE` (disabled) |
| `EMAIL_FROM_ADDRESS` | No | - | Email address used as sender for outgoing emails |
| `EMAIL_FROM_NAME` | No | `HUMS` | Display name used as sender for outgoing emails |

#### Option 1: Amazon SES

| Variable | Required | Default | Description |
| - | - | - | - |
| `EMAIL_PROVIDER` | Yes | - | Set to `SES` to use Amazon Simple Email Service |
| `EMAIL_SES_REGION` | No | `us-east-1` | AWS region for SES |
| `EMAIL_SES_ACCESS_KEY_ID` | No | - | AWS access key ID (uses IAM role if not provided) |
| `EMAIL_SES_SECRET_ACCESS_KEY` | No | - | AWS secret access key (uses IAM role if not provided) |

#### Option 2: SMTP

| Variable | Required | Default | Description |
| - | - | - | - |
| `EMAIL_PROVIDER` | Yes | - | Set to `SMTP` to use generic SMTP server |
| `EMAIL_SMTP_HOST` | Yes | - | SMTP server hostname (e.g., `smtp.gmail.com`) |
| `EMAIL_SMTP_PORT` | No | `587` | SMTP server port |
| `EMAIL_SMTP_SECURE` | No | `false` | Whether to use TLS/SSL for SMTP connection |
| `EMAIL_SMTP_USER` | No | - | SMTP username for authentication (optional for unauthenticated SMTP) |
| `EMAIL_SMTP_PASSWORD` | No | - | SMTP password for authentication (optional for unauthenticated SMTP) |

#### Option 3: Development with Mailpit

For local development, you can use [Mailpit](https://github.com/axllent/mailpit) to catch all outgoing emails:

```sh
docker run -d -p 1025:1025 -p 8025:8025 axllent/mailpit
```

Then configure:
- `EMAIL_PROVIDER=SMTP`
- `EMAIL_SMTP_HOST=localhost`
- `EMAIL_SMTP_PORT=1025`
- `EMAIL_SMTP_SECURE=false`

View caught emails at http://localhost:8025

#### Option 4: None (Disabled)

For environments where email sending should be completely disabled (logs only):

- `EMAIL_PROVIDER=NONE`

No additional configuration needed. All email sending will be logged to the console but not actually sent.

### Example Configurations

See [.env.sample](./env.sample) for complete example configurations with different provider combinations.
