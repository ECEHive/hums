# Hive Scheduler Kiosk

## Running

Run the client using the `dev` script. This will hot-reload on changes.

```sh
pnpm dev
```

## Environment Variables

| Variable | Default | Description |
| - | - | - |
| `VITE_PUBLIC_SERVER_URL` | `""` | Public URL of the server. |
| `VITE_PUBLIC_PATH` | `"/kiosk/"` | Base path for the kiosk application. |

### Development Variables

| Variable | Default | Description |
| - | - | - |
| `PROXY_PRIVATE_SERVER_URL` | `"http://localhost:44830"` | Internal URL of the server for the proxy to serve. |
