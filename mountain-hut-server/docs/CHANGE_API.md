# MH-39 / MH-46 — Change Booking API

## Endpoint

`PATCH /api/bookings/:bookingId`

Until authentication is integrated with MH-7, the current **provisional** request is:

```json
{"userId": 1, "slotId": 2, "partySize": 5}
```

`userId` is mandatory until replaced by the authenticated session. `slotId` and `partySize` are optional, but at least one must be present. A different date/time is selected by supplying the ID of another configured time slot; the API does not create or edit time slots.

Success: HTTP `200`, with `bookingId`, `status: "PLACED"`, `userId`, `slotId`, `partySize`, and `reservations: [{reservationId, tableId, seats}]`. The requested `bookingId` remains valid through the change even if the group is split across several tables.

| HTTP | Condition |
| --- | --- |
| `400` | Malformed booking ID, invalid values, unsupported fields, or no change fields |
| `403` | User is not a HIKER |
| `404` | User, booking, or target slot missing; booking belongs to another user |
| `409` | 48-hour change window expired, booking is not PLACED, 2-hour MH-01 cutoff passed, duplicate destination booking, or insufficient seats |
| `500` | Unexpected server error |

## Rules and transaction behavior

- The 48-hour window starts at the original `reservations.created_at` (SQLite UTC), not the meal date; the boundary is inclusive. Later edits do not restart the clock.
- Only `PLACED` bookings can be updated.
- Existing MH-01 rules apply: only hikers, configured time slots, the 2-hour cutoff in Europe/Rome, one active booking per hiker/slot, and sufficient real-time capacity.
- Allocation prefers one table, otherwise the fewest tables using the existing MH-12 algorithm; sharing is permitted.
- A booking spanning multiple rows is identified by `userId + original slotId` under the MH-01 one-active-booking rule. All affected rows are updated, inserted or removed in one IMMEDIATE SQLite transaction. The supplied reservation ID stays in the result; other row IDs may change.
- If validation or capacity checks fail, the transaction rolls back without altering the original booking.

## Verification

From `mountain-hut-server`:

```sh
npm ci
npx tsc --noEmit
npm test -- src/booking/change-rules.test.ts src/booking/change-booking-routes.test.ts
npm test
```

The tests use a dedicated in-memory SQLite database, with no changes to development data.

## Dependencies / limitations

- **MH-18**: this work depends on the not-yet-merged `feature/booking-api` implementation. Base this branch/PR on that feature branch until it is merged.
- **MH-7 (security)**: the `userId` body field is **not authentication** and may be forged. Replace it with the hiker ID from the verified session and return `401` for guests before releasing this endpoint to users.
- **MH-03**: a stable persisted booking-group reference should replace the provisional `userId + slotId` grouping, coordinated with the DB schema owner. This implementation preserves the chosen reservation ID within each PATCH transaction but does not introduce a cross-table booking ID.
- **MH-06 requirements**: dietary/other requirements cannot be changed yet because the current database schema has no requirements field. Coordinate this separately with the requirements story/schema owner; do not claim that the full user story is complete until supported.
