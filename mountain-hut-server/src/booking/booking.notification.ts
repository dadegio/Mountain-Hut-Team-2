import { dayFmt, timeFmt, esc } from "../notifications/utils.ts";
import type { EmailSender } from "../notifications/sender.ts";

export interface BookingConfirmation {
  reference: string;
  hikerName: string;
  slotStart: Date;
  slotEnd: Date;
  partySize: number;
  requirements?: string;
}

export async function sendBookingConfirmation(
  sender: EmailSender,
  to: string,
  booking: BookingConfirmation,
): Promise<boolean> {
  try {
    const { subject, text, html } = renderBookingConfirmation(booking);
    await sender.send({ to, subject, text, html });
    return true;
  } catch (err) {
    // Log only the reference and error message: never log requirements (may contain allergy info)
    console.error(
      `Confirmation email failed for booking ${booking.reference}:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

export function renderBookingConfirmation(b: BookingConfirmation) {
  const day = dayFmt.format(b.slotStart);
  const slot = `${timeFmt.format(b.slotStart)}–${timeFmt.format(b.slotEnd)}`;
  const req = b.requirements?.trim() || "None";

  const subject = `Booking confirmation ${b.reference}`;
  const text = [
    `Hello ${b.hikerName},`,
    `your booking has been confirmed.`,
    ``,
    `Booking Reference: ${b.reference}`,
    `Date: ${day}`,
    `Time Slot: ${slot}`,
    `Party Size: ${b.partySize}`,
    `Special Requirements: ${req}`,
  ].join("\n");
  const html = `<p>Hello ${esc(b.hikerName)},</p>
<p>your booking has been confirmed.</p>
<ul>
<li><strong>Booking Reference:</strong> ${esc(b.reference)}</li>
<li><strong>Date:</strong> ${esc(day)}</li>
<li><strong>Time Slot:</strong> ${esc(slot)}</li>
<li><strong>Party Size:</strong> ${b.partySize}</li>
<li><strong>Special Requirements:</strong> ${esc(req)}</li>
</ul>`;
  return { subject, text, html };
}
