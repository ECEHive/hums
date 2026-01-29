# Hive Inventory Kiosk

## Running

Run the client using the `dev` script. This will hot-reload on changes.

```sh
bun dev
```

## Environment Variables

### General Configuration

| Variable | Required | Default | Description |
| - | - | - | - |
| `TZ` | No | `America/New_York` | Primary timezone for displaying dates and times |

### Development Configuration

These variables are only used during development:

| Variable | Required | Default | Description |
| - | - | - | - |
| `VITE_DEV_PORT` | No | `44834` | Port to host the development kiosk on |
| `VITE_DEV_SERVER_URL` | No | `http://localhost:44830` | URL of the development server (no trailing slash) |

### Monitoring & Error Tracking

Sentry for the inventory kiosk is configured at runtime via the server's `/api/config`
endpoint (for example: DSN, environment, and release are provided by the backend).

No additional `VITE_*` environment variables are required for Sentry in production.
During development, the kiosk will use whatever Sentry configuration the development
server exposes via `/api/config`.

### Example Configurations

See [.env.sample](./env.sample) for complete example configurations.
