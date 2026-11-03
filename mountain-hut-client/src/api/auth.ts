import { apiFetch } from './client'

export interface User {
  id: number
  email: string
  name: string
  surname: string
  phone_number: number | string
  type: string // e.g. "HIKER", "EMPLOYEE" (see auth.schema.ts on the server)
}

export function login(email: string, password: string) {
  return apiFetch<User>('/v1/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function logout() {
  return apiFetch<{ message: string }>('/v1/auth/logout', { method: 'POST' })
}

export function getMe() {
  return apiFetch<User>('/v1/auth/me')
}