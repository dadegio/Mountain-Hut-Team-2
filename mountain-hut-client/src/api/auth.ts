import type { RegisterRequest, User } from "../types/auth.ts";
import { apiFetch } from "./client.ts";

export function login(email: string, password: string) {
  return apiFetch<User>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
export function getMe() {
  return apiFetch<User>("/auth/me");
}

export function register(data: RegisterRequest) {
  return apiFetch<User>("/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
