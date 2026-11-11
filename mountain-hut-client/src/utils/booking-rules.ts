import type { MyBooking } from "../types/booking.ts";

const CHANGE_WINDOW_MS = 48 * 60 * 60 * 1000; // MH-06: changes within 48h of booking
const SLOT_CUTOFF_MS = 2 * 60 * 60 * 1000; // MH-01: nothing within 2h of the slot

// "2026-11-04 14:14:03" (UTC, from SQLite) -> milliseconds
export function createdAtMs(createdAt: string): number {
  return new Date(createdAt.replace(" ", "T") + "Z").getTime();
}

// slot start in the browser's local time (the hut and its hikers are in Italy)
export function slotStartMs(date: string, from: string): number {
  return new Date(`${date}T${from}`).getTime();
}

export function isPast(b: MyBooking, now = Date.now()): boolean {
  return slotStartMs(b.date, b.from) <= now;
}

export type ChangeBlockReason = "window-expired" | "too-close" | "not-placed" | null;

// why a booking can't be changed, or null if it can
export function changeBlockReason(b: MyBooking, now = Date.now()): ChangeBlockReason {
  if (b.status !== "PLACED") return "not-placed";
  if (now - createdAtMs(b.createdAt) > CHANGE_WINDOW_MS) return "window-expired";
  if (slotStartMs(b.date, b.from) - now < SLOT_CUTOFF_MS) return "too-close";
  return null;
}