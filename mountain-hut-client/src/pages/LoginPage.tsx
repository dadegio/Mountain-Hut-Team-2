import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client.ts'
import { useAuth } from '../hooks/useAuth.ts'
import AuthShell from '../components/layout/AuthShell'
import AuthField from '../components/auth/AuthField'

const primaryButton =
  'w-full inline-flex items-center justify-center px-7 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer'

// where each role lands after login
function homeFor(type: string): string {
  return type === 'HIKER' ? '/booking' : '/employee/slots'
}

export default function LoginPage() {
  const { user, login, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
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

  if (user) {
    return (
      <AuthShell badge="Mountain Hut" title={`Welcome back, ${user.name}`} subtitle="You're already logged in.">
        <div className="space-y-4">
          <Link to={homeFor(user.type)} className={primaryButton}>
            {user.type === 'HIKER' ? 'Book a table' : 'Manage slots'}
          </Link>
          <button
            type="button"
            onClick={() => logout()}
            className="w-full text-sm text-stone-600 hover:text-green-700 underline cursor-pointer"
          >
            Log out
          </button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      badge="High Altitude Hut • 2,354 m"
      title="Welcome back"
      subtitle="Log in to book your table at the summit."
      footer={
        <>
          No account yet?{' '}
          <Link to="/register" className="font-semibold text-white underline hover:text-green-200">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5" noValidate>
        <AuthField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <AuthField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className={primaryButton}>
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthShell>
  )
}