import { apiFetch } from "../../shared/api/client.ts";
import type { Hike, RegisterHikeRequest } from "../types/hike.ts";

export function registerHike(data: RegisterHikeRequest): Promise<Hike> {
  return apiFetch<Hike>("/hikes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getMyHikes(): Promise<Hike[]> {
  return apiFetch<Hike[]>("/hikes/mine");
}

// MH-191: mark a hike as completed (or cancelled if before departure)
export function completeHike(id: number): Promise<Hike> {
  return apiFetch<Hike>(`/hikes/${id}/complete`, {
    method: "PATCH",
    // Override default Content-Type: application/json since there is no body (Fastify rejects empty JSON bodies with 400)
    headers: {},
  });
}