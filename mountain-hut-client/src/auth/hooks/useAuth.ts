import { useContext } from 'react'
import { AuthContext } from '../context/auth-context.ts'

export function useAuth() {
  return useContext(AuthContext)
}