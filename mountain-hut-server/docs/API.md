# Mountain Hut — API Documentation

This document describes the REST API endpoints provided by the Mountain Hut backend.

**Base URL (local development):** `http://localhost:3000`

---

## 1. Table Availability API

**Method:** `GET`  
**Endpoint:** `/api/availability`  
**Authentication:** Not required.

### Description

Returns table and seat availability for a specified date and party size.

Each time slot is associated with a specific date. The API retrieves all slots configured for the requested date and determines the available seats based on the tables assigned to each slot.

The number of free seats is calculated by subtracting seats occupied by non-canceled reservations from each table's capacity.

The endpoint uses the table allocation logic to determine whether the requested party can be accommodated, prioritizing a single table and splitting the party across multiple tables only when necessary.

### Query parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `date` | string | Yes | Requested date in YYYY-MM-DD format |
| `partySize` | integer | No | Number of people, defaults to 1 (maximum 1000) |
| `slotId` | integer | No | Returns only the specified time slot |

### Example request

`GET /api/availability?date=2026-10-31&partySize=5&slotId=1`

### Example response — 200 OK

Illustrative response based on the MH-33 demo table configuration. Actual dates and IDs depend on the seeded database.

```json
{
  "date": "2026-10-31",
  "partySize": 5,
  "slots": [
    {
      "slotId": 1,
      "from": "12:00",
      "to": "13:00",
      "availableSeats": 23,
      "available": true,
      "tables": [
        { "tableId": 1, "code": "T1", "freeSeats": 2 },
        { "tableId": 2, "code": "T2", "freeSeats": 2 },
        { "tableId": 3, "code": "T3", "freeSeats": 1 },
        { "tableId": 4, "code": "T4", "freeSeats": 4 },
        { "tableId": 5, "code": "T5", "freeSeats": 6 },
        { "tableId": 6, "code": "T6", "freeSeats": 8 }
      ],
      "allocation": [
        { "tableId": 5, "code": "T5", "seats": 5 }
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
| `slots` | Time slots returned for the requested date |
| `slotId` | Identifier of the time slot |
| `from`, `to` | Starting and ending times |
| `availableSeats` | Total free seats across configured tables |
| `available` | Whether the requested party can be accommodated |
| `tables` | List of configured tables with their remaining capacity |
| `allocation` | Proposed seat distribution, or `null` if unavailable |

The allocation is only a proposal. Calling this endpoint does not create, confirm, or hold a reservation.

### Error responses

**400 Bad Request**

Returned when query parameters are invalid, including malformed dates, zero or negative party sizes, and non-integer party sizes.

```json
{
  "error": "Invalid query parameters",
  "details": [
    {
      "origin": "number",
      "code": "too_small",
      "minimum": 0,
      "inclusive": false,
      "path": ["partySize"],
      "message": "Too small: expected number to be >0"
    }
  ]
}
```

The `details` array contains validation issues.

**404 Not Found**

Returned when a specific `slotId` is requested but does not belong to a configured slot for the requested date.

```json
{
  "error": "Slot not configured for date"
}
```

### Availability rules

- Availability is calculated independently for each date and time slot.
- Each slot has its own starting time, ending time, and table configuration.
- Only tables assigned to the requested slot contribute to availability.
- Non-canceled reservations reduce the number of available seats.
- Canceled reservations do not reduce availability.
- A slot without assigned tables is still returned with `availableSeats: 0`, `available: false`, `tables: []`, and `allocation: null`.
- The allocation algorithm prioritizes seating the whole party at a single table, including sharing with other parties.
- If splitting is necessary, the algorithm minimizes the number of tables and then excess capacity.
- An unavailable party has `available: false` and `allocation: null`.
- The endpoint is read-only and does not create reservations.

### Database integration

The API uses the database schema introduced in MH-33.

- `time_slots` contains the date and starting/ending times for each slot.
- `tables` contains table identifiers, codes, and seat capacities.
- `table_availability` associates tables with individual slots.
- `reservations` contains the occupied seats and reservation status for each table and slot.

The API uses the table allocation function implemented in MH-12.

### Manual verification

The implementation has been checked using SQLite and HTTP requests for:

- Availability with no existing reservations.
- Party sizes exceeding total capacity.
- Dates without configured availability.
- Invalid party sizes returning HTTP 400.
- Existing reservations reducing available seats.
- Reservations affecting only their respective time slots.
- Canceled reservations not reducing availability.
- Integration with the MH-33 schema and demo data.

A slot without assigned tables should also be verified before final merge.

### Booking integration

The Availability API provides information about currently available seats but does not guarantee that the same seats will remain available.

The Booking API is responsible for rechecking availability and atomically creating reservations to prevent overbooking.

The booking deadline and user-specific booking constraints are handled by the Booking API.
