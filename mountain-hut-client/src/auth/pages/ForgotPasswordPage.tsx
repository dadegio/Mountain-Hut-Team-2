import { useState } from 'react'
import { Link } from 'react-router'
import AuthShell from '../../shared/components/AuthShell.tsx'
import AuthField from '../components/AuthField.tsx'
import { forgotPassword } from '../api/auth-api.ts'

const primaryButton =
  'w-full inline-flex items-center justify-center px-7 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) {
      setError('Please enter your email.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await forgotPassword(email)
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      badge="Mountain Hut"
      title="Forgot Password"
      subtitle="Enter your email to receive password reset instructions."
      footer={
        <>
          Remember your password?{' '}
          <Link to="/login" className="font-semibold text-white underline hover:text-green-200">
            Log in
          </Link>
        </>
      }
    >
      {submitted ? (
        <div className="space-y-4">
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            If an account with that email exists, we have sent a link to reset your password. Please check your inbox.
          </div>
          <Link to="/login" className={primaryButton}>
            Back to Log in
          </Link>
        </div>
      ) : (
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

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting} className={primaryButton}>
            {submitting ? 'Sending…' : 'Send Reset Link'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
