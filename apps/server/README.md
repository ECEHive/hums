# Hive Scheduler Server

Backend server for the Hive Shift Scheduler.

## Running

Use the `start` script to run the server. This will **not** hot-reload.

```sh
pnpm start
```

## Environment Variables

| Variable | Default | Description |
| - | - | - |
| `PORT` | `8080` | Port to run the server on. |
| `AUTH_CAS_SERVER` | `https://login.gatech.edu` | URL of the CAS authentication server. |
