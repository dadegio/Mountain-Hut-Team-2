import Fastify, { type FastifyServerOptions } from "fastify";
import { env } from "./config.ts";

export function buildApp(opts: FastifyServerOptions = {}) {
  const fastify = Fastify({
    logger: true,
    ...opts,
  });

  fastify.get("/", function (_request, reply) {
    reply.send({ hello: "world" });
  });

  return fastify;
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") || process.argv[1].endsWith("server.js"));

if (isMain) {
  const fastify = buildApp();
  fastify.listen({ port: env.PORT }, function (err, _address) {
    if (err) {
      fastify.log.error(err);
      process.exit(1);
    }
  });
}
