// --- POST /api/bookings (MH-18) ---

export interface CreateBookingRequest {
  slotId: number;
  partySize: number;
  requirements?: string; // dietary needs etc
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
  date?: string; 
  from?: string;
  to?: string;
  partySize: number;
  reservations: Reservation[];
}

// --- GET /api/bookings/mine (MH-36) ---

export interface MyBooking {
  id: number;
  date: string; // "YYYY-MM-DD"
  slotId: number;
  from: string; // "HH:MM"
  to: string; // "HH:MM"
  partySize: number;
  status: "PLACED" | "FULFILLED" | "CANCELED";
  createdAt: string; // "YYYY-MM-DD HH:MM:SS" in UTC
  reservations: Reservation[];
}

// --- PATCH /api/bookings/:id (MH-39) ---

// send only what changes, at least one field
export interface ChangeBookingRequest {
  slotId?: number;
  partySize?: number;
}

export interface ChangeBookingResult {
  bookingId: number;
  status: "PLACED";
  userId: number;
  slotId: number;
  partySize: number;
  reservations: Reservation[];
}