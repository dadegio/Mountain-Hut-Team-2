import { apiFetch } from "./client";
import type { Slot, Booking, BookingRequest } from "../types/booking";

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === "true";
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

const mockSlots: Slot[] = [
  { id: 1, label: "Lunch 12:00–14:00", available: true },
  { id: 2, label: "Dinner 19:00–21:00", available: false },
];

const mockBookings: Booking[] = [
  { date: "2026-12-15", slotId: 1, partySize: 4, id: 1, status: "confirmed" },
  { date: "2026-12-20", slotId: 2, partySize: 2, id: 2, status: "cancelled" },
];


export async function getSlots(date: string): Promise<Slot[]> {
  if (USE_MOCKS) {
    await delay(300); // simulate network so loading states are visible
    return mockSlots;
  }
  return apiFetch<Slot[]>(`/slots?date=${date}`);
}

export async function createBooking(data: BookingRequest): Promise<Booking> {
  if (USE_MOCKS) {
    await delay(300);
    return { id: Date.now(), status: "confirmed", ...data };
  }
  return apiFetch<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function getMyBookings(): Promise<Booking[]> {
    if (USE_MOCKS) {
    await delay(300); // simulate network so loading states are visible
    return mockBookings;
  }
    return apiFetch<Booking[]>(`/bookings/mine`);
}