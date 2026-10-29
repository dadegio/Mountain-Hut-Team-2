## Quick Start

Copy `.env.template` to a local `.env` file and fill in the required values.

```sh
cp .env.template .env
```

Start the server using

```sh
npm run dev
```

To initialize and seed the database, you can use `npm run db:init` and `npm run db:seed`.

## Email Notifications

The server sends booking confirmation emails via SMTP using [Nodemailer](https://nodemailer.com/).

### Local development (Mailpit)

In development, emails are intercepted by [Mailpit](https://mailpit.axllent.org/) — a local fake SMTP server. No real emails are ever sent.

Start Mailpit (Docker):
```sh
docker run -d -p 8025:8025 -p 1025:1025 axllent/mailpit
```

The default `.env` values point to Mailpit out of the box:
```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
```

Open `http://localhost:8025` to inspect captured emails.

### Production ([Brevo](https://www.brevo.com/))

To send real emails, update the SMTP variables in `.env` with your Brevo credentials. **No code changes are required — configuration only.**

1. Create a free account on [brevo.com](https://www.brevo.com/) (free plan: up to 300 emails/day).
2. Go to **SMTP & API → SMTP** and generate an SMTP key.
3. Set the following variables in the server `.env`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<your-brevo-account-email>
SMTP_PASS=<your-brevo-smtp-key>
MAIL_FROM_ADDRESS=prenotazioni@mountain-hut.example
MAIL_FROM_NAME=Rifugio Mountain Hut
MAIL_REPLY_TO=prenotazioni@mountain-hut.example
```

> The `SMTP_PASS` is the **SMTP key** generated in the Brevo dashboard, not your Brevo account password.

### Module structure

```
src/notifications/
├── index.ts               # Singleton emailSender instance
├── sender.ts              # SmtpEmailSender (EmailSender interface + Nodemailer)
├── templates.ts           # renderBookingConfirmation — builds subject/text/html
└── booking-confirmation.ts # sendBookingConfirmation — domain-level send function
```

> `send-test.ts` is a dev-only script to manually verify the SMTP connection: `npx tsx src/notifications/send-test.ts`
