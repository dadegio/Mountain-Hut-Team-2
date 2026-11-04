# MH-07 — Staff booking API (existing hiker)

## Scope

An authenticated `EMPLOYEE` or `MANAGER` can book on behalf of an **existing**
`HIKER`. This deliberately does not implement the other MH-07 flows (new regular
hiker or temporary hiker); those require coordinated auth/database changes.

`POST /api/staff/bookings`

Request, with the staff member logged in through `/api/v1/auth/login`:

```json
{ "hikerId": 2, "slotId": 3, "partySize": 4 }
```

Response: HTTP `201`, identical to `POST /api/bookings`:

```json
{
  "status": "PLACED",
  "userId": 2,
  "slotId": 3,
  "partySize": 4,
  "reservations": [
    { "reservationId": 11, "tableId": 2, "seats": 4 }
  ]
}
```

`hikerId` must be the registered **beneficiary** of the booking, not the
staff member's user ID. The server obtains the employee's identity from the
session cookie, not a client-supplied role or user ID.

## Validation and failures

- `400` invalid body (positive integer IDs, party size 1..1000; extra keys forbidden)
- `401` missing session
- `403` current user is not `EMPLOYEE`/`MANAGER`, or target user is not `HIKER`
- `404` target hiker or slot not found
- `409` slot ended (hut-local Europe/Rome time), already booked this slot, insufficient capacity
- `500` unexpected internal failure, logged on server without leaking details

The endpoint delegates to `createBooking()` (MH-18) with a server-side option
that bypasses the two-hour cutoff **only for authenticated staff**. Staff can
book before or during a slot, but not at or after its end time, evaluated
in `Europe/Rome` using `hutSlotStartMs(slot.date, slot.to)`. Hiker bookings
still close two hours before the slot begins; `isSlotBookable()` is unchanged
(including for hiker booking changes). The beneficiary must still be a HIKER,
and duplicate, capacity, allocation and transaction rules remain unchanged.

## Remaining MH-07 work and merge blockers

1. **Security blocker outside this patch:** the public auth registration currently
   accepts `type: "EMPLOYEE"` or `type: "MANAGER"`. Until the auth owner enforces
   public registration as `HIKER` only, an attacker could register as staff.
   Do not ship the staff endpoint without this security fix.
2. Existing hikers need a staff-visible lookup by name/phone/email. Agree on
   its endpoint and privacy requirements with the auth owner and MH-28 form owner.
3. New full hiker accounts need credentials or a secure invitation flow.
4. Temporary hikers need a schema representation (name plus optional phone,
   no web login) and a transactional create-user-and-book flow, coordinated
   with the database/auth owner. Do not fabricate emails or passwords.
5. The MH-28 form owner needs to call this API for the `existing` hiker mode.

## Tests

The staff integration tests are appended to `booking-routes.test.ts`, using
an in-memory SQLite database and real authenticated HTTP requests. Run:

```bash
cd mountain-hut-server
npx tsc --noEmit
npm test
```

CI requires the independent test-only session environment fix in PR #19.
