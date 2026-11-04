export interface CreateBookingRequest {
  slotId: number;
  partySize: number;
}

export interface Reservation {
  reservationId: number;
  tableId: number;
  seats: number;
}

export interface BookingResult {
  status: "PLACED";
  userId: number;
  slotId: number;
  partySize: number;
  reservations: Reservation[];
}

// --- DRAFT: still used by My bookings mocks (MH-36), replace when that API exists ---

export interface BookingRequest {
  date: string; // "YYYY-MM-DD"
  slotId: number;
  partySize: number;
}

export interface Booking extends BookingRequest {
  id: number;
  status: "confirmed" | "cancelled";
}