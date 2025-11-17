# REST API Overview

The REST API is intended for service-to-service integrations that need to synchronize users and their role assignments. All endpoints live under the `/api/rest` prefix on the main application server.

## Authentication

Requests must include a valid API token generated in the admin UI. You can present the token with either of the following headers:

- `Authorization: Bearer <token>`
- `x-api-key: <token>`

Tokens are single secret strings that are only shown once when they are created. They can also have optional expirations; expired tokens are rejected automatically.

## Endpoints

| Method | Path | Description |
| ------ | ---- | ----------- |
| `GET` | `/api/rest` | Lightweight health check that also verifies the API token. |
| `GET` | `/api/rest/users` | List users with optional search/filtering. |
| `GET` | `/api/rest/users/:username` | Fetch a single user (including role names). |
| `PUT` | `/api/rest/users/:username` | Create or update a user record and (optionally) replace their roles. |
| `PUT` | `/api/rest/users/:username/roles` | Replace the full set of role assignments for a user. |
| `POST` | `/api/rest/users/:username/roles` | Add one or more roles without affecting existing assignments. |
| `DELETE` | `/api/rest/users/:username/roles/:roleName` | Remove a single role assignment. |

### `GET /api/rest/users`

Query parameters:

- `search` (optional): case-insensitive substring applied to username, name, or email.
- `skip` and `take` (optional): pagination controls (defaults: `skip=0`, `take=50`, max 200).

Returns a payload shaped as:

```json
{
  "users": [
    {
      "id": 42,
      "username": "jdoe3",
      "name": "Jane Doe",
      "email": "jdoe3@gatech.edu",
      "cardNumber": "123456789",
      "isSystemUser": false,
      "roles": ["mentor", "admin"],
      "createdAt": "2025-11-15T15:21:10.541Z",
      "updatedAt": "2025-11-17T18:12:01.004Z"
    }
  ],
  "meta": {
    "skip": 0,
    "take": 50,
    "count": 1
  }
}
```

### `PUT /api/rest/users/:username`

Upserts a user. Body parameters:

```json
{
  "name": "Jane Doe",
  "email": "jdoe3@gatech.edu",
  "cardNumber": "123456789",          // optional
  "isSystemUser": false,                // optional, defaults to false on create
  "roles": ["mentor", "admin"]        // optional; when present replaces the full set
}
```

If the `roles` array is provided it must contain role names that already exist in the system; otherwise the endpoint responds with `404 role_not_found` and lists the missing names. The response body mirrors `GET /users/:username`.

### Role management helpers

- `PUT /api/rest/users/:username/roles`
  - Body: `{ "roles": ["mentor", "admin"] }` (array can be empty to clear all roles)
  - Completely replaces the role set for the user.
- `POST /api/rest/users/:username/roles`
  - Body: `{ "role": "mentor" }`
  - Adds the provided role to the current set (no-op if they already have it).
- `DELETE /api/rest/users/:username/roles/:roleName`
  - Removes the specified role, responding with the updated user payload.

### Errors

All endpoints return standard HTTP status codes and JSON errors. Common examples:

| Status | Error Code | Meaning |
| ------ | ---------- | ------- |
| `401` | `missing_api_token` | Authentication header was not provided. |
| `401` | `invalid_api_token` | Token is invalid or expired. |
| `404` | `user_not_found` | Requested user does not exist. |
| `404` | `role_not_found` | One or more referenced roles do not exist. |
| `400` | `invalid_request` | Input failed validation (details included in response). |

### Notes

- All timestamps are ISO-8601 strings in UTC.
- Role names are case-sensitive and must match existing records.
- Every successful write operation returns the refreshed user object so external systems can keep their caches in sync.
