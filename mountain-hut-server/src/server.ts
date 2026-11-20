import Fastify, { type FastifyServerOptions } from "fastify";
import secureSession from "@fastify/secure-session";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { fileURLToPath } from "node:url";
import {
  serializerCompiler,
  validatorCompiler,
} from "fastify-type-provider-zod";

import { UserRepository } from "#src/users/user-repository";
import { allergenRoutes } from "#src/menus/allergens/allergen-routes";
import { authRoutes } from "#src/auth/auth-routes";
import { availabilityRoutes } from "#src/booking/routes/availability-routes";
import { bookingRoutes } from "#src/booking/routes/booking-routes";
import { cancelBookingRoutes } from "#src/booking/routes/cancel-booking-routes";
import { changeBookingRoutes } from "#src/booking/routes/change-booking-routes";
import { dishRoutes } from "#src/menus/dishes/dish-routes";
import { env } from "#src/config";
import { hikeRoutes } from "#src/hikes/hike-routes";
import { menuRoutes } from "#src/menus/menu-routes";
import { slotRoutes } from "#src/slots/slot-routes";
import { staffBookingRoutes } from "#src/booking/routes/staff-booking-routes";
import { userRoutes } from "#src/users/user-routes";

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
      const user = await UserRepository.getUserById(userId);
      request.user = user ?? null;
    } else {
      request.user = null;
    }
  });

  // The routes have no schemas yet, so the docs come from a handwritten file
  server.register(swagger, {
    mode: "static",
    specification: {
      path: fileURLToPath(new URL("../docs/openapi.yaml", import.meta.url)),
      baseDir: fileURLToPath(new URL("../docs", import.meta.url)),
    },
  });
  server.register(swaggerUi, { routePrefix: "/docs" });

  server.get("/", async () => ({ hello: "world" }));

  const BASE_URL = "/api/v1";

  server.register(slotRoutes, { prefix: BASE_URL });
  server.register(availabilityRoutes, { prefix: BASE_URL });
  server.register(bookingRoutes, { prefix: BASE_URL });
  server.register(changeBookingRoutes, { prefix: BASE_URL });
  server.register(staffBookingRoutes, { prefix: BASE_URL });
  server.register(cancelBookingRoutes, { prefix: BASE_URL });

  server.register(hikeRoutes, { prefix: BASE_URL });

  server.register(authRoutes, { prefix: `${BASE_URL}/auth` });
  server.register(userRoutes, { prefix: `${BASE_URL}/users` });

  server.register(allergenRoutes, { prefix: BASE_URL });
  server.register(dishRoutes, { prefix: `${BASE_URL}/dishes` });
  server.register(menuRoutes, { prefix: `${BASE_URL}/menus` });

  return server;
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.js"));

if (isMain) {
  const fastify = buildApp();

  fastify.listen({ port: env.PORT, host: "0.0.0.0" }, function (err, _address) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  });
}
