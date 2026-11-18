# Control Gateways

Control Gateways allow external systems to trigger control point actions via a simple HTTP API. A gateway bundles one or more control-point actions behind a single access token, enabling integration with card readers, kiosks, IoT devices, and other systems that can present a credential value.

## Table of Contents

- [Overview](#overview)
- [Concepts](#concepts)
- [Administration](#administration)
- [Invoking a Gateway](#invoking-a-gateway)
- [Authorization Model](#authorization-model)
- [Error Handling](#error-handling)
- [Examples](#examples)

---

## Overview

A **Control Gateway** acts as a bridge between an external system and one or more HUMS control points (doors, switches, etc.). The external system authenticates using the gateway's access token and identifies the acting user with a credential value (e.g., a card scan). HUMS runs every configured action, or none of them.

### Flow

1. External system sends `POST /api/rest/control/gateways/invoke` with the gateway access token and a credential value.
2. HUMS validates the access token and looks up the gateway.
3. HUMS identifies the user from the credential value (via HMAC-SHA256 hash lookup).
4. HUMS checks every action: equipment state, authorization and active session (see [Authorization Model](#authorization-model)). If any action can't run, the request is rejected and nothing runs.
5. HUMS locks the gateway's control points, so concurrent invocations can't interleave, and reads the live state of every `TOGGLE` switch. If any read fails, the request is rejected and nothing runs.
6. The actions run in order. If one fails, the rest are not run. Actions that already ran are reported, not undone, since providers have no transactions.
7. A summary of results is returned.

---

## Concepts

### Gateway

A named configuration containing:

| Field | Description |
|-------|-------------|
| **Name** | A descriptive name for the gateway |
| **Description** | Optional notes about the gateway's purpose |
| **Access Token** | A unique 64-character hex token used for authentication |
| **Active** | Whether the gateway accepts invocations |
| **Actions** | One or more control point + action pairs |

### Gateway Actions

Each gateway can have multiple actions. An action pairs a **control point** with an **operation**:

| Action | Applies To | Description |
|--------|-----------|-------------|
| `UNLOCK` | Door | Unlocks a door control point |
| `TURN_ON` | Switch | Turns on a switch control point |
| `TURN_OFF` | Switch | Turns off a switch control point |
| `TOGGLE` | Switch | Reads the switch's live state from its provider and writes the opposite |

Action types are validated against the control point's class — doors only support `UNLOCK`, and switches support `TURN_ON`, `TURN_OFF` and `TOGGLE`. Each control point can appear in a gateway only once.

Control points with **Requires buddy** set can't be added to a gateway, because a gateway takes only one card. The admin dialogs show them disabled. If a point is switched to requires-buddy after it was added, invocations fail with `ACTION_UNAVAILABLE`.

`TOGGLE` never trusts the cached `currentState`. A failed read is logged as a failed `READ_STATE`. Control logs record the resolved `TURN_ON` / `TURN_OFF`, never `TOGGLE`, because the session-end check looks for the user's last successful `TURN_ON`.

---

## Administration

Control gateways are managed from the **Control > Gateways** page in the admin client.

### Required Permissions

| Permission | Description |
|------------|-------------|
| `control.gateways.list` | View the list of gateways |
| `control.gateways.get` | View gateway details |
| `control.gateways.create` | Create new gateways |
| `control.gateways.update` | Edit existing gateways and regenerate their tokens |
| `control.gateways.delete` | Delete gateways |

### Creating a Gateway

1. Navigate to **Control > Gateways** in the admin client.
2. Click **New Gateway**.
3. Enter a name and optional description.
4. Add one or more actions by selecting a control point and the desired operation.
5. Click **Create**.

After creation, the access token is displayed **once** in a dialog. Copy and store it immediately — the token cannot be retrieved again.

### Editing a Gateway

You can update a gateway's name, description, active status, and actions at any time.

### Regenerating the Token

The key button on a gateway's row replaces its access token and shows the new one once. The old token stops working immediately, so any device using it fails until it is given the new token. Use this when a token is lost or may have leaked.

### Deleting a Gateway

Deleting a gateway immediately invalidates its access token. Any external system using that token will receive `401 Unauthorized` responses.

---

## Invoking a Gateway

### Endpoint

```
POST /api/rest/control/gateways/invoke
```

This endpoint does **not** use the standard API token authentication. Instead, it uses the gateway's own access token.

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `X-Gateway-Token` | Yes | The gateway's access token |
| `Content-Type` | Yes | Must be `application/json` |

### Request Body

```json
{
  "credentialValue": "the-users-credential-value"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `credentialValue` | string | Yes | The credential value (e.g., a card number) to identify the user. It is hashed as sent, so card readers must send the parsed form `@ecehive/card-scanner` produces (9-digit zero-padded card number, or the full 16-digit mobile credential). |

### Success Response

Returned only when every action succeeded.

```json
{
  "success": true,
  "data": {
    "gatewayId": 1,
    "gatewayName": "Front Door Gateway",
    "userId": 42,
    "username": "jdoe",
    "results": [
      {
        "controlPointId": "uuid-here",
        "controlPointName": "Front Door",
        "action": "UNLOCK",
        "status": "done",
        "resolvedAction": "UNLOCK",
        "newState": true
      }
    ]
  }
}
```

### Result Fields

Each entry in `results` (on success, or in `error.details.results` on failure) contains:

| Field | Type | Description |
|-------|------|-------------|
| `controlPointId` | string | The control point's UUID |
| `controlPointName` | string | Human-readable name |
| `action` | string | The action configured on the gateway (may be `TOGGLE`) |
| `status` | string | `done`, `blocked`, `failed` or `not_run` |
| `resolvedAction` | string | `done` only. The action performed; `TOGGLE` resolves to `TURN_ON` or `TURN_OFF` |
| `newState` | boolean | `done` only. The state written |
| `reason` | string | `blocked` only. One of the reasons below |
| `message` | string | `failed` only. Why the provider read or write failed |

`not_run` means the action could have run, but didn't because another action was blocked or failed.

| `reason` | Meaning |
|----------|---------|
| `POINT_INACTIVE` | The control point is inactive |
| `PROVIDER_INACTIVE` | The control provider is inactive |
| `REQUIRES_BUDDY` | The control point requires a buddy |
| `TOGGLE_NOT_SWITCH` | The action is `TOGGLE` on a door |
| `NOT_AUTHORIZED` | The user is not authorized for the control point |
| `NO_ACTIVE_SESSION` | The user has no active session |

---

## Authorization Model

When a gateway is invoked, each action is independently checked against the user's permissions on the target control point. The gateway itself does not grant any additional permissions — it only defines which actions to attempt.

Authorization is determined per control point:

1. **System users** bypass all authorization checks.
2. **Direct authorization**: The user is explicitly listed in the control point's authorized users.
3. **Role-based authorization**: The user has a role listed in the control point's authorized roles.
4. **Unrestricted**: The control point has no authorized users or roles configured (open to all).

If the user is not authorized for any one action, the request fails with `NOT_AUTHORIZED` and nothing runs.

### Active Session

Every action requires the user to have an active general or staffing session, matching the control kiosk. System users are exempt. The check runs before any provider is contacted.

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { "results": [] }
  }
}
```

`details.results` gives the outcome of every action. It is present for `NOT_AUTHORIZED`, `ACTION_UNAVAILABLE`, `CONTROL_UNAVAILABLE` and `EXECUTION_FAILED`.

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid `X-Gateway-Token` header |
| `INVALID_TOKEN` | 401 | The access token does not match any gateway |
| `INVALID_CREDENTIAL` | 401 | No user found for the provided credential value |
| `GATEWAY_INACTIVE` | 403 | The gateway exists but is not active |
| `NOT_AUTHORIZED` | 403 | Every blocked action has reason `NOT_AUTHORIZED` or `NO_ACTIVE_SESSION`; nothing ran |
| `ACTION_UNAVAILABLE` | 409 | An action is blocked for any other reason, so it can't run for anyone right now; nothing ran. Takes precedence over `NOT_AUTHORIZED`. |
| `CONTROL_UNAVAILABLE` | 502 | A `TOGGLE` switch's live state couldn't be read; nothing ran |
| `EXECUTION_FAILED` | 502 | An action failed while running. The message says how many actions ran before it; those were not undone. |
| `VALIDATION_ERROR` | 400 | Request body validation failed |
| `INTERNAL_ERROR` | 500 | Includes a database error after an action ran. The equipment may have changed; check the control logs. |

---

## Examples

### Unlock a Door

```bash
curl -X POST "https://your-domain.com/api/rest/control/gateways/invoke" \
  -H "X-Gateway-Token: your_gateway_access_token" \
  -H "Content-Type: application/json" \
  -d '{"credentialValue": "12345678"}'
```

### Response — Successful Unlock

```json
{
  "success": true,
  "data": {
    "gatewayId": 1,
    "gatewayName": "Lab Entry Gateway",
    "userId": 15,
    "username": "asmith",
    "results": [
      {
        "controlPointId": "a1b2c3d4-...",
        "controlPointName": "Lab Door",
        "action": "UNLOCK",
        "status": "done",
        "resolvedAction": "UNLOCK",
        "newState": true
      }
    ]
  }
}
```

### Response — Unauthorized User (403)

```json
{
  "success": false,
  "error": {
    "code": "NOT_AUTHORIZED",
    "message": "User is not authorized for every action on this gateway",
    "details": {
      "results": [
        {
          "controlPointId": "a1b2c3d4-...",
          "controlPointName": "Lab Door",
          "action": "UNLOCK",
          "status": "blocked",
          "reason": "NOT_AUTHORIZED"
        }
      ]
    }
  }
}
```

### Response — Invalid Token (401)

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid gateway access token"
  }
}
```
