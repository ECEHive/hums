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
| `VITE_PUBLIC_API_URL` | `/` | Public URL of the API server. |
| `VITE_PRIVATE_API_URL` | `http://localhost:8080` | Private (internal) URL of the API server. Only used by the development proxy. |
