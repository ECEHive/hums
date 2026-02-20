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

A **Control Gateway** acts as a bridge between an external system and one or more HUMS control points (doors, switches, etc.). The external system authenticates using the gateway's access token and identifies the acting user with a credential value (e.g., a card scan). HUMS then checks the user's authorization for each configured action and executes them.

### Flow

1. External system sends `POST /api/rest/control/gateways/invoke` with the gateway access token and a credential value.
2. HUMS validates the access token and looks up the gateway.
3. HUMS identifies the user from the credential value (via HMAC-SHA256 hash lookup).
4. For each action configured on the gateway, HUMS checks if the user is authorized.
5. Authorized actions are executed on the corresponding control points.
6. A summary of results is returned.

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

Action types are validated against the control point's class — doors only support `UNLOCK`, and switches only support `TURN_ON` / `TURN_OFF`.

---

## Administration

Control gateways are managed from the **Control > Gateways** page in the admin client.

### Required Permissions

| Permission | Description |
|------------|-------------|
| `control.gateways.list` | View the list of gateways |
| `control.gateways.get` | View gateway details |
| `control.gateways.create` | Create new gateways |
| `control.gateways.update` | Edit existing gateways |
| `control.gateways.delete` | Delete gateways |

### Creating a Gateway

1. Navigate to **Control > Gateways** in the admin client.
2. Click **New Gateway**.
3. Enter a name and optional description.
4. Add one or more actions by selecting a control point and the desired operation.
5. Click **Create**.

After creation, the access token is displayed **once** in a dialog. Copy and store it immediately — the token cannot be retrieved again. If lost, you must create a new gateway.

### Editing a Gateway

You can update a gateway's name, description, active status, and actions at any time. The access token cannot be changed or viewed after initial creation.

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
| `credentialValue` | string | Yes | The raw credential value (e.g., a card number) to identify the user |

### Success Response

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
        "success": true
      }
    ]
  }
}
```

### Result Fields

Each entry in `results` contains:

| Field | Type | Description |
|-------|------|-------------|
| `controlPointId` | string | The control point's UUID |
| `controlPointName` | string | Human-readable name |
| `action` | string | The action that was attempted |
| `success` | boolean | Whether the action executed successfully |
| `error` | string? | Error message if `success` is `false` |
| `skipped` | boolean? | `true` if the action was skipped |
| `skipReason` | string? | Reason the action was skipped |

Actions may be skipped when:
- The control point is inactive
- The control provider is inactive
- The user is not authorized for the control point

---

## Authorization Model

When a gateway is invoked, each action is independently checked against the user's permissions on the target control point. The gateway itself does not grant any additional permissions — it only defines which actions to attempt.

Authorization is determined per control point:

1. **System users** bypass all authorization checks.
2. **Direct authorization**: The user is explicitly listed in the control point's authorized users.
3. **Role-based authorization**: The user has a role listed in the control point's authorized roles.
4. **Unrestricted**: The control point has no authorized users or roles configured (open to all).

If a user is not authorized for a particular action, that action is skipped with a `skipReason` of `"User is not authorized for this control point"`. Other actions in the same gateway invocation are still attempted.

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid `X-Gateway-Token` header |
| `INVALID_TOKEN` | 401 | The access token does not match any gateway |
| `INVALID_CREDENTIAL` | 401 | No user found for the provided credential value |
| `GATEWAY_INACTIVE` | 403 | The gateway exists but is not active |
| `VALIDATION_ERROR` | 400 | Request body validation failed |

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
        "success": true
      }
    ]
  }
}
```

### Response — Unauthorized User

```json
{
  "success": true,
  "data": {
    "gatewayId": 1,
    "gatewayName": "Lab Entry Gateway",
    "userId": 99,
    "username": "visitor1",
    "results": [
      {
        "controlPointId": "a1b2c3d4-...",
        "controlPointName": "Lab Door",
        "action": "UNLOCK",
        "success": false,
        "skipped": true,
        "skipReason": "User is not authorized for this control point"
      }
    ]
  }
}
```

### Response — Invalid Token

```json
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid gateway access token"
  }
}
```
