# @ecehive/rest

Fastify plugin that exposes the REST endpoints used by external systems.

This package registers the API-token protected routes and reusable request validation helpers that power `/api/rest` on the application server.

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

