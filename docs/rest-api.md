# REST API

The REST API provides programmatic access to HUMS. This interface is designed to be intuitive, bulk-friendly, and suitable for managing large numbers of users and roles.

## Table of Contents

- [Authentication](#authentication)
- [Standard Response Format](#standard-response-format)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Open Hours API](#open-hours-api)
- [Users API](#users-api)
- [Roles API](#roles-api)

---

## Authentication

All API requests require authentication using an API token. You can provide the token in two ways:

### Option 1: X-API-Key Header (Recommended)
```bash
X-API-Key: your_api_token_here
```

### Option 2: Authorization Bearer Token
```bash
Authorization: Bearer your_api_token_here
```

### Example Request
```bash
curl -X GET "https://your-domain.com/api/rest/users" \
  -H "X-API-Key: your_api_token_here"
```

---

## Standard Response Format

### Success Response
All successful responses follow this format:

```json
{
  "success": true,
  "data": { /* result data */ }
}
```

### List Response
List endpoints include pagination metadata:

```json
{
  "success": true,
  "data": [ /* array of items */ ],
  "meta": {
    "count": 50,
    "total": 523,
    "skip": 0,
    "take": 50,
    "hasMore": true
  }
}
```

### Bulk Operation Response
Bulk endpoints provide detailed results:

```json
{
  "success": true,
  "data": {
    "created": [ /* newly created items */ ],
    "updated": [ /* updated items */ ],
    "failed": [
      {
        "item": { /* the item that failed */ },
        "error": "error message"
      }
    ]
  },
  "meta": {
    "createdCount": 10,
    "updatedCount": 5,
    "failedCount": 2,
    "totalProcessed": 17
  }
}
```

---

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { /* optional additional context */ }
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `BAD_REQUEST` | 400 | Invalid request parameters |
| `UNAUTHORIZED` | 401 | Missing or invalid API token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists or conflict |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

To prevent abuse and ensure service availability, rate limiting may apply. Current limits are not enforced but may be added in the future.

---

## Open Hours API

### Base Path: `/api/rest/open-hours`

### Get Open Hours
**`GET /api/rest/open-hours`**

Retrieve the open hours schedule for all currently visible periods. This endpoint is **public** and does not require authentication.

**Authentication:** None required (public endpoint)

**Query Parameters:** None

**Example:**
```bash
curl -X GET "https://your-domain.com/api/rest/open-hours"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "periods": [
      {
        "periodId": 1,
        "periodName": "Spring 2026",
        "periodStart": "2026-01-12T00:00:00.000Z",
        "periodEnd": "2026-05-01T00:00:00.000Z",
        "schedule": [
          {
            "dayOfWeek": 0,
            "dayName": "Sunday",
            "ranges": [],
            "formattedHours": "Closed"
          },
          {
            "dayOfWeek": 1,
            "dayName": "Monday",
            "ranges": [
              {
                "start": "10:00",
                "end": "18:00"
              }
            ],
            "formattedHours": "10:00am - 6:00pm"
          },
          {
            "dayOfWeek": 2,
            "dayName": "Tuesday",
            "ranges": [
              {
                "start": "10:00",
                "end": "18:00"
              }
            ],
            "formattedHours": "10:00am - 6:00pm"
          },
          {
            "dayOfWeek": 3,
            "dayName": "Wednesday",
            "ranges": [
              {
                "start": "10:00",
                "end": "18:00"
              }
            ],
            "formattedHours": "10:00am - 6:00pm"
          },
          {
            "dayOfWeek": 4,
            "dayName": "Thursday",
            "ranges": [
              {
                "start": "10:00",
                "end": "18:00"
              }
            ],
            "formattedHours": "10:00am - 6:00pm"
          },
          {
            "dayOfWeek": 5,
            "dayName": "Friday",
            "ranges": [
              {
                "start": "10:00",
                "end": "17:00"
              }
            ],
            "formattedHours": "10:00am - 5:00pm"
          },
          {
            "dayOfWeek": 6,
            "dayName": "Saturday",
            "ranges": [],
            "formattedHours": "Closed"
          }
        ],
        "exceptions": [
          {
            "name": "Spring Break",
            "start": "2026-03-16T00:00:00.000Z",
            "end": "2026-03-20T23:59:59.000Z"
          }
        ]
      }
    ],
    "cachedAt": "2026-01-20T12:00:00.000Z"
  }
}
```

**Response Fields:**
- `periods` (array): List of visible periods with their schedules
  - `periodId` (number): Unique identifier for the period
  - `periodName` (string): Human-readable name of the period
  - `periodStart` (string): ISO 8601 date when the period starts
  - `periodEnd` (string): ISO 8601 date when the period ends
  - `schedule` (array): Weekly schedule with 7 days (Sunday=0 to Saturday=6)
    - `dayOfWeek` (number): Day index (0=Sunday, 6=Saturday)
    - `dayName` (string): Human-readable day name
    - `ranges` (array): Time ranges when open
      - `start` (string): Start time in HH:mm format (24-hour)
      - `end` (string): End time in HH:mm format (24-hour)
    - `formattedHours` (string): Human-readable hours (e.g., "10:00am - 6:00pm" or "Closed")
  - `exceptions` (array): Upcoming schedule exceptions (closures, special hours)
    - `name` (string): Name of the exception (e.g., "Spring Break")
    - `start` (string): ISO 8601 date when exception starts
    - `end` (string): ISO 8601 date when exception ends
- `cachedAt` (string): ISO 8601 timestamp of when the data was cached

**Notes:**
- Results are cached for 30 seconds to improve performance
- Open hours are derived from shift schedules across all shift types in each period
- Only periods within their visibility window are included
- Time ranges are merged if they overlap or are adjacent

---

## Users API

### Base Path: `/api/rest/users`

### List Users
**`GET /api/rest/users`**

Retrieve a paginated list of users with optional filtering.

**Query Parameters:**
- `search` (string, optional): Search by username, name, or email
- `role` (string, optional): Filter by role name
- `skip` (number, optional): Number of records to skip (default: 0)
- `take` (number, optional): Number of records to return (default: 50, max: 200)
- `includeRoles` (boolean, optional): Include user roles in response (default: true)

**Example:**
```bash
curl -X GET "https://your-domain.com/api/rest/users?search=john&role=admin&take=25" \
  -H "X-API-Key: your_api_token_here"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "username": "jsmith3",
      "name": "John Smith",
      "email": "jsmith3@gatech.edu",
      "cardNumber": "123456789",
      "isSystemUser": false,
      "roles": ["admin", "manager"],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-15T12:30:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "total": 1,
    "skip": 0,
    "take": 25,
    "hasMore": false
  }
}
```

---

### Get User by Username
**`GET /api/rest/users/:username`**

Retrieve details for a specific user.

**Example:**
```bash
curl -X GET "https://your-domain.com/api/rest/users/jsmith3" \
  -H "X-API-Key: your_api_token_here"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "jsmith3",
    "name": "John Smith",
    "email": "jsmith3@gatech.edu",
    "cardNumber": "123456789",
    "isSystemUser": false,
    "roles": ["admin", "manager"],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-15T12:30:00.000Z"
  }
}
```

---

### Create User
**`POST /api/rest/users`**

Create a new user.

**Request Body:**
```json
{
  "username": "jsmith3",
  "name": "John Smith",
  "email": "jsmith3@gatech.edu",
  "cardNumber": "123456789",
  "roles": ["member"]
}
```

**Fields:**
- `username` (string, required): Unique username (letters, numbers, dots, hyphens, underscores)
- `name` (string, required): Full name
- `email` (string, required): Email address
- `cardNumber` (string, optional): BuzzCard number
- `roles` (string[], optional): Array of role names (default: [])

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/users" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "jsmith3",
    "name": "John Smith",
    "email": "jsmith3@gatech.edu",
    "roles": ["member"]
  }'
```

**Response:** (HTTP 201)
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "jsmith3",
    "name": "John Smith",
    "email": "jsmith3@gatech.edu",
    "cardNumber": null,
    "isSystemUser": false,
    "roles": ["member"],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### Update User
**`PATCH /api/rest/users/:username`**

Update an existing user. Only provided fields are updated.

**Request Body:**
```json
{
  "name": "Jonathan Smith",
  "email": "jsmith@gatech.edu",
  "cardNumber": "987654321",
  "roles": ["admin", "manager"]
}
```

**Note:** All fields are optional. Providing `roles` replaces all existing roles.

**Example:**
```bash
curl -X PATCH "https://your-domain.com/api/rest/users/jsmith3" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Jonathan Smith",
    "roles": ["admin"]
  }'
```

---

### Add Roles to User
**`POST /api/rest/users/:username/roles`**

Add one or more roles to a user without removing existing roles.

**Request Body:**
```json
{
  "roles": ["manager", "supervisor"]
}
```

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/users/jsmith3/roles" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{"roles": ["manager"]}'
```

---

### Remove Roles from User
**`DELETE /api/rest/users/:username/roles`**

Remove one or more roles from a user.

**Request Body:**
```json
{
  "roles": ["manager"]
}
```

**Example:**
```bash
curl -X DELETE "https://your-domain.com/api/rest/users/jsmith3/roles" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{"roles": ["manager"]}'
```

---

### Replace User Roles
**`PUT /api/rest/users/:username/roles`**

Replace all roles for a user with a new set.

**Request Body:**
```json
{
  "roles": ["admin", "supervisor"]
}
```

**Example:**
```bash
curl -X PUT "https://your-domain.com/api/rest/users/jsmith3/roles" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{"roles": ["admin"]}'
```

---

### Lookup User by Credential
**`POST /api/rest/users/credential/lookup`**

Find a user by a credential value (e.g. card number). If a user with the given credential exists, returns their info. If no local match is found, attempts to resolve the user from the external data provider, creates a local user record, and persists the credential for future lookups.

**Required Permission:** `users.get`

**Request Body:**
```json
{
  "value": "123456789"
}
```

**Fields:**
- `value` (string, required): The credential value to look up (e.g. card number)

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/users/credential/lookup" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{"value": "123456789"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "username": "jsmith3",
    "name": "John Smith",
    "email": "jsmith3@gatech.edu",
    "slackUsername": null,
    "roles": ["member"],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-15T12:30:00.000Z"
  }
}
```

**Error Responses:**
- `400 Bad Request` — Invalid credential value
- `404 Not Found` — No user found for the provided credential

---

### Add Credential to User
**`POST /api/rest/users/:username/credentials`**

Add a credential (e.g. card number) to a user. The credential value is hashed before storage; only a preview (last 4 characters) is retained in plain text.

**Required Permission:** `credentials.create`

**Request Body:**
```json
{
  "value": "123456789"
}
```

**Fields:**
- `value` (string, required): The credential value to associate with the user

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/users/jsmith3/credentials" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{"value": "123456789"}'
```

