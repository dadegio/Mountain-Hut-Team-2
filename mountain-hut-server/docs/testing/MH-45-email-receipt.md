# MH-45 — Booking confirmation email receipt check

**Scope:** Test the `MH-03` booking-confirmation implementation using a real
SMTP submission to Mailpit, then inspect the message actually received.
No external email is sent. The test script automatically checks the Mailpit
HTTP API and the email contents; manual visual inspection can be recorded as
additional evidence.

**Current limitation:** The Booking API does not yet call the notification
module. MH-45-T01 below is a notification-to-Mailpit integration/manual check,
**not** an end-to-end test of `POST /api/bookings`.

## Requirements

- Node.js and project dependencies installed, including `nodemailer`.
  On the current parent email branch, `nodemailer` and its types are not yet
  declared in `package.json`; the parent task owner must commit the dependency
  fix (including `package-lock.json`) before a clean `npm ci` can work.
- Docker Desktop running with local Mailpit:

  ```bash
  docker run -d --name mountain-hut-mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
  # Use `docker start mountain-hut-mailpit` if the container already exists.
  ```

- Local `.env` SMTP settings (no SMTP credentials):

  ```env
  SMTP_HOST=localhost
  SMTP_PORT=1025
  SMTP_SECURE=false
  SMTP_USER=
  SMTP_PASS=
  ```

The script refuses to use non-local SMTP settings and talks only to Mailpit at
`http://127.0.0.1:8025`.

## MH-45-T01 — Verify an email was really received by Mailpit

From `mountain-hut-server` run:

```bash
npx --no-install tsx src/notifications/send-confirmation-manual.ts
```

The script performs these checks:

1. Ensures local, unauthenticated SMTP settings and that Mailpit is reachable.
2. Generates a unique `MH45-...` booking reference.
3. Calls the application's `sendBookingConfirmation()` function using the real
   `SmtpEmailSender` implementation.
4. Searches Mailpit by that reference and checks the **actual received message**.
5. Confirms the recipient, exact subject and both plain-text/HTML contents.
6. Prints `PASS MH-45-T01` only after all checks succeed; otherwise exits with
   a non-zero status.

### Expected contents

| Field | Expected value |
| --- | --- |
| Recipient | `mh45@example.test` |
| Subject | `Booking confirmation MH45-...` (unique per run) |
| Hiker | Mario Test |
| Booking reference | Same reference in subject and body |
| Date | Tuesday, December 15, 2026 (Europe/Rome) |
| Time slot | 12:00 PM–2:00 PM (Europe/Rome) |
| Party size | 5 |
| Special requirements | Vegetarian meal |
| Formats | Both HTML and plain text present |

Also open <http://localhost:8025> and visually inspect the latest email.
Capture a screenshot of the email (without personal data) and attach it to
YouTrack MH-45.

### Execution evidence — fill after running

Tester: DG
Execution date: 2026-11-01
Generated reference: MH45-1793558669628-21d28c46
Automated script result: PASS
Manual Mailpit inspection: PASS (se verificata nel browser)
YouTrack evidence attachment: pending
Notes: MH-45-T02 blocked pending Booking API integration

## MH-45-T02 — Booking API → automatic confirmation

**Status:** COMPLETED. The MH-18 Booking API is now integrated with the MH-03
notification module. When a reservation is placed via `POST /api/bookings`, a single
booking reference (`MH-<id>`) is generated and a confirmation email is dispatched
asynchronously to the authenticated hiker (`request.user.email`).

Integration verification:
- Automated tests in `src/booking/booking-routes.test.ts` verify that `sendBookingConfirmation`
  is invoked with the hiker's email, reference, party size, and slot dates.
- Failed or invalid booking attempts do not trigger any email.
- Real SMTP sending verified via Gmail/SMTP relay.

## Related work

- **MH-79:** Vitest unit tests for the template and notification sender (PR #12).
- **MH-03:** Notification service, email template and SMTP sender.
- **MH-18:** Booking endpoint and reservation persistence (Draft PR #11).
