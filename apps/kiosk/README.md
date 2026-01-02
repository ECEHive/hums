# Hive Scheduler Kiosk

## Running

Run the client using the `dev` script. This will hot-reload on changes.

```sh
bun dev
```

## Environment Variables

All environment variables for the kiosk are prefixed with `VITE_` to be exposed to the client-side code.

### General Configuration

| Variable | Required | Default | Description |
| - | - | - | - |
| `TZ` | No | `America/New_York` | Primary timezone for displaying dates and times |

### Development Configuration

These variables are only used during development:

| Variable | Required | Default | Description |
| - | - | - | - |
| `VITE_DEV_PORT` | No | `44832` | Port to host the development kiosk on |
| `VITE_DEV_SERVER_URL` | No | `http://localhost:44830` | URL of the development server (no trailing slash) |

### Optional: Monitoring & Error Tracking

| Variable | Required | Default | Description |
| - | - | - | - |
| `VITE_KIOSK_SENTRY_DSN` | No | `""` | Sentry DSN for error tracking (leave blank to disable) |

### Example Configurations

See [.env.sample](./env.sample) for complete example configurations.
