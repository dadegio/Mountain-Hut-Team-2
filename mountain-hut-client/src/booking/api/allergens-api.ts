import { apiFetch } from "../../shared/api/client.ts";
import type { Allergen } from "../types/booking.ts";

// GET /api/v1/allergens
export function getAllergens() {
  return apiFetch<Allergen[]>("/allergens");
}