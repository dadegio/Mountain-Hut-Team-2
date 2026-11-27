import type { FastifyInstance } from "fastify";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

const DESCRIPTION = `Backend API of the Mountain Hut booking system.

**Sign in:** \`POST /api/v1/auth/login\` sets a session cookie. The browser sends it with the next requests, also from this page.

**Roles:** \`HIKER\`, \`EMPLOYEE\` and \`MANAGER\`. Each endpoint says which roles can use it. Without a line about roles, it is open to everyone.

**Times:** dates are \`YYYY-MM-DD\` and times are \`HH:MM\`, in the hut's local time (Europe/Rome).

**Errors:** any endpoint can also answer \`500\` with an \`Error\` body.`;

export const swaggerPlugin = fp(async (app: FastifyInstance): Promise<void> => {
  await app.register(swagger, {
    openapi: {
      openapi: "3.0.3",
      info: {
        title: "Mountain Hut API",
        version: "1.0.0",
        description: DESCRIPTION,
        license: {
          name: "EUPL-1.2",
          url: "https://eupl.eu/1.2/en/",
        },
      },
    },
    transform: jsonSchemaTransform,
  });

  await app.register(swaggerUi, { routePrefix: "/docs" });
});
