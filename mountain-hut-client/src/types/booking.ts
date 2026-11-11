// --- shared ---

export interface Reservation {
  reservationId: number;
  tableId: number;
  seats: number;
}

// GET /api/v1/allergens (MH-05)
export interface Allergen {
  id: number;
  name: string;
}

// --- POST /api/v1/bookings (MH-18, MH-05) ---

export interface CreateBookingRequest {
  slotId: number;
  partySize: number;
  allergenIds?: number[]; // ticked allergens, ids from GET /api/v1/allergens
  description?: string; // free-text requirements, max 1000 chars
}

export interface BookingResult {
  status: "PLACED";
  userId: number;
  slotId: number;
  date?: string;
  from?: string;
  to?: string;
  partySize: number;
  description?: string | null;
  allergens?: Allergen[];
  reservations: Reservation[];
}

// --- GET /api/v1/bookings/mine (MH-36) ---

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

// --- PATCH /api/v1/bookings/:id (MH-39) ---

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