import Fastify from "fastify";

const PORT: number = 3000;

const fastify = Fastify({
  logger: true,
});

fastify.get("/", function (_request, reply) {
  reply.send({ hello: "world" });
});

fastify.listen({ port: PORT }, function (err, _address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
});
