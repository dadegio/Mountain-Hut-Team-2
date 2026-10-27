// DRAFT: to be aligned with backend API contract
export interface Slot {
  id: number;
  label: string; // e.g. "Lunch 12:00–14:00"
  available: boolean;
}

export interface BookingRequest {
  date: string; // "YYYY-MM-DD"
  slotId: number;
  partySize: number;
}

export interface Booking extends BookingRequest {
  id: number;
  status: "confirmed" | "cancelled";
}