**Response:** (HTTP 201)
```json
{
  "success": true,
  "data": {
    "id": 42,
    "preview": "6789",
    "createdAt": "2025-01-15T12:30:00.000Z",
    "updatedAt": "2025-01-15T12:30:00.000Z"
  }
}
```

**Error Responses:**
- `404 Not Found` — User not found
- `409 Conflict` — Credential already associated with this or another user

---

### Remove Credential from User
**`DELETE /api/rest/users/:username/credentials/:credentialId`**

Remove a specific credential from a user.

**Required Permission:** `credentials.delete`

**Example:**
```bash
curl -X DELETE "https://your-domain.com/api/rest/users/jsmith3/credentials/42" \
  -H "X-API-Key: your_api_token_here"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "deleted": true
  }
}
```

**Error Responses:**
- `404 Not Found` — User or credential not found

---

### Bulk Upsert Users
**`POST /api/rest/users/bulk/upsert`**

Create or update multiple users in a single request.

**Request Body:**
```json
{
  "users": [
    {
      "username": "jsmith3",
      "name": "John Smith",
      "email": "jsmith3@gatech.edu",
      "cardNumber": "123456789",
      "roles": ["member"]
    },
    {
      "username": "ajones5",
      "name": "Alice Jones",
      "email": "ajones5@gatech.edu",
      "roles": ["admin"]
    }
  ]
}
```

