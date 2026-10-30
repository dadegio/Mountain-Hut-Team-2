import Fastify from "fastify";
import { env } from "./config.ts";
import { availabilityRoutes } from "./booking/availability-routes.ts";
import { bookingRoutes } from "./booking/booking-routes.ts";

const fastify = Fastify({
  logger: true,
});

fastify.get("/", function (_request, reply) {
  reply.send({ hello: "world" });
});

fastify.register(availabilityRoutes);
fastify.register(bookingRoutes);

fastify.listen({ port: env.PORT }, function (err, _address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
