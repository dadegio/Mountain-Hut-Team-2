import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createTransport: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: mocks.createTransport,
  },
}));

import { SmtpEmailSender } from "../../../src/notifications/sender.ts";

const email = {
  to: "hiker@example.test",
  subject: "Booking confirmation",
  text: "Booking details",
  html: "<p>Booking details</p>",
};

const config = {
  host: "smtp.example.test",
  port: 587,
  secure: true,
  user: undefined as string | undefined,
  pass: undefined as string | undefined,
  from: '"Mountain Hut" <booking@example.test>',
  replyTo: undefined as string | undefined,
};

afterEach(() => {
  mocks.createTransport.mockReset();
  mocks.sendMail.mockReset();
});

describe("sender SMTP delivery", () => {
  it("creates an unauthenticated transport and sends with configured headers", async () => {
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    mocks.sendMail.mockResolvedValue(undefined);
    const sender = new SmtpEmailSender(config);

    await sender.send(email);

    expect(mocks.createTransport).toHaveBeenCalledWith({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: undefined,
    });
    expect(mocks.sendMail).toHaveBeenCalledWith({
      from: config.from,
      replyTo: undefined,
      ...email,
    });
  });

  it("adds SMTP authentication when a user is configured", async () => {
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    const sender = new SmtpEmailSender({
      ...config,
      user: "mailer",
      pass: "smtp-password",
    });

    expect(mocks.createTransport).toHaveBeenLastCalledWith({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: { user: "mailer", pass: "smtp-password" },
    });
  });

  it("propagates SMTP transport failures to the caller", async () => {
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail });
    const failure = new Error("SMTP unavailable");
    mocks.sendMail.mockRejectedValue(failure);
    const sender = new SmtpEmailSender(config);

    await expect(sender.send(email)).rejects.toBe(failure);
  });
});
