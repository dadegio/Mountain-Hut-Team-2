# Story 6 — My bookings API

## GET /api/bookings/mine

Requires a valid login cookie and a **HIKER** session. Uses the authenticated
session's user ID, never a supplied query/body user ID. A guest receives 401,
non-hikers 403 and unexpected server errors 500.

Returns `200` and an array sorted by descending date/time. For example:

```json
[
  {
    "id": 17,
    "date": "2026-12-15",
    "slotId": 3,
    "from": "19:00",
    "to": "21:00",
    "partySize": 5,
    "status": "PLACED",
    "createdAt": "2026-11-04 10:00:00",
    "reservations": [
      { "reservationId": 17, "tableId": 2, "seats": 2 },
      { "reservationId": 18, "tableId": 3, "seats": 3 }
    ]
  }
]
```

An empty result is `[]`. `id` is a real reservation ID and may be passed to
`PATCH /api/bookings/:bookingId`. Table rows belonging to the same logical
booking are grouped by slot, status and original creation timestamp. Every
status (PLACED, FULFILLED, CANCELED) is included. The frontend converts them
to confirmed, completed and cancelled for display.

**Schema limitation:** there is no independent `booking_groups` table / stable
group ID, so grouping cannot be perfectly disambiguated if two historical
bookings for the same slot and status are created in the *same second*. This
API uses the existing representation shared by the change-booking endpoint.

## Verification

From `mountain-hut-server`:

```sh
npx tsc --noEmit
npm test -- tests/integration/booking/booking-routes.booking-endpoints.test.ts
npm test
```

The frontend already calls `/bookings/mine` through its `/api` base URL.
