# Hive Scheduler Kiosk

## Running

Run the client using the `dev` script. This will hot-reload on changes.

```sh
pnpm dev
```

### Development Variables

| Variable | Default | Description |
| - | - | - |
| `VITE_DEV_PORT` | `44832` | Port to host the development kiosk on. |
| `VITE_DEV_SERVER_URL` | `"http://localhost:44830"` | URL of the development server to be proxied. |
