# Mountain Hut — API Documentation

This document describes the REST API endpoints provided by the Mountain Hut backend.

Base URL (local development): `http://localhost:3000`

## 1. Table Availability API

**Method:** `GET`

**Endpoint:** `/api/availability`

**Authentication:** Not required.

### Description

Returns table and seat availability for a specified date and party size.

For each configured time slot, the API calculates the available seats by subtracting seats occupied by active reservations from the configured table capacity.

Canceled reservations do not reduce availability.

The endpoint uses the table allocation logic to determine whether the requested party can be accommodated, prioritizing a single table and using multiple tables only when necessary.

### Query parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `date` | string | Yes | Requested date in YYYY-MM-DD format |
| `partySize` | integer | No | Number of people, defaults to 1 (maximum 1000) |
| `slotId` | integer | No | Returns only the specified time slot |

### Example request

`GET /api/availability?date=2026-12-15&partySize=5`

### Example response — 200 OK

```json
{
  "date": "2026-12-15",
  "partySize": 5,
  "slots": [
    {
      "slotId": 1,
      "from": "12:00",
      "to": "13:30",
      "availableSeats": 10,
      "available": true,
      "tables": [
        {
          "tableId": 1,
          "code": "T1",
          "freeSeats": 4
        },
        {
          "tableId": 2,
          "code": "T2",
          "freeSeats": 2
        },
        {
          "tableId": 3,
          "code": "T3",
          "freeSeats": 4
        }
      ],
      "allocation": [
        {
          "tableId": 2,
          "code": "T2",
          "seats": 2
        },
        {
          "tableId": 1,
          "code": "T1",
          "seats": 3
        }
      ]
    }
  ]
}
```

### Response fields

| Field | Description |
|---|---|
| `date` | Requested date |
| `partySize` | Requested number of people |
| `slots` | Time slots returned by the query |
| `slotId` | Identifier of the time slot |
| `from`, `to` | Starting and ending times |
| `availableSeats` | Total unreserved seats |
| `available` | Whether the requested party can be accommodated |
| `tables` | Per-table remaining capacity |
| `allocation` | Proposed distribution of the party across tables, or `null` if unavailable |

The allocation is only a proposal. Calling this endpoint does not create or hold a reservation.

### Error responses

**400 Bad Request**

Returned when query parameters are invalid, including invalid dates, zero or negative party sizes, and non-integer party sizes.

```json
{
  "error": "Invalid query parameters",
  "details": []
}
```

The `details` array contains validation issues.

**404 Not Found**

Returned when a specific `slotId` is requested but is not configured for the date.

```json
{
  "error": "Slot not configured for date"
}
```

### Availability rules

- Available capacity is calculated per table and time slot.
- Active reservations reduce free seats.
- Canceled reservations do not reduce free seats.
- Time slots are evaluated independently.
- The allocation algorithm prefers keeping the party at one table.
- If splitting is necessary, the algorithm minimizes the number of tables and then excess capacity.
- An unavailable party has `available: false` and `allocation: null`.
- The API does not create bookings.

### Manual verification

The current implementation has been checked using SQLite and HTTP requests for:

- Available seats with no existing reservations.
- Party sizes exceeding total capacity.
- Dates without configured availability.
- Invalid party sizes returning HTTP 400.
- Existing reservations reducing available capacity.
- Reservations affecting only their specific time slot.
- Canceled reservations not reducing capacity.

### Pending integration

The API must be adapted to the revised database schema from MH-33, where each time slot belongs to a date.

After this integration, time slots without assigned tables must be returned with zero available seats rather than omitted.

Database compatibility and integration verification must be repeated before final merge.
