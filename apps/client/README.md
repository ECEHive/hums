# Hive Scheduler Client

React web client for the Hive Shift Scheduler.

## Running

Run the client using the `dev` script. This will hot-reload on changes.

```sh
pnpm dev
```

## Environment Variables

| Variable | Default | Description |
| - | - | - |
| `VITE_CAS_PROXY_URL` | `""` | URL that the user will be redirected to for CAS authentication. | 
| `VITE_CLIENT_SENTRY_DSN` | `""` | Optional DSN if you wish to include Sentry. |

### Development Variables

| Variable | Default | Description |
| - | - | - |
| `VITE_DEV_PORT` | `44831` | Port to host the development client on. |
| `VITE_DEV_SERVER_URL` | `"http://localhost:44830"` | URL of the development server to be proxied. |
