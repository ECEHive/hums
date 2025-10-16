# Hive Scheduler Server

Backend server for the Hive Shift Scheduler.

## Running

When developing the server, use the `dev` script to run the server with hot-reloads on changes.

```sh
pnpm dev
```

Use the `start` script to run the server without hot-reloads.

```sh
pnpm start
```

## Environment Variables

| Variable | Sample | Description |
| - | - | - |
| `PORT` | `8080` | Port to run the server on. |
| `DATABASE_URL` | `postgres://postgres:postgres@postgres:5432/hive` | URL of the database. In the dev container, this is set by Docker. |
| `AUTH_SECRET` | `randomstring` | Secret used to sign and validate authentication tokens. |
| `AUTH_CAS_SERVER` | `https://login.gatech.edu` | URL of the CAS authentication server. |
| `SYSTEM_USERS` | `gburdell3@gatech.edu` | Comma-separated list of email addresses for default users with admin access. |
