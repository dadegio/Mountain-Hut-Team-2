# Stage 1: Build stage (installs the dependencies)
FROM node:24-alpine AS builder

WORKDIR /app

COPY package*.json ./
# No install scripts (SonarQube): argon2 ships a prebuilt binary for Alpine (musl),
# so nothing needs to be compiled
RUN npm ci --ignore-scripts

# Stage 2: Minimal runtime image
FROM node:24-alpine AS runner

WORKDIR /app

# Copy dependencies built from stage 1
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY drizzle.config.ts ./
COPY docker-entrypoint.sh ./
COPY docs ./docs

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

ENTRYPOINT ["/bin/sh", "./docker-entrypoint.sh"]
