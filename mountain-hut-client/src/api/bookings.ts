import { apiFetch } from "./client";
import type {
  BookingResult,
  ChangeBookingRequest,
  ChangeBookingResult,
  CreateBookingRequest,
  CreateStaffBookingRequest,
  MyBooking,
} from "../types/booking";

// POST /api/bookings: create a booking for the logged-in hiker
export function createBooking(slotId: number, partySize: number) {
  const body: CreateBookingRequest = { slotId, partySize };
  return apiFetch<BookingResult>("/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// POST /api/staff/bookings: create a booking for a hiker, as staff
export function createStaffBooking(body: CreateStaffBookingRequest) {
  return apiFetch<BookingResult>("/staff/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// GET /api/bookings/mine: the logged-in hiker's bookings
export function getMyBookings() {
  return apiFetch<MyBooking[]>("/bookings/mine");
}

// PATCH /api/bookings/:id: change slot and/or party size of a booking
export function changeBooking(bookingId: number, changes: ChangeBookingRequest) {
  return apiFetch<ChangeBookingResult>(`/bookings/${bookingId}`, {
    method: "PATCH",
    body: JSON.stringify(changes),
  });
}