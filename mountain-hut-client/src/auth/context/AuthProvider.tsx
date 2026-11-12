import { useEffect, useState, type ReactNode } from 'react'
import { getMe, login as apiLogin, logout as apiLogout } from '../api/auth-api.ts'
import type { User } from '../types/auth.ts'
import { AuthContext } from './auth-context.ts'

export default function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // on page load, ask the backend if the session cookie is still valid
  useEffect(() => {
    let ignore = false
    getMe()
      .then((u) => {
        if (!ignore) setUser(u)
      })
      .catch(() => {
        if (!ignore) setUser(null) // 401 = not logged in
      })
      .finally(() => {
        if (!ignore) setLoading(false)
      })
    return () => {
      ignore = true
    }
  }, [])

  async function login(email: string, password: string) {
    const u = await apiLogin(email, password)
    setUser(u)
    return u
  }

  async function logout() {
    await apiLogout()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}