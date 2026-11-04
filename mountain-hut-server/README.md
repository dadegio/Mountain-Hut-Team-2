## Quick Start

Copy `.env.template` to a local `.env` file.

```sh
cp .env.template .env
```

Start the server using

```sh
npm run dev
```

To initialize and seed the database, you can use `npm run db:init` and `npm run db:seed`.

The seed includes an employee for E2E tests and manual testing: `test.employee@example.com` with password `Password123!`. It is for development databases only.
