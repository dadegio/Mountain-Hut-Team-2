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

// TODO: for Alice, use this as a starting point for the API,
// when the backend will run I'll align endpoint path, HTTP method, and response type with backend
export function completeHike(id: number): Promise<Hike> {
  return apiFetch<Hike>(`/hikes/${id}/complete`, {
    method: "PATCH",
  });
}