# Mountain-Hut-Team-2

A web app for managing meal reservations at a mountain hut. Hikers can book tables, specify dietary needs, and receive confirmations. Employees manage time slots, tables, and reservations.

## Tech Stack
| Layer    | Tech |
|----------|------|
| Frontend | React · TypeScript · Vite · Tailwind CSS |
| Backend  | Node.js · TypeScript · better-sqlite3 |
| Testing  | Vitest · Playwright |

## Prerequisites
- [Node.js](https://nodejs.org/) (LTS recommended)
- npm
> SQLite is file-based — no database server to install.

## Project Structure
```
├── client/                  # React frontend (see client/README.md for details)
├── mountain-hut-server/     # Backend API
├── LICENSE
└── README.md
```

## Getting Started
**Backend**
```bash
cd mountain-hut-server
npm install
npm run dev          # starts on http://localhost:3001
```
**Frontend**
```bash
cd client
npm install
npm run dev          # starts on http://localhost:5173
```
The frontend proxies `/api` calls to the backend automatically.

### Mock Mode
By default the frontend runs with **mock data** so you can work without the backend:
```
# client/.env.development
VITE_USE_MOCKS=true     # set to false when the backend is ready
```

## Running Tests
```bash
# Frontend unit tests
cd client && npm test
# Backend unit tests
cd mountain-hut-server && npm test
# End-to-end tests
cd client && npm run test:e2e
```
> Test scripts will be available after the test infrastructure (MH-6) is merged.

## Git Workflow
1. Create a branch per task: `feature/MH-xx-short-name`
2. Include the issue ID in commits: `MH-22: add booking form validation`
3. Open a pull request to merge into `main`

## License

This project is licensed under the [European Union Public Licence v1.2 (EUPL-1.2)](https://interoperable-europe.ec.europa.eu/collection/eupl/eupl-text-eupl-12) (see [LICENSE](LICENSE)).
We chose the EUPL because it is a copyleft licence that requires any modified version to remain open source, even when offered as an online service, while being legally valid across the EU and available in all official EU languages.
