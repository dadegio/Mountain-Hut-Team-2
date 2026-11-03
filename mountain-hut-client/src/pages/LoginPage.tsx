import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../hooks/useAuth'

// where each role lands after login
function homeFor(type: string): string {
  return type === 'HIKER' ? '/booking' : '/employee/slots'
}

export default function LoginPage() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  // page the user tried to open before being sent to login, if any
  const from = (location.state as { from?: string } | null)?.from

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return setError('Please enter email and password.')

    setError(null)
    setSubmitting(true)
    try {
      const u = await login(email, password)
      navigate(from ?? homeFor(u.type), { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 401
          ? 'Invalid email or password.'
          : 'Something went wrong. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  // already logged in: no need to show the form
  if (user) {
    return (
      <div className="max-w-md bg-white border border-stone-200 rounded-lg p-6 space-y-3">
        <p>
          You are logged in as <strong>{user.name} {user.surname}</strong>.
        </p>
        <div className="flex gap-4">
          <Link to={homeFor(user.type)} className="text-green-700 underline">
            {user.type === 'HIKER' ? 'Book a table' : 'Manage slots'}
          </Link>
          <button onClick={() => logout()} className="text-stone-600 underline cursor-pointer">
            Log out
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md">
      <h1 className="text-2xl font-semibold mb-6">Log in</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 bg-white border border-stone-200 rounded-lg p-6"
      >
        <div>
          <label htmlFor="email" className="block text-sm font-medium mb-2">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium mb-2">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-stone-300 rounded px-3 py-2"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-green-700 text-white rounded py-2 font-medium hover:bg-green-800 disabled:opacity-50"
        >
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </div>
  )
}