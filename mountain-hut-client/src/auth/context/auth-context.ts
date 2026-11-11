import { createContext } from 'react'
import type { User } from '../types/auth.ts'

export interface AuthContextValue {
  user: User | null
  loading: boolean // true while checking /me on page load
  login: (email: string, password: string) => Promise<User>
  logout: () => Promise<void>
}

// default = "not logged in", so components (and tests) work without a provider
export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: false,
  login: async () => {
    throw new Error('AuthProvider is missing')
  },
  logout: async () => {},
})