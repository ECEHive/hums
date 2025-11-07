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
| `VITE_PUBLIC_SERVER_URL` | `""` | Public URL of the server. |
| `VITE_CAS_PROXY_URL` | `""` | URL that the user will be redirected to for CAS authentication. | 
| `VITE_PUBLIC_PATH` | `"/app/"` | Base path for the client application. |

### Development Variables

| Variable | Default | Description |
| - | - | - |
| `PROXY_PRIVATE_SERVER_URL` | `"http://localhost:44830"` | Internal URL of the server for the proxy to serve. |
