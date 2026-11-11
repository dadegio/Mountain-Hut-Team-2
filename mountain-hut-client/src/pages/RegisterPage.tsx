import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { register } from '../api/auth.ts'
import { ApiError } from '../api/client.ts'
import { useAuth } from '../hooks/useAuth.ts'
import AuthShell from '../components/layout/AuthShell'
import AuthField from '../components/auth/AuthField'

const primaryButton =
  'w-full inline-flex items-center justify-center px-7 py-2.5 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer'

const MIN_PASSWORD_LENGTH = 8 // TODO: align with registerSchema in auth.schema.ts

export default function RegisterPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [surname, setSurname] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // already logged in: nothing to register
  if (user) return <Navigate to="/" replace />

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (![name, surname, email, phone, password].every((v) => v.trim())) {
      return setError('Please fill in all fields.')
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`)
    }
    if (password !== confirm) {
      return setError('Passwords do not match.')
    }

    setError(null)
    setSubmitting(true)
    try {
      await register({
        name: name.trim(),
        surname: surname.trim(),
        email: email.trim(),
        phone_number: phone.trim(),
        password,
        type: 'HIKER', // only hikers sign up themselves; staff accounts are created by a manager
      })
      // registering doesn't start a session, so log in right away
      await login(email.trim(), password)
      navigate('/booking', { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('An account with this email already exists.')
      } else if (err instanceof ApiError && err.status === 400) {
        setError('Some fields are invalid. Please check your email, phone number and password.')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      width="2xl"
      badge="Join the Hut"
      title="Create your account"
      subtitle="Book tables, manage your reservations and share your dietary needs."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-white underline hover:text-green-200">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3">
          <AuthField
            id="name"
            label="Name"
            autoComplete="given-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <AuthField
            id="surname"
            label="Surname"
            autoComplete="family-name"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
          />
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
            id="phone"
            label="Phone number"
            type="tel"
            autoComplete="tel"
            placeholder="+39 333 123 4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <AuthField
            id="password"
            label="Password"
            type="password"
            autoComplete="new-password"
            hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <AuthField
            id="confirm"
            label="Confirm password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>

        {error && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        <button type="submit" disabled={submitting} className={primaryButton}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}