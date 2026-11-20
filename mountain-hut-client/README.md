# Mountain Hut — Frontend

React + TypeScript frontend for the Mountain Hut reservation system, built with Vite and styled with Tailwind CSS v4.

---

## Requirements

- **Node.js** >= 20.x (LTS recommended)
- **npm** >= 10.x

---

## Getting Started

```bash
npm install
npm run dev
```

The development server starts at **`http://localhost:5173`**.
All `/api` requests are proxied to the Fastify backend at `http://localhost:3000` (see `vite.config.ts`).

---

## npm Scripts

| Command                 | Description                                               |
| :---------------------- | :-------------------------------------------------------- |
| `npm run dev`           | Start the Vite dev server with hot reload                 |
| `npm run build`         | TypeScript check (`tsc -b`) + production build to `dist/` |
| `npm run preview`       | Serve the production build locally                        |
| `npm run lint`          | Run ESLint                                                |
| `npm test`              | Run all Vitest unit tests                                 |
| `npm run test:unit`     | Run only `tests/unit/`                                    |
| `npm run test:watch`    | Run Vitest in watch mode                                  |
| `npm run test:coverage` | Generate V8 code coverage report                          |
| `npm run test:e2e`      | Run Playwright end-to-end tests (`tests/e2e/`)            |

---

## Tech Stack

| Tool             | Version | Notes                                                                      |
| :--------------- | :------ | :------------------------------------------------------------------------- |
| **React**        | 19      | UI library                                                                 |
| **TypeScript**   | 5.9     | Pinned — do not upgrade without checking `typescript-eslint` compatibility |
| **Vite**         | 8       | Dev server and bundler                                                     |
| **React Router** | v8      | Client-side routing                                                        |
| **Tailwind CSS** | v4      | Utility-first styling                                                      |
| **Vitest**       | 5       | Unit and component testing                                                 |
| **Playwright**   | 1.64+   | End-to-end browser tests                                                   |

---

## Source Structure

```text
mountain-hut-client/src/
├── api/
│   ├── client.ts           # apiFetch() helper and ApiError — base URL is /api/v1
│   ├── allergens.ts        # GET /api/v1/allergens
│   ├── auth.ts             # POST /api/v1/auth/login, /logout, /register; GET /me
│   ├── availability.ts     # GET /api/v1/availability
│   ├── bookings.ts         # POST, GET, PATCH /api/v1/bookings
│   └── slots.ts            # GET, POST, DELETE /api/v1/slots and /tables
├── assets/                 # Images and video (served via Vite asset pipeline)
├── components/
│   ├── auth/
│   │   └── AuthField.tsx           # Labelled input for login/register forms
│   ├── booking/
│   │   ├── ChangeBookingPanel.tsx  # Inline panel to modify an existing booking
│   │   └── RequirementsFields.tsx  # Allergen checkboxes + free-text notes field
│   ├── layout/
│   │   ├── AuthShell.tsx           # Centred card wrapper for auth pages
│   │   ├── Layout.tsx              # Root layout with Navbar + <Outlet>
│   │   ├── Navbar.tsx              # Top navigation bar (role-aware)
│   │   └── RequireRole.tsx         # Route guard: redirects unauthorised roles
│   └── slots/
│       ├── AddTableForm.tsx        # Form to assign a table to a slot
│       ├── CopyTablesPicker.tsx    # Copy previous day's table layout
│       ├── CreateSlotForm.tsx      # Create a new time slot for a date
│       ├── SlotList.tsx            # List of slots with their tables
│       └── TimeField.tsx           # HH:MM time input with validation
├── context/
│   ├── auth-context.ts     # AuthContext type and default value
│   └── AuthProvider.tsx    # Provides AuthContext; fetches /me on mount
├── hooks/
│   └── useAuth.ts          # Convenience hook — reads AuthContext
├── pages/
│   ├── BookingPage.tsx       # /booking — availability check and reservation form
│   ├── EmployeeSlotsPage.tsx # /employee/slots — slot & table management for staff
│   ├── HomePage.tsx          # / — hero section and image carousel
│   ├── LoginPage.tsx         # /login
│   ├── MyBookingsPage.tsx    # /my-bookings — booking history and change panel
│   ├── NotFoundPage.tsx      # * — 404 fallback
│   └── RegisterPage.tsx      # /register
├── types/
│   ├── auth.ts             # User, UserType
│   ├── availability.ts     # AvailabilityResponse, Slot, TableInfo, Allocation
│   ├── booking.ts          # Booking, Reservation, BookingStatus
│   └── slot.ts             # TimeSlot, Table
├── utils/
│   ├── booking-rules.ts    # isBookingChangeable() — 48-hour change-window logic
│   └── date.ts             # Date formatting helpers
├── App.tsx                 # Route definitions and RequireRole guards
├── index.css               # Tailwind CSS import
└── main.tsx                # React DOM entry point
```

