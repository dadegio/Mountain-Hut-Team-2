import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { OpenAPIV3 } from "openapi-types";

// These tests only look at the list of routes: nothing reads the database
vi.mock("./db/database.ts", () => ({ db: {} }));

const { buildApp } = await import("./server.ts");

const HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

// Not part of the API: the placeholder at "/" and the docs page itself
const isApiRoute = (url: string) => url.startsWith("/api/");

const app = buildApp({ logger: false });
const registeredRoutes: string[] = [];

// Must be added here, before the plugins with the routes are loaded
app.addHook("onRoute", (route) => {
  if (!isApiRoute(route.url)) return;

  // "/api/slots/:id" in Fastify is "/api/slots/{id}" in OpenAPI
  const path = route.url.replace(/:(\w+)/g, "{$1}");
  for (const method of [route.method].flat()) {
    if (HTTP_METHODS.includes(method)) registeredRoutes.push(`${method} ${path}`);
  }
});

function documentedRoutes(spec: OpenAPIV3.Document) {
  return Object.entries(spec.paths).flatMap(([path, item]) =>
    HTTP_METHODS.filter((method) => method.toLowerCase() in (item ?? {})).map(
      (method) => `${method} ${path}`,
    ),
  );
}

describe("OpenAPI documentation", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it("documents exactly the routes of the server", () => {
    const spec = app.swagger() as OpenAPIV3.Document;

    expect(documentedRoutes(spec).sort()).toEqual(registeredRoutes.sort());
  });

  it("shows the documentation page", async () => {
    const page = await app.inject({ method: "GET", url: "/docs" });

    expect(page.statusCode).toBe(200);
    expect(page.headers["content-type"]).toContain("text/html");
  });

  it("serves the yaml file", async () => {
    const file = await app.inject({ method: "GET", url: "/docs/yaml" });

    expect(file.statusCode).toBe(200);
    expect(file.body).toContain("title: Mountain Hut API");
  });
});
