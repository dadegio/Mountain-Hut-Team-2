import { apiFetch } from "./client";
import type { AvailabilityResponse } from "../types/availability";

export function getAvailability(date: string, partySize: number) {
  const params = new URLSearchParams({ date, partySize: String(partySize) });
  return apiFetch<AvailabilityResponse>(`/availability?${params}`);
}