# Mountain Hut — Frontend

React + TypeScript frontend for the Mountain Hut system, built with Vite and styled with Tailwind CSS.

## Requirements

- Node.js (LTS recommended)
- npm

## Getting started

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173.

## Scripts

| Command                | Description                                   |
| ---------------------- | --------------------------------------------- |
| `npm run dev`          | Start the dev server with hot reload          |
| `npm run build`        | Type-check and build for production (`dist/`) |
| `npm run preview`      | Serve the production build locally            |
| `npm run lint`         | Run ESLint                                    |
| `npm test`             | Run Vitest test suite                         |
| `npm run test:watch`   | Run Vitest in watch mode                      |
| `npm run test:coverage`| Generate code coverage report                 |

## Tech stack

- **React** + **TypeScript** (TypeScript pinned to 5.9 for `typescript-eslint` compatibility — do not upgrade without checking)
- **Vite** — dev server and build
- **React Router** — client-side routing
- **Tailwind CSS** — styling

## Project structure

```
mountain-hut-client/src/
├── api/          # Functions that call the backend (client.ts = fetch helper)
├── components/   # Reusable UI: Layout, Navbar, ...
├── pages/        # One component per route
├── types/        # Shared TypeScript types (Booking, Slot, ...)
├── utils/        # Small helpers shared by pages and api (dates, ...)
├── App.tsx       # Route definitions
├── main.tsx      # Entry point
└── index.css     # Tailwind import
```

**Rules of thumb**

- Pages never call `fetch` directly — they use functions from `api/`.
- Types used by both `api/` and `pages/` live in `types/`.
- New pages go in `pages/` and get a route in `App.tsx`; they render inside `Layout` automatically.

## Routes

| Path           | Page         | Role |
| -------------- | ------------ | ---- |
| `/`            | Home         | Public |
| `/booking`     | Book a table | Hiker (authenticated) |
| `/my-bookings` | My bookings  | Hiker (authenticated) |
| `/login`       | Login        | Public / Guest |
| `/employee/slots` | Slots and tables | Staff (`EMPLOYEE` / `MANAGER`) |
| `/employee/reserve` | Reserve for hiker | Staff (`EMPLOYEE` / `MANAGER`) |
| `*`            | Not found    | Any |

## Backend Connection

The Vite dev server automatically proxies all `/api` requests to the Fastify backend running on port 3000 (see `vite.config.ts`).

To point at a different backend URL, set `VITE_API_URL` in an `.env` file.

`mountain-hut-client/.env.development`:
```env
VITE_MAIL_SERVICE_URL=http://localhost:8025
```
- `VITE_MAIL_SERVICE_URL` — URL of the hut's email interface. In development points to [Mailpit](https://mailpit.axllent.org/) (`http://localhost:8025`). In production, set to the webmail URL.

## Git workflow

- Branch per task, named after the YouTrack issue: `feature/MH-xx-short-name`
- Include the issue ID in commit messages: `MH-22: add booking form validation`
- Merge into `dev` through a pull request
- Line endings are normalized via `.gitattributes` in the repo root
