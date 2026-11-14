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