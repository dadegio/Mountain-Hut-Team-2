#!/bin/sh
set -e

echo "Applying database schema migrations..."
npm run db:init

# Optionally seed the database if DB_SEED is set to true
if [ "$DB_SEED" = "true" ]; then
  echo "Seeding database..."
  npm run db:seed
fi

echo "Starting server..."
exec node --experimental-strip-types src/server.ts
