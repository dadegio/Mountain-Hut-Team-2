import nodemailer, { type Transporter } from "nodemailer";
import { mailConfig } from "../config.ts";

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface EmailSender {
  send(email: OutgoingEmail): Promise<void>;
}

export class SmtpEmailSender implements EmailSender {
  private transporter: Transporter;
  private cfg: typeof mailConfig;

  constructor(cfg = mailConfig) {
    this.cfg = cfg;
    this.transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
  }

  async send(email: OutgoingEmail): Promise<void> {
    await this.transporter.sendMail({
      from: this.cfg.from,
      replyTo: this.cfg.replyTo,
      ...email,
    });
  }
}