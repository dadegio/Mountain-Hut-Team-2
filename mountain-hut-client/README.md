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

| Command           | Description                                   |
| ----------------- | --------------------------------------------- |
| `npm run dev`     | Start the dev server with hot reload          |
| `npm run build`   | Type-check and build for production (`dist/`) |
| `npm run preview` | Serve the production build locally            |
| `npm run lint`    | Run ESLint                                    |

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
├── App.tsx       # Route definitions
├── main.tsx      # Entry point
└── index.css     # Tailwind import
```

**Rules of thumb**

- Pages never call `fetch` directly — they use functions from `api/`.
- Types used by both `api/` and `pages/` live in `types/`.
- New pages go in `pages/` and get a route in `App.tsx`; they render inside `Layout` automatically.

## Routes

| Path           | Page         |
| -------------- | ------------ |
| `/`            | Home         |
| `/booking`     | Book a table |
| `/my-bookings` | My bookings  |
| `/login`       | Login        |
| `*`            | Not found    |

## Mock data vs. real backend

The backend is not available yet, so the frontend uses **mock data by default**.

`mountain-hut-client/.env.development`:

```
VITE_USE_MOCKS=true
```

- `true` — API functions in `src/api/` return mock data (with a short simulated delay).
- `false` — requests go to the backend via `/api/...`.

When using the real backend, the Vite dev server proxies `/api` to the backend (see `vite.config.ts`, default `http://localhost:3001` — **port to be confirmed with the backend team**).

To point at a different backend URL, set `VITE_API_URL` in an `.env` file.

> Note: types in `src/types/` are a **draft** and will be aligned with the backend API contract.

## Git workflow

- Branch per task, named after the YouTrack issue: `feature/MH-xx-short-name`
- Include the issue ID in commit messages: `MH-22: add booking form validation`
- Merge into `main` through a pull request
- Line endings are normalized via `.gitattributes` in the repo root
