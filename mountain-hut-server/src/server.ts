import Fastify from "fastify";
import secureSession from "@fastify/secure-session";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { env } from "./config.ts";
import authRoutes from "./auth/auth.route.ts";
import AuthRepository from "./auth/auth.repository.ts";

// ------- server setup
const server = Fastify({ logger: true });

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(secureSession, {
  secret: env.SESSION_SECRET,
  salt: env.SESSION_SALT,
  cookie: {
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  },
});

// (runs on every incoming request, checks the session cookie, and attaches request.user)
server.addHook("preHandler", async (request) => {
  const userId = request.session.get("userId");
  if (userId) {
    const user = await AuthRepository.getUserById(userId);
    request.user = user ?? null;
  } else {
    request.user = null;
  }
});

// ------- routes
const BASE_URL = "/api/v1";

server.register(authRoutes, { prefix: `${BASE_URL}/auth` });

// ------- start server
server.listen({ port: env.PORT }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  }
});
