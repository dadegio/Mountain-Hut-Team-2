import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Client } from "@libsql/client";
import argon2 from "argon2";
import {
  usersTable,
  timeSlotTable,
  tablesTable,
  tableAvailabilityTable,
} from "../db/schema.ts";
import { resetTestDatabase } from "../test-support/test-database.ts";

/**
 * Isolated SQLite database for integration tests.
 */
vi.mock("../db/database.ts", async () => {
  const { createIsolatedTestDatabase } =
    await import("../test-support/test-database.ts");
  const { db, client, cleanup } = createIsolatedTestDatabase();
  return {
    db,
    __integrationTestClient: client,
    __integrationTestCleanup: cleanup,
  };
});

const { db: testDb } = await import("../db/database.ts");
const { __integrationTestClient: client, __integrationTestCleanup: cleanup } =
  (await import("../db/database.ts")) as unknown as {
    __integrationTestClient: Client;
    __integrationTestCleanup: () => void;
  };

const { buildApp } = await import("../server.ts");
const app = buildApp({ logger: false });

const MAILPIT_URL = process.env.MAILPIT_URL || "http://127.0.0.1:8025";
const TEST_PASSWORD = "Password123!";

interface MailpitAddress {
  Address: string;
  Name?: string;
}

interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
}

interface MailpitMessagesResponse {
  total: number;
  messages: MailpitMessageSummary[];
}

interface MailpitMessageDetail extends MailpitMessageSummary {
  Text: string;
  HTML: string;
}

// /** Clear all emails from Mailpit inbox */
// async function clearMailbox(): Promise<void> {
//   await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: "DELETE" });
// }

/** Check if Mailpit API is reachable */
async function isMailpitReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${MAILPIT_URL}/api/v1/info`, {
      signal: AbortSignal.timeout(1_500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Poll Mailpit until an email matching the predicate arrives or timeout expires.
 */
async function waitForEmail(
  predicate: (msg: MailpitMessageSummary) => boolean,
  timeoutMs = 4000,
  pollIntervalMs = 150,
): Promise<MailpitMessageDetail> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    if (res.ok) {
      const data = (await res.json()) as MailpitMessagesResponse;
      const found = data.messages.find(predicate);
      if (found) {
        const detailRes = await fetch(
          `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(found.ID)}`,
        );
        if (detailRes.ok) {
          return (await detailRes.json()) as MailpitMessageDetail;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error("Timeout waiting for email matching criteria in Mailpit");
}

/** Generate dynamic future date for slot fixture */
function futureRomeDate(daysAhead = 3): string {
  const target = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(target);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const slotDate = futureRomeDate(5);
let passwordHash = "";

async function seedFixture(userEmail = "hiker@example.test") {
  await resetTestDatabase(client);

  await testDb.insert(usersTable).values([
    {
      id: 1,
      email: userEmail,
      passwordHash,
      name: "Mario",
      surname: "Rossi",
      type: "HIKER",
    },
  ]);

  await testDb.insert(tablesTable).values([{ id: 1, code: "T1", seats: 4 }]);

  await testDb
    .insert(timeSlotTable)
    .values([{ id: 1, date: slotDate, from: "12:00", to: "14:00" }]);

  await testDb
    .insert(tableAvailabilityTable)
    .values([{ slotId: 1, tableId: 1 }]);
}

async function loginAndGetCookie(
  email: string,
  password = TEST_PASSWORD,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/v1/auth/login",
    payload: { email, password },
  });
  expect(res.statusCode).toBe(200);

  const cookie = res.headers["set-cookie"];
  const cookieHeader = Array.isArray(cookie) ? cookie[0] : cookie;
  return cookieHeader ? cookieHeader.split(";")[0] : "";
}

describe("Booking confirmation email integration tests", () => {
  let mailpitAvailable = false;

  beforeAll(async () => {
    passwordHash = await argon2.hash(TEST_PASSWORD);
    mailpitAvailable = await isMailpitReachable();
    if (!mailpitAvailable) {
      console.warn(
        "Mailpit is not running. Mailpit integration tests will be skipped.",
      );
    }
  });

  afterAll(async () => {
    cleanup();
    await app.close();
  });

  it("sends a confirmation email to the hiker when a table is booked successfully", async (ctx) => {
    if (!mailpitAvailable) {
      ctx.skip();
      return;
    }

    const testEmail = `hiker-success-${Date.now()}@example.test`;
    await seedFixture(testEmail);
    const cookie = await loginAndGetCookie(testEmail);

    // 1. Book a table via POST /api/bookings
    const bookingRes = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { cookie },
      payload: {
        slotId: 1,
        partySize: 2,
        requirements: "Window seat please",
      },
    });

    expect(bookingRes.statusCode).toBe(201);
    const bookingData = JSON.parse(bookingRes.body);
    const expectedReference = `MH-${bookingData.reservations[0].reservationId}`;

    // 2. Await the confirmation email from Mailpit addressed to this unique hiker
    const email = await waitForEmail(
      (msg) =>
        msg.To.some((recipient) => recipient.Address === testEmail) &&
        msg.Subject.includes(expectedReference),
    );

    // 3. Verify recipient and subject
    expect(email.To[0].Address).toBe(testEmail);
    expect(email.Subject).toBe(`Booking confirmation ${expectedReference}`);

    // 4. Verify plain text content
    expect(email.Text).toContain("Hello Mario Rossi,");
    expect(email.Text).toContain(`Booking Reference: ${expectedReference}`);
    expect(email.Text).toContain("Party Size: 2");
    expect(email.Text).toContain("Special Requirements: Window seat please");

    // 5. Verify HTML content
    expect(email.HTML).toContain("Hello Mario Rossi,");
    expect(email.HTML).toContain(
      `<strong>Booking Reference:</strong> ${expectedReference}`,
    );
    expect(email.HTML).toContain("<strong>Party Size:</strong> 2");
    expect(email.HTML).toContain(
      "<strong>Special Requirements:</strong> Window seat please",
    );
  });

  it("does not send any confirmation email when booking fails due to invalid input", async (ctx) => {
    if (!mailpitAvailable) {
      ctx.skip();
      return;
    }

    const testEmail = `hiker-invalid-${Date.now()}@example.test`;
    await seedFixture(testEmail);
    const cookie = await loginAndGetCookie(testEmail);

    // Attempt booking with invalid party size (schema validation failure)
    const res = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { cookie },
      payload: {
        slotId: 1,
        partySize: 0, // Invalid: must be positive
      },
    });

    expect(res.statusCode).toBe(400);

    // Give asynchronous handler a short moment to ensure no unexpected email is sent
    await new Promise((resolve) => setTimeout(resolve, 300));

    const checkRes = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const data = (await checkRes.json()) as MailpitMessagesResponse;
    const messagesForUser = data.messages.filter((m) =>
      m.To.some((recipient) => recipient.Address === testEmail),
    );
    expect(messagesForUser.length).toBe(0);
  });

  it("does not send any confirmation email when booking fails due to lack of seats", async (ctx) => {
    if (!mailpitAvailable) {
      ctx.skip();
      return;
    }

    const testEmail = `hiker-noseats-${Date.now()}@example.test`;
    await seedFixture(testEmail);
    const cookie = await loginAndGetCookie(testEmail);

    // Attempt booking with party size exceeding table availability
    const res = await app.inject({
      method: "POST",
      url: "/api/bookings",
      headers: { cookie },
      payload: {
        slotId: 1,
        partySize: 99,
      },
    });

    expect(res.statusCode).toBe(409);

    await new Promise((resolve) => setTimeout(resolve, 300));

    const checkRes = await fetch(`${MAILPIT_URL}/api/v1/messages`);
    const data = (await checkRes.json()) as MailpitMessagesResponse;
    const messagesForUser = data.messages.filter((m) =>
      m.To.some((recipient) => recipient.Address === testEmail),
    );
    expect(messagesForUser.length).toBe(0);
  });
});
