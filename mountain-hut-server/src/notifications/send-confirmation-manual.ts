/**
 * MH-45-T01: verify a real confirmation email is received by local Mailpit.
 *
 * This exercises the notification service -> SMTP -> Mailpit path.
 * It does NOT create a reservation through the Booking API (MH-45-T02).
 *
 * Run from mountain-hut-server:
 *   npx --no-install tsx src/notifications/send-confirmation-manual.ts
 */
import { randomUUID } from "node:crypto";
import { env } from "../config.ts";
import { sendBookingConfirmation } from "./booking-confirmation.ts";
import { SmtpEmailSender } from "./sender.ts";

interface MailpitAddress {
  Address: string;
}
interface MailpitMessageSummary {
  ID: string;
  Subject: string;
  To: MailpitAddress[];
}
interface MailpitSearchResult {
  messages: MailpitMessageSummary[];
}
interface MailpitMessage extends MailpitMessageSummary {
  Text: string;
  HTML: string;
}

const MAILPIT_URL = "http://127.0.0.1:8025";
const RECIPIENT = "mh45@example.test";
const HIKER_NAME = "Mario Test";
const PARTY_SIZE = 5;
const REQUIREMENTS = "Vegetarian meal";

function ensureLocalMailpit(): void {
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    !allowedHosts.has(env.SMTP_HOST) ||
    env.SMTP_PORT !== 1025 ||
    env.SMTP_SECURE ||
    env.SMTP_USER ||
    env.SMTP_PASS
  ) {
    throw new Error(
      "MH-45 may only send to unauthenticated local Mailpit " +
      "(SMTP_HOST=localhost, SMTP_PORT=1025, SMTP_SECURE=false).",
    );
  }
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(3_000) });
  if (!response.ok) {
    throw new Error(`Mailpit API responded with HTTP ${response.status}: ${url}`);
  }
  return (await response.json()) as T;
}

async function findReceivedMessage(subject: string): Promise<MailpitMessage> {
  const query = new URLSearchParams({ query: `subject:${subject.split(" ").at(-1)}` });
  for (let attempt = 0; attempt < 15; attempt++) {
    const list = await getJson<MailpitSearchResult>(
      `${MAILPIT_URL}/api/v1/search?${query.toString()}`,
    );
    const match = list.messages?.find(
      (message) =>
        message.Subject === subject &&
        message.To.some((recipient) => recipient.Address === RECIPIENT),
    );
    if (match) {
      return getJson<MailpitMessage>(
        `${MAILPIT_URL}/api/v1/message/${encodeURIComponent(match.ID)}`,
      );
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No matching email appeared in Mailpit: ${subject}`);
}

function requireFields(message: MailpitMessage, reference: string): void {
  const fields = [
    `Hello ${HIKER_NAME}`,
    `Booking Reference: ${reference}`,
    "Tuesday, December 15, 2026",
    "12:00 PM",
    "2:00 PM",
    `Party Size: ${PARTY_SIZE}`,
    `Special Requirements: ${REQUIREMENTS}`,
  ];
  for (const field of fields) {
    if (!message.Text.includes(field)) {
      throw new Error(`Mailpit plain-text email is missing: ${field}`);
    }
  }
  for (const field of [reference, HIKER_NAME, "December 15, 2026", REQUIREMENTS]) {
    if (!message.HTML.includes(field)) {
      throw new Error(`Mailpit HTML email is missing: ${field}`);
    }
  }
  if (!message.To.some((recipient) => recipient.Address === RECIPIENT)) {
    throw new Error(`Email was not addressed to ${RECIPIENT}`);
  }
}

async function main(): Promise<void> {
  ensureLocalMailpit();
  // Check the local mailbox API BEFORE sending any email.
  await getJson<unknown>(`${MAILPIT_URL}/api/v1/info`);

  const reference = `MH45-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const subject = `Booking confirmation ${reference}`;
  const sent = await sendBookingConfirmation(new SmtpEmailSender(), RECIPIENT, {
    reference,
    hikerName: HIKER_NAME,
    slotStart: new Date("2026-12-15T12:00:00+01:00"),
    slotEnd: new Date("2026-12-15T14:00:00+01:00"),
    partySize: PARTY_SIZE,
    requirements: REQUIREMENTS,
  });
  if (!sent) {
    throw new Error(`Notification service failed to send booking ${reference}`);
  }

  const received = await findReceivedMessage(subject);
  requireFields(received, reference);
  console.log("PASS MH-45-T01: confirmation received and verified in Mailpit");
  console.log(`Reference: ${reference}`);
  console.log(`Recipient: ${RECIPIENT}`);
  console.log(`Subject: ${subject}`);
  console.log("Mailpit: http://localhost:8025");
  console.log("NOTE: MH-45-T02 (Booking API -> automatic email) is still BLOCKED.");
}

main().catch((error: unknown) => {
  console.error("FAIL MH-45-T01:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
