const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", dateStyle: "full" });
const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Rome", timeStyle: "short" });

const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface BookingConfirmation {
    reference: string;
    hikerName: string;
    slotStart: Date;
    slotEnd: Date;
    partySize: number;
    requirements?: string;
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