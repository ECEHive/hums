# Hive Scheduler Server

Backend server for the Hive Shift Scheduler.

## Running

When developing the server, use the `dev` script to run the server with hot-reloads on changes.

```sh
bun dev
```

Use the `start` script to run the server without hot-reloads.

```sh
bun start
```

## Environment Variables

| Variable | Sample | Description |
| - | - | - |
| `PORT` | `44830` | Port to run the server on. |
| `DATABASE_URL` | `postgres://postgres:postgres@postgres:5432/hive` | URL of the database. In the dev container, this is set by Docker. |
| `AUTH_SECRET` | `randomstring` | Secret used to sign and validate authentication tokens. |
| `AUTH_PROVIDER` | `CAS_PROXIED` | Authentication provider (`CAS` for direct CAS or `CAS_PROXIED` for the proxy flow). |
| `AUTH_CAS_SERVER` | `https://sso.gatech.edu` | Base URL of the CAS server (used to derive defaults for login/validate/logout URLs). |
| `AUTH_CAS_LOGIN_URL` | `https://sso.gatech.edu/cas/login` | CAS login URL (required when `AUTH_PROVIDER=CAS`, defaults to `<AUTH_CAS_SERVER>/cas/login`). |
| `AUTH_CAS_VALIDATE_URL` | `https://sso.gatech.edu/cas/serviceValidate` | CAS 2.0 validate URL (defaults to `<AUTH_CAS_SERVER>/cas/serviceValidate`). |
| `AUTH_CAS_LOGOUT_URL` | `https://sso.gatech.edu/cas/logout` | CAS logout URL (defaults to `<AUTH_CAS_SERVER>/cas/logout`). |
| `AUTH_CAS_PROXY_URL` | `https://login-proxy.example.com` | CAS proxy entrypoint used only when `AUTH_PROVIDER=CAS_PROXIED`. |
| `SYSTEM_USERS` | `gburdell3` | Comma-separated list of usernames for default users with admin access. |
| `DATA_PROVIDER` | `legacy` | `legacy` (LDAP + SUMS) or `buzzapi` to decide where user profiles are fetched from. |
| `BUZZAPI_BASE_URL` | `https://buzzapi.gatech.edu` | Base URL of the BuzzAPI instance (required when `DATA_PROVIDER=buzzapi`). |
| `BUZZAPI_USER` | `service_account` | Username for the BuzzAPI service account (BuzzAPI only). |
| `BUZZAPI_PASSWORD` | `secret` | Password for the BuzzAPI service account (BuzzAPI only). |
| `LDAP_HOST` | `whitepages.gatech.edu` | Host of the LDAP server (legacy provider only). |
| `LDAP_BASE_DN` | `dc=whitepages,dc=gatech,dc=edu` | Base DN to use for LDAP queries (legacy provider only). |
| `FALLBACK_EMAIL_DOMAIN` | `gatech.edu` | Domain appended when legacy lookups don't return an email. |
| `TZ` | `"America/New_York"` | Primary timezone. |
