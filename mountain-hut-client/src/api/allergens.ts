import { apiFetch } from "./client";
import type { Allergen } from "../types/booking";

// GET /api/allergens
export function getAllergens() {
  return apiFetch<Allergen[]>("/allergens");
}