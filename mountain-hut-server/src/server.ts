import Fastify from "fastify";
import { env } from "./config.ts";
import { slotRoutes } from "./slots/slot-routes.ts";

const fastify = Fastify({
  logger: true,
});

fastify.get("/", function (_request, reply) {
  reply.send({ hello: "world" });
});

fastify.register(slotRoutes);

fastify.listen({ port: env.PORT }, function (err, _address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
