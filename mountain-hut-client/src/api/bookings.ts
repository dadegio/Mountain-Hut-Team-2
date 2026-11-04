import { apiFetch } from "./client";
import type { Booking, BookingResult, CreateBookingRequest } from "../types/booking";

export function createBooking(slotId: number, partySize: number) {
  const body: CreateBookingRequest = { slotId, partySize };
  return apiFetch<BookingResult>("/bookings", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

// --- MH-36: My bookings still uses mocks until its API exists ---

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mockBookings: Booking[] = [
  { date: "2026-12-15", slotId: 1, partySize: 4, id: 1, status: "confirmed" },
  { date: "2026-12-20", slotId: 2, partySize: 2, id: 2, status: "cancelled" },
];

export async function getMyBookings(): Promise<Booking[]> {
  if (USE_MOCKS) {
    await delay(300);
    return mockBookings;
  }
  return apiFetch<Booking[]>("/bookings/mine");
}