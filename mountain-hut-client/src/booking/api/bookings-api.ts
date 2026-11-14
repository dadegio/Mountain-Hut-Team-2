import { apiFetch } from "../../shared/api/client.ts";
import type {
  BookingResult,
  ChangeBookingRequest,
  ChangeBookingResult,
  CreateBookingRequest,
  CreateStaffBookingRequest,
  MyBooking,
} from "../types/booking.ts";

// optional extras for a booking (MH-05)
export interface BookingExtras {
  allergenIds?: number[];
  description?: string;
}

// POST /api/v1/bookings: create a booking for the logged-in hiker
export function createBooking(slotId: number, partySize: number, extras: BookingExtras = {}) {
  const body: CreateBookingRequest = { slotId, partySize };

  // only send what was actually filled in
  if (extras.allergenIds && extras.allergenIds.length > 0) {
    body.allergenIds = extras.allergenIds;
  }
  const description = extras.description?.trim();
  if (description) {
    body.description = description;
  }

  return apiFetch<BookingResult>("/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// POST /api/v1/staff/bookings: staff book for an existing hiker (MH-07)
export function createStaffBooking(body: CreateStaffBookingRequest) {
  return apiFetch<BookingResult>("/staff/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// GET /api/v1/bookings/mine: the logged-in hiker's bookings
export function getMyBookings() {
  return apiFetch<MyBooking[]>("/bookings/mine");
}

// PATCH /api/v1/bookings/:id: change slot and/or party size of a booking
export function changeBooking(bookingId: number, changes: ChangeBookingRequest) {
  return apiFetch<ChangeBookingResult>(`/bookings/${bookingId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}