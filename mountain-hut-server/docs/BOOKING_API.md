# Booking API — MH-18 development state

This branch implements the booking workflow but **is not ready to merge into `dev`** until the MH-7 session integration, the booking reference/grouping decision, and API integration tests are finished.

## Current provisional endpoint

`POST /api/bookings`

```json
{"userId": 1, "slotId": 2, "partySize": 5}
```

Success: `201` and an object containing `status: "PLACED"`, `userId`, `slotId`, `partySize` and `reservations: [{reservationId, tableId, seats}]`.

Errors: `400` invalid body; `403` user is not a HIKER; `404` user/slot missing; `409` capacity exhausted, booking deadline passed, or same hiker already booked the same slot.

The service selects a single table if possible, otherwise minimizes the number of tables. Availability is recomputed inside an IMMEDIATE database transaction. Canceled reservations free capacity and do not block a new booking. The date/time cutoff is based on `Europe/Rome`, independently of the server's timezone.

## MH-01 rules implemented in this patch

- [x] Only an existing HIKER can book.
- [x] Only a configured time slot can be booked.
- [x] A booking requires enough free seats, including possible split across tables.
- [x] Booking closes 2 hours before the beginning of the slot.
- [x] Only one active booking per hiker per time slot (canceled bookings excluded).
- [x] Multi-table inserts occur together in a DB transaction.

## Still blocked / requires coordination

- [ ] **MH-7 auth:** replace provisional client-supplied `userId` with `request.user.id` from the authenticated Fastify session; return `401` to guests. The current endpoint must not be considered secure until this happens.
- [ ] **MH-03 mail:** introduce a persisted common booking reference for multiple `reservations` rows; decide grouping in the database with the schema owner before migration.
- [ ] **Frontend contract:** frontend currently sends `{date, slotId, partySize}` while this backend expects `{userId, slotId, partySize}`. Frontend also expects a single `id` and a different status representation. Agree on one contract with the team.
- [ ] **MH-05 dietary requirements:** coordinate whether this is implemented in the current story or a separate task.
- [ ] **Integration tests:** exercise the real HTTP endpoint with a dedicated SQLite database: `201`, `400`, `403`, `404`, `409`, canceled rows, multi-table booking, race/concurrent requests. The test file included here covers timezone and cutoff logic only.
- [ ] **Deployment:** verify CI and review all open PRs before merging. Do not merge in unfinished authentication.

Reference: [official MH-01 story](https://github.com/SE2-Polito/AY26-27-Mountain-Hut/blob/main/stories/MH-01.md).
