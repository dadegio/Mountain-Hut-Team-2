const dayFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", dateStyle: "full" });
const timeFmt = new Intl.DateTimeFormat("it-IT", { timeZone: "Europe/Rome", timeStyle: "short" });

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
    const req = b.requirements?.trim() || "Nessuna";

    const subject = `Conferma prenotazione ${b.reference}`;
    const text = [
        `Ciao ${b.hikerName},`,
        `la tua prenotazione è confermata.`,
        ``,
        `Riferimento: ${b.reference}`,
        `Data: ${day}`,
        `Fascia oraria: ${slot}`,
        `Persone: ${b.partySize}`,
        `Richieste particolari: ${req}`,
    ].join("\n");
    const html = `<p>Ciao ${esc(b.hikerName)},</p>
<p>la tua prenotazione è confermata.</p>
<ul>
<li><strong>Riferimento:</strong> ${esc(b.reference)}</li>
<li><strong>Data:</strong> ${esc(day)}</li>
<li><strong>Fascia oraria:</strong> ${esc(slot)}</li>
<li><strong>Persone:</strong> ${b.partySize}</li>
<li><strong>Richieste particolari:</strong> ${esc(req)}</li>
</ul>`;
    return { subject, text, html };
}