**Limits:**
- Minimum: 1 user
- Maximum: 500 users per request

**Behavior:**
- If user exists: Updates the user
- If user doesn't exist: Creates the user
- Failures are reported individually without stopping the entire operation

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/users/bulk/upsert" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "users": [
      {"username": "jsmith3", "name": "John Smith", "email": "jsmith3@gatech.edu", "roles": ["member"]},
      {"username": "ajones5", "name": "Alice Jones", "email": "ajones5@gatech.edu", "roles": ["admin"]}
    ]
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "created": [
      {
        "id": 1,
        "username": "jsmith3",
        "name": "John Smith",
        "email": "jsmith3@gatech.edu",
        "cardNumber": null,
        "isSystemUser": false,
        "roles": ["member"],
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "updated": [
      {
        "id": 2,
        "username": "ajones5",
        "name": "Alice Jones",
        "email": "ajones5@gatech.edu",
        "cardNumber": null,
        "isSystemUser": false,
        "roles": ["admin"],
        "createdAt": "2024-12-01T00:00:00.000Z",
        "updatedAt": "2025-01-01T00:00:00.000Z"
      }
    ],
    "failed": []
  },
  "meta": {
    "createdCount": 1,
    "updatedCount": 1,
    "failedCount": 0,
    "totalProcessed": 2
  }
}
```

---

## Roles API

### Base Path: `/api/rest/roles`

### List Roles
**`GET /api/rest/roles`**

Retrieve a paginated list of roles with optional filtering.

**Query Parameters:**
- `search` (string, optional): Search by role name
- `skip` (number, optional): Number of records to skip (default: 0)
- `take` (number, optional): Number of records to return (default: 50, max: 200)
- `includeUsers` (boolean, optional): Include user list in response (default: false)

**Example:**
```bash
curl -X GET "https://your-domain.com/api/rest/roles?includeUsers=true" \
  -H "X-API-Key: your_api_token_here"
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "admin",
      "permissions": ["manage_users", "manage_roles"],
      "userCount": 5,
      "users": [
        {
          "id": 1,
          "username": "jsmith3",
          "name": "John Smith"
        }
      ],
      "createdAt": "2025-01-01T00:00:00.000Z",
      "updatedAt": "2025-01-15T12:30:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "total": 10,
    "skip": 0,
    "take": 50,
    "hasMore": false
  }
}
```

---

### Get Role by Name
**`GET /api/rest/roles/:name`**

Retrieve details for a specific role, including assigned users.

**Example:**
```bash
curl -X GET "https://your-domain.com/api/rest/roles/admin" \
  -H "X-API-Key: your_api_token_here"
```

---

### Create Role
**`POST /api/rest/roles`**

Create a new role with optional permissions.

**Request Body:**
```json
{
  "name": "manager",
  "permissions": ["view_users", "edit_users"]
}
```

**Fields:**
- `name` (string, required): Unique role name (letters, numbers, hyphens, underscores)
- `permissions` (string[], optional): Array of permission names (default: [])

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/roles" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "manager",
    "permissions": ["view_users", "edit_users"]
  }'
```

**Response:** (HTTP 201)
```json
{
  "success": true,
  "data": {
    "id": 2,
    "name": "manager",
    "permissions": ["edit_users", "view_users"],
    "userCount": 0,
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-01T00:00:00.000Z"
  }
}
```

---

### Update Role
**`PATCH /api/rest/roles/:name`**

Update an existing role's name or permissions.

**Request Body:**
```json
{
  "name": "supervisor",
  "permissions": ["view_users", "edit_users", "view_schedules"]
}
```

**Note:** All fields are optional. Providing `permissions` replaces all existing permissions.

**Example:**
```bash
curl -X PATCH "https://your-domain.com/api/rest/roles/manager" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "permissions": ["view_users", "edit_users", "view_schedules"]
  }'
```

---

### Delete Role
**`DELETE /api/rest/roles/:name`**

Delete a role. Fails if the role has assigned users.

**Example:**
```bash
curl -X DELETE "https://your-domain.com/api/rest/roles/manager" \
  -H "X-API-Key: your_api_token_here"
```

**Response:** (HTTP 204 No Content)

---

### Bulk Create Roles
**`POST /api/rest/roles/bulk/create`**

Create multiple roles in a single request.

**Request Body:**
```json
{
  "roles": [
    {
      "name": "manager",
      "permissions": ["view_users", "edit_users"]
    },
    {
      "name": "supervisor",
      "permissions": ["view_users"]
    }
  ]
}
```

**Limits:**
- Minimum: 1 role
- Maximum: 100 roles per request

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/roles/bulk/create" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": [
      {"name": "manager", "permissions": ["view_users"]},
      {"name": "supervisor", "permissions": ["view_schedules"]}
    ]
  }'
```

---

### Bulk Update Roles
**`POST /api/rest/roles/bulk/update`**

Update multiple roles' permissions in a single request.

**Request Body:**
```json
{
  "roles": [
    {
      "name": "manager",
      "permissions": ["view_users", "edit_users", "manage_schedules"]
    },
    {
      "name": "supervisor",
      "permissions": ["view_users", "view_schedules"]
    }
  ]
}
```

**Limits:**
- Minimum: 1 role
- Maximum: 100 roles per request

**Example:**
```bash
curl -X POST "https://your-domain.com/api/rest/roles/bulk/update" \
  -H "X-API-Key: your_api_token_here" \
  -H "Content-Type: application/json" \
  -d '{
    "roles": [
      {"name": "manager", "permissions": ["view_users", "edit_users"]}
    ]
  }'
```
