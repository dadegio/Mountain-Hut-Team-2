import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import AuthShell from '../../shared/components/AuthShell.tsx'
import AuthField from '../components/AuthField.tsx'
import { resetPassword } from '../api/auth-api.ts'
import { ApiError } from '../../shared/api/client.ts'
import { useAuth } from '../hooks/useAuth.ts'

const primaryButton =
  'w-full inline-flex items-center justify-center px-7 py-3 text-base font-semibold text-white bg-green-600 hover:bg-green-500 active:bg-green-700 rounded-lg shadow-lg transition-colors disabled:opacity-50 cursor-pointer'

export default function ResetPasswordPage() {
  const { logout } = useAuth()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!token) {
      setError('Invalid or missing password reset token.')
      return
    }
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setError(null)
    setSubmitting(true)

    try {
      await resetPassword(token, password)
      try {
        localStorage.setItem('mountain_hut_auth_password_reset', Date.now().toString())
        localStorage.setItem('mountain_hut_auth_changed', Date.now().toString())
        await logout()
      } catch {
        // ignore background logout errors
      }
      setSuccess(true)
    } catch (err) {
      if (err instanceof ApiError && err.message) {
        let clean = err.message
        const jsonStartIndex = clean.indexOf('{')
        if (jsonStartIndex !== -1) {
          try {
            const parsed = JSON.parse(clean.slice(jsonStartIndex))
            if (typeof parsed.message === 'string') clean = parsed.message
            else if (typeof parsed.error === 'string') clean = parsed.error
          } catch {
            clean = clean.replace(/^API error \d+:\s*/, '')
          }
        } else {
          clean = clean.replace(/^API error \d+:\s*/, '')
        }
        setError(clean)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      badge="Mountain Hut"
      title="Reset Password"
      subtitle="Set a new password for your account."
      footer={
        <>
          Back to{' '}
          <Link to="/login" className="font-semibold text-white underline hover:text-green-200">
            Log in
          </Link>
        </>
      }
    >
      {success ? (
        <div className="space-y-4">
          <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Your password has been reset successfully. You can now log in with your new password.
          </div>
          <Link to="/login" className={primaryButton}>
            Go to Log in
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          {!token && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              Missing reset token. Please use the link provided in your email.
            </div>
          )}

          <AuthField
            id="password"
            label="New Password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <AuthField
            id="confirmPassword"
            label="Confirm New Password"
            type="password"
            autoComplete="new-password"
            placeholder="Repeat password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <button type="submit" disabled={submitting || !token} className={primaryButton}>
            {submitting ? 'Resetting…' : 'Reset Password'}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
