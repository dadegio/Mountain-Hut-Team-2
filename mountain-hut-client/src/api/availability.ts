import { apiFetch } from "./client.ts";
import type { AvailabilityResponse } from "../types/availability.ts";

export function getAvailability(date: string, partySize: number) {
  const params = new URLSearchParams({ date, partySize: String(partySize) });
  return apiFetch<AvailabilityResponse>(`/availability?${params}`);
}