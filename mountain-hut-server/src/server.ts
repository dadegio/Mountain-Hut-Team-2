
import Fastify, { type FastifyServerOptions } from "fastify";
import secureSession from "@fastify/secure-session";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { env } from "./config.ts";
import { slotRoutes } from "./slots/slot-routes.ts";
import { availabilityRoutes } from "./booking/availability-routes.ts";
import { bookingRoutes } from "./booking/booking-routes.ts";
import { staffBookingRoutes } from "./booking/staff-booking-routes.ts";
import { changeBookingRoutes } from "./booking/change-booking-routes.ts";
import authRoutes from "./auth/auth.route.ts";
import AuthRepository from "./auth/auth.repository.ts";

export function buildApp(opts: FastifyServerOptions = {}) {
  const server = Fastify({
    logger: true,
    ...opts,
  });

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
      maxAge: 7 * 24 * 60 * 60,
    },
  });

  server.addHook("preHandler", async (request) => {
    const userId = request.session.get("userId");

    if (userId) {
      const user = await AuthRepository.getUserById(userId);
      request.user = user ?? null;
    } else {
      request.user = null;
    }
  });

  server.get("/", async () => ({ hello: "world" }));

  server.register(slotRoutes);
  server.register(availabilityRoutes);
  server.register(bookingRoutes);
  server.register(staffBookingRoutes);
  server.register(changeBookingRoutes);

  const BASE_URL = "/api/v1";
  server.register(authRoutes, {
    prefix: `${BASE_URL}/auth`,
  });

  return server;
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.js"));

if (isMain) {
  const fastify = buildApp();

  fastify.listen({ port: env.PORT }, function (err, _address) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  });
}
