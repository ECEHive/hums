# Hive Scheduler Client

React web client for the Hive Shift Scheduler.

## Running

Run the client using the `dev` script. This will hot-reload on changes.

```sh
bun dev
```

## Environment Variables

All environment variables for the client are prefixed with `VITE_` to be exposed to the client-side code.

### Authentication Configuration

Choose **ONE** of the following authentication provider configurations:

#### Option 1: Direct CAS Authentication

| Variable | Required | Default | Description |
| - | - | - | - |
| `VITE_AUTH_PROVIDER` | Yes | `CAS_PROXIED` | Set to `CAS` for direct CAS authentication |
| `VITE_CAS_LOGIN_URL` | Yes | - | CAS login URL (e.g., `https://sso.gatech.edu/cas/login`) |

#### Option 2: Proxied CAS Authentication

| Variable | Required | Default | Description |
| - | - | - | - |
| `VITE_AUTH_PROVIDER` | Yes | `CAS_PROXIED` | Set to `CAS_PROXIED` for proxy-based authentication |
| `VITE_CAS_PROXY_URL` | Yes | - | Proxy CAS endpoint URL |

### General Configuration

| Variable | Required | Default | Description |
| - | - | - | - |
| `TZ` | No | `America/New_York` | Primary timezone for displaying dates and times |

### Development Configuration

These variables are only used during development:

| Variable | Required | Default | Description |
| - | - | - | - |
| `VITE_DEV_PORT` | No | `44831` | Port to host the development client on |
| `VITE_DEV_SERVER_URL` | No | `http://localhost:44830` | URL of the development server (no trailing slash) |

### Optional: Monitoring & Error Tracking

| Variable | Required | Default | Description |
| - | - | - | - |
| `VITE_CLIENT_SENTRY_DSN` | No | `""` | Sentry DSN for error tracking (leave blank to disable) |

### Example Configurations

See [.env.sample](./env.sample) for complete example configurations.
