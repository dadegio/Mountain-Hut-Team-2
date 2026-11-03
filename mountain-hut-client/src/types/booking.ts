// --- Used by POST /api/bookings (MH-18, provisional) ---

export interface CreateBookingRequest {
  userId: number; // TODO(MH-7): removed once session auth is merged
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