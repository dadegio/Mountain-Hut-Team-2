import type { EmailSender } from "./sender.ts";
import { renderBookingConfirmation, type BookingConfirmation } from "./templates.ts";

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