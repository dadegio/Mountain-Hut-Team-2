import { afterEach, describe, expect, it, vi } from "vitest";
import {
  renderBookingConfirmation,
  type BookingConfirmation,
} from "./templates.ts";
import { sendBookingConfirmation } from "./confirmation.ts";

const booking: BookingConfirmation = {
  reference: "MH-123",
  hikerName: "Mario Rossi",
  slotStart: new Date("2026-12-15T11:00:00.000Z"), // 12:00 in Rome (CET)
  slotEnd: new Date("2026-12-15T13:00:00.000Z"), // 14:00 in Rome (CET)
  partySize: 5,
  requirements: "No peanuts",
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MH-79 — confirmation email template", () => {
  it("includes the booking reference in the subject", () => {
    expect(renderBookingConfirmation(booking).subject).toBe(
      "Booking confirmation MH-123",
    );
  });

  it("includes hiker name, reference, date, time, party size and requirements in plain text", () => {
    const { text } = renderBookingConfirmation(booking);
    expect(text).toContain("Hello Mario Rossi,");
    expect(text).toContain("Booking Reference: MH-123");
    expect(text).toContain("Date: Tuesday, December 15, 2026");
    expect(text).toContain("Time Slot: 12:00 PM–2:00 PM");
    expect(text).toContain("Party Size: 5");
    expect(text).toContain("Special Requirements: No peanuts");
  });

  it("includes the required booking data in HTML", () => {
    const { html } = renderBookingConfirmation(booking);
    expect(html).toContain("Hello Mario Rossi,");
    expect(html).toContain("<strong>Booking Reference:</strong> MH-123");
    expect(html).toContain("<strong>Party Size:</strong> 5");
    expect(html).toContain("<strong>Special Requirements:</strong> No peanuts");
  });

  it("displays None when requirements are missing or blank", () => {
    expect(
      renderBookingConfirmation({ ...booking, requirements: undefined }).text,
    ).toContain("Special Requirements: None");
    expect(
      renderBookingConfirmation({ ...booking, requirements: "   " }).html,
    ).toContain("<strong>Special Requirements:</strong> None");
  });

  it("trims special requirements", () => {
    const { text, html } = renderBookingConfirmation({
      ...booking,
      requirements: "  Gluten free  ",
    });
    expect(text).toContain("Special Requirements: Gluten free");
    expect(html).toContain(
      "<strong>Special Requirements:</strong> Gluten free",
    );
    expect(html).not.toContain("  Gluten free  ");
  });

  it("escapes user-controlled text in the HTML email", () => {
    const { html } = renderBookingConfirmation({
      ...booking,
      reference: 'MH<&"123',
      hikerName: '<script>alert("x")</script>',
      requirements: '<img src=x onerror="oops"> & nuts',
    });
    expect(html).toContain("MH&lt;&amp;&quot;123");
    expect(html).toContain("&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");
    expect(html).toContain(
      "&lt;img src=x onerror=&quot;oops&quot;&gt; &amp; nuts",
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img");
  });

  it("formats summer dates using Europe/Rome (CEST)", () => {
    const { text } = renderBookingConfirmation({
      ...booking,
      slotStart: new Date("2027-06-15T10:00:00.000Z"),
      slotEnd: new Date("2027-06-15T12:00:00.000Z"),
    });
    expect(text).toContain("Date: Tuesday, June 15, 2027");
    expect(text).toContain("Time Slot: 12:00 PM–2:00 PM");
  });
});

describe("MH-79 — sendBookingConfirmation", () => {
  it("sends one email to the requested address and returns true", async () => {
    const send = vi.fn(
      async (_email: {
        to: string;
        subject: string;
        text: string;
        html: string;
      }) => {},
    );

    const result = await sendBookingConfirmation(
      { send },
      "mario@example.com",
      booking,
    );

    expect(result).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      to: "mario@example.com",
      ...renderBookingConfirmation(booking),
    });
  });

  it("returns false when sending fails, without leaking dietary requirements into logs", async () => {
    const send = vi.fn(async () => {
      throw new Error("SMTP connection refused");
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await sendBookingConfirmation(
      { send },
      "mario@example.com",
      booking,
    );

    expect(result).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(
      "Confirmation email failed for booking MH-123:",
      "SMTP connection refused",
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("No peanuts");
  });
});