**Conventions:**

- Pages never call `fetch` directly — they use functions from `api/`.
- Types shared between `api/` and `pages/` live in `types/`.
- New pages go in `pages/` and get a `<Route>` in `App.tsx`; they render inside `Layout` automatically.

---

## Application Routes

| Path              | Page                | Access                                                   |
| :---------------- | :------------------ | :------------------------------------------------------- |
| `/`               | `HomePage`          | Public                                                   |
| `/login`          | `LoginPage`         | Public (guest only)                                      |
| `/register`       | `RegisterPage`      | Public (guest only)                                      |
| `/booking`        | `BookingPage`       | Public (guests can check availability; `HIKER` can book) |
| `/my-bookings`    | `MyBookingsPage`    | `HIKER` only                                             |
| `/employee/slots` | `EmployeeSlotsPage` | `EMPLOYEE` / `MANAGER` only                              |
| `*`               | `NotFoundPage`      | Any                                                      |

Role enforcement is handled by `RequireRole` in `App.tsx`. Unauthenticated users attempting restricted routes are redirected to `/login`; logged-in users of the wrong role see the 404 page.

---

## Backend Connection

The Vite dev server proxies all `/api` requests to `http://localhost:3000`:

```ts
// vite.config.ts
server: { proxy: { "/api": "http://localhost:3000" } }
```

The API client (`src/api/client.ts`) uses the base path `/api/v1` by default, overridable via the `VITE_API_URL` environment variable.

### Staff menu choice (MH-116)

The staff reservation page (`/employee/reservations`) includes an optional menu
field. Employees can type a menu name or select one of the suggestions configured
by the hut. The selection is saved with the reservation as
`description: "Menu: <name>"`, using the existing booking notes field. There is
no menu catalog or price API yet, so this does not enforce inventory, quantities
or pricing.

To show real, PO-approved suggestions, set `VITE_STAFF_MENUS` in the client
environment to a pipe-separated list (for example `Menu A|Menu B` as placeholders).
Leave it unset to allow staff to enter the menu name manually.

### Environment Variables

Create a `.env.development` file (or `.env.local`) in the `mountain-hut-client/` directory:

```env
# URL of the email web interface.
# In development: Mailpit local inbox (http://localhost:8025).
# In production: set to the webmail URL accessible by staff.
VITE_MAIL_SERVICE_URL=http://localhost:8025

# Optional: override the backend API base URL (default: /api/v1)
# VITE_API_URL=http://localhost:3000/api/v1
```

---

## Test Structure

```text
mountain-hut-client/tests/
├── setup.ts                               # @testing-library/jest-dom matchers
├── unit/
│   ├── api/
│   │   ├── allergens.api-requests.test.ts
│   │   ├── availability.api-requests.test.ts
│   │   ├── bookings.api-requests.test.ts
│   │   └── client.api-fetch.test.ts
│   ├── components/
│   │   ├── ChangeBookingPanel.booking-edit.test.tsx
│   │   ├── CreateSlotForm.slot-creation.test.tsx
│   │   ├── Navbar.auth-navigation.test.tsx
│   │   └── RequirementsFields.selection.test.tsx
│   ├── pages/
│   │   └── HomePage.role-visibility.test.tsx
│   └── utils/
│       ├── booking-rules.change-policy.test.ts
│       └── date.date-formatting.test.ts
└── e2e/
    ├── booking.e2e.test.ts
    ├── change-booking.e2e.test.ts
    ├── employee-slots.e2e.test.ts
    └── party-requirements.e2e.test.ts
```

---

## Git Workflow

- Branch per task, named after the YouTrack issue: `feature/MH-xx-short-name`
- Include the issue ID in commit messages: `MH-22: add booking form validation`
- Target pull requests at `dev`
- Line endings are normalised via `.gitattributes` in the repository root
