import { fileURLToPath } from "node:url";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";

export async function swaggerPlugin(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    mode: "static",
    specification: {
      path: fileURLToPath(
        new URL("../../../docs/openapi.yaml", import.meta.url),
      ),
      baseDir: fileURLToPath(new URL("../../../docs", import.meta.url)),
    },
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
  });
}
