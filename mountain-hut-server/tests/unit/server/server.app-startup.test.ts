import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  server: {
    setValidatorCompiler: vi.fn(),
    setSerializerCompiler: vi.fn(),
    register: vi.fn(),
    addHook: vi.fn(),
    get: vi.fn(),
    listen: vi.fn(),
    log: { error: vi.fn() },
  },
}));

vi.mock("fastify", () => ({
  default: vi.fn(() => mocks.server),
}));
vi.mock("@fastify/secure-session", () => ({ default: vi.fn() }));
vi.mock("@fastify/swagger", () => ({ default: vi.fn() }));
vi.mock("@fastify/swagger-ui", () => ({ default: vi.fn() }));
vi.mock("fastify-type-provider-zod", () => ({
  serializerCompiler: vi.fn(),
  validatorCompiler: vi.fn(),
}));
vi.mock("../../../src/config.ts", () => ({
  env: {
    PORT: 3000,
    SESSION_SECRET: "a".repeat(32),
    SESSION_SALT: "1234567890123456",
  },
}));
vi.mock("../../../src/slots/slot-routes.ts", () => ({ slotRoutes: vi.fn() }));
vi.mock("../../../src/booking/routes/availability-routes.ts", () => ({
  availabilityRoutes: vi.fn(),
}));
vi.mock("../../../src/booking/routes/booking-routes.ts", () => ({ bookingRoutes: vi.fn() }));
vi.mock("../../../src/booking/routes/staff-booking-routes.ts", () => ({
  staffBookingRoutes: vi.fn(),
}));
vi.mock("../../../src/booking/routes/change-booking-routes.ts", () => ({
  changeBookingRoutes: vi.fn(),
}));
vi.mock("../../../src/allergens/allergen-routes.ts", () => ({
  allergenRoutes: vi.fn(),
}));
vi.mock("../../../src/hikes/hike-routes.ts", () => ({
  hikeRoutes: vi.fn(),
}));
vi.mock("../../../src/auth/auth-routes.ts", () => ({ default: vi.fn() }));
vi.mock("../../../src/auth/auth-repository.ts", () => ({
  default: { getUserById: vi.fn() },
}));

async function loadAsEntrypoint() {
  const previousArgv = process.argv[1];
  process.argv[1] = "/tmp/server.ts";
  vi.resetModules();
  try {
    return await import("../../../src/server.ts");
  } finally {
    process.argv[1] = previousArgv;
  }
}

afterEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe("server app startup", () => {
  it("listens on the configured port when executed as the entry point", async () => {
    await loadAsEntrypoint();

    expect(mocks.server.listen).toHaveBeenCalledTimes(1);
    expect(mocks.server.listen.mock.calls[0][0]).toEqual({ port: 3000 });
    expect(mocks.server.register).toHaveBeenCalledTimes(11);
    expect(mocks.server.get).toHaveBeenCalledWith(
      "/",
      expect.any(Function),
    );

    const callback = mocks.server.listen.mock.calls[0][1] as (
      error: Error | null,
      address: string,
    ) => void;
    callback(null, "http://127.0.0.1:3000");
    expect(mocks.server.log.error).not.toHaveBeenCalled();
  });

  it("logs a listen failure and exits with status 1", async () => {
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation(() => undefined as never);
    await loadAsEntrypoint();

    const callback = mocks.server.listen.mock.calls[0][1] as (
      error: Error | null,
      address: string,
    ) => void;
    const failure = new Error("Port is already in use");
    callback(failure, "");

    expect(mocks.server.log.error).toHaveBeenCalledWith(failure);
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
