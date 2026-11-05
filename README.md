# Mountain-Hut-Team-2

A web application for managing meal reservations and dining schedules at an Alpine mountain hut.

Hikers can view real-time table availability, book meals with specific dietary needs and allergens, receive automated email confirmations, and modify existing bookings. Hut employees can configure daily meal slots, allocate tables, manage capacities, and create bookings on behalf of hikers.

---

## Tech Stack

| Layer        | Technologies                                                                         |
| :----------- | :----------------------------------------------------------------------------------- |
| **Frontend** | React 19 · TypeScript 5.9 · Vite 8 · Tailwind CSS v4 · React Router v7               |
| **Backend**  | Node.js (v20–v24) · TypeScript · Fastify v5 · Zod · Fastify Secure Session           |
| **Database** | SQLite via `@libsql/client` · Drizzle ORM · Drizzle Kit                              |
| **Email**    | Nodemailer (SMTP transport) · Mailpit (Local dev/testing) · Brevo (Production relay) |
| **Testing**  | Vitest (Client & Server unit/integration) · Playwright (Cross-browser E2E)           |
| **API Docs** | OpenAPI 3.0 / Swagger UI (`/docs`)                                                   |

---

## Prerequisites

- **[Node.js](https://nodejs.org/)** >= 20.x (LTS recommended, tested on v22 and v24)
- **npm** >= 10.x
- **[Docker](https://www.docker.com/)** _(optional)_ — to run Mailpit locally for testing email capture
- SQLite is file-based and embedded — no external database server needed.

---

## Project Structure

```text
Mountain-Hut-Team-2/
├── mountain-hut-client/     # React frontend application
│   ├── e2e/                 # Playwright end-to-end tests
│   ├── src/                 # Components, pages, API clients, and utilities
│   └── playwright.config.ts # E2E test configuration
├── mountain-hut-server/     # Fastify REST API backend
│   ├── src/
│   │   ├── auth/            # Authentication & session handlers
│   │   ├── booking/         # Table allocation, booking routes, and change rules
│   │   ├── slots/           # Time slot & table configuration routes
│   │   ├── allergens/       # Allergens service and routes
│   │   ├── notifications/   # SMTP email sender, templates, confirmation logic
│   │   └── db/              # Drizzle schema, migrations, and seed scripts
│   └── docs/                # OpenAPI specification & API guidelines
├── .github/workflows/       # CI and E2E test GitHub Actions workflows
├── LICENSE                  # EUPL-1.2 Open Source Licence
└── README.md                # System documentation
```

---

## Quick Start Guide

### 1. Backend Setup

From the repository root:

```bash
cd mountain-hut-server
npm install

# 1. Create environment configuration
cp .env.template .env

# 2. Push database schema to SQLite (creates local.db)
npm run db:init

# 3. Seed demo users, tables, time slots, and allergens
npm run db:seed

# 4. Start the backend development server
npm run dev
```

The API server will start on **`http://localhost:3000`**.
Interactive API documentation is available at **`http://localhost:3000/docs`**.

---

### 2. Frontend Setup

In a new terminal window:

```bash
cd mountain-hut-client
npm install

# Start Vite development server
npm run dev
```

The frontend application will start on **`http://localhost:5173`**.
Vite automatically proxies all `/api` requests to `http://localhost:3000`.

---

### 3. Local Email Service (Mailpit)

The system automatically sends booking confirmations to hikers via SMTP. In local development, emails are routed to **Mailpit**, a fake local SMTP server with a web UI.

Start Mailpit using Docker:

```bash
docker run -d --name mailpit -p 8025:8025 -p 1025:1025 axllent/mailpit
```

- **Web Inbox**: [http://localhost:8025](http://localhost:8025) (inspect captured confirmation emails)
- **SMTP Server**: `localhost:1025` (pre-configured in `.env.template`)

_(If Docker is not installed, the application continues to operate normally; failed email deliveries are logged without blocking bookings)._

---

## Pre-configured Demo Accounts

The database seed (`npm run db:seed`) provides test accounts with different roles:

| Role         | Email                       | Password       | Description                                           |
| :----------- | :-------------------------- | :------------- | :---------------------------------------------------- |
| **Hiker**    | `giulia.verdi@example.com`  | `giuliaverdi`  | Regular hiker with existing booking history           |
| **Hiker**    | `mario.rossi@example.com`   | `mariorossi`   | Regular hiker account                                 |
| **Employee** | `luca.neri@example.com`     | `lucaneri`     | Staff account (can manage slots & staff reservations) |
| **Employee** | `test.employee@example.com` | `Password123!` | Test staff account                                    |

_(You can also register a brand new hiker account directly from the frontend registration page)._

---

## Using the System

### As a Hiker

1. **Log in** at `http://localhost:5173/login` with hiker credentials.
2. **Book a Table** (`/booking`):
   - Choose a meal date and party size.
   - Real-time slot availability displays remaining capacity.
   - Select dietary allergens (Milk, Eggs, Peanuts, Wheat, etc.) and add custom requirements/notes.
   - Click **Book** to confirm. Table allocation is computed automatically to minimize unused seats.
   - Check [http://localhost:8025](http://localhost:8025) to view your email confirmation with reference number, date, time, and requirements.
3. **Manage Bookings** (`/my-bookings`):
   - View upcoming and past reservations.
   - Modify party size or time slot within 48 hours of booking (provided the slot start cutoff has not passed).

### As Hut Staff (Employee)

1. **Log in** with employee credentials (`luca.neri@example.com`).
2. **Manage Slots & Tables** (`/employee/slots`):
   - Navigate day by day to create lunch and dinner slots.
   - Assign available tables (T1–T6) to specific slots.
   - Copy yesterday's table layout or apply presets.
3. **Staff Reservations** (`/employee/reserve`):
   - Book tables for phone-in or walk-in hikers without being restricted by the 2-hour cutoff rule.

---

## Running Tests

### Backend Tests

```bash
cd mountain-hut-server

# Run unit and integration tests (Vitest)
npm test

# Run tests in watch mode
npm run test:watch
```

### Frontend Tests

```bash
cd mountain-hut-client

# Run Vitest unit and component tests
npm test

# Run ESLint and TypeScript checks
npm run lint
npm run build
```

### End-to-End (E2E) Browser Tests

The end-to-end suite uses [Playwright](https://playwright.dev/) to verify full user journeys across frontend and backend.

```bash
cd mountain-hut-client

# Install browser binaries (first time only)
npx playwright install chromium

# Ensure the backend server is running on port 3000, then execute:
npx playwright test
```

---

## Production Email Configuration (Brevo)

To dispatch real emails in production instead of using Mailpit, configure an external SMTP relay such as [Brevo](https://www.brevo.com/) in `mountain-hut-server/.env`:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-brevo-account-email@example.com
SMTP_PASS=your-brevo-smtp-key
MAIL_FROM_ADDRESS=reservations@mountain-hut.example
MAIL_FROM_NAME="Mountain Hut Reservations"
MAIL_REPLY_TO=info@mountain-hut.example
```

---

## Git & Contribution Workflow

1. Create a task branch branched from `dev`:
   ```bash
   git checkout dev
   git pull origin dev
   git checkout -b feature/MH-xx-short-description
   ```
2. Commit with task reference:
   ```bash
   git commit -m "MH-xx: concise description of changes"
   ```
3. Push to origin and open a Pull Request targeting **`dev`**.
4. Pull requests require all CI checks (linting, backend tests, frontend tests, E2E tests) to pass before merging.

---

## License

This project is licensed under the **[European Union Public Licence v1.2 (EUPL-1.2)](https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12)** (see [LICENSE](LICENSE)).

We chose the EUPL because it is a copyleft licence that requires any modified version to remain open source, even when offered as an online service, while being legally valid across the EU and available in all official EU languages.
