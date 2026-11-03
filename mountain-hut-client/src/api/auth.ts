import type { RegisterRequest, User } from "../types/auth";
import { apiFetch } from "./client";

export function login(email: string, password: string) {
  return apiFetch<User>("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function logout() {
  return apiFetch<{ message: string }>("/v1/auth/logout", {
    method: "POST",
    body: JSON.stringify({}),
  });
}
export function getMe() {
  return apiFetch<User>("/v1/auth/me");
}

export function register(data: RegisterRequest) {
  return apiFetch<User>("/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
