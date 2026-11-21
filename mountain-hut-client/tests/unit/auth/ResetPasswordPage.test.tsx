import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ResetPasswordPage from '../../../src/auth/pages/ResetPasswordPage.tsx'
import * as authApi from '../../../src/auth/api/auth-api.ts'
import { ApiError } from '../../../src/shared/api/client.ts'

vi.mock('../../../src/auth/api/auth-api.ts', () => ({
  resetPassword: vi.fn(),
}))

function renderResetPasswordPage(initialEntries = ['/reset-password?token=valid-test-token']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <ResetPasswordPage />
    </MemoryRouter>,
  )
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('warns when token is missing', () => {
    renderResetPasswordPage(['/reset-password'])

    expect(screen.getByRole('alert')).toHaveTextContent(/Missing reset token/i)
    expect(screen.getByRole('button', { name: /reset password/i })).toBeDisabled()
  })

  it('validates password length and matching passwords', async () => {
    renderResetPasswordPage()

    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), { target: { value: 'short' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Password must be at least 8 characters long/i)
    })

    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), { target: { value: 'mismatch123' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Passwords do not match/i)
    })
  })

  it('submits successfully and shows success state', async () => {
    vi.mocked(authApi.resetPassword).mockResolvedValue({ message: 'Success' })

    renderResetPasswordPage()

    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'newpassword123' } })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), { target: { value: 'newpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(authApi.resetPassword).toHaveBeenCalledWith('valid-test-token', 'newpassword123')
      expect(screen.getByRole('status')).toHaveTextContent(/Your password has been reset successfully/i)
    })
  })

  it('handles invalid or expired token error (400)', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new ApiError(400, 'Invalid or expired reset token. Please request a new one.'),
    )

    renderResetPasswordPage()

    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'newpassword123' } })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), { target: { value: 'newpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Invalid or expired reset token/i)
    })
  })

  it('formats raw API error message cleanly without JSON wrappers', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new ApiError(400, 'API error 400: {"message":"For safety reasons, you cannot change the password to your old one."}'),
    )

    renderResetPasswordPage()

    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'sameoldpassword123' } })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), { target: { value: 'sameoldpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'For safety reasons, you cannot change the password to your old one.',
      )
      expect(screen.getByRole('alert')).not.toHaveTextContent('API error 400')
    })
  })

  it('handles old password rejection error from API (400)', async () => {
    vi.mocked(authApi.resetPassword).mockRejectedValue(
      new ApiError(400, 'For safety reasons, you cannot change the password to your old one.'),
    )

    renderResetPasswordPage()

    fireEvent.change(screen.getByLabelText(/^New Password/i), { target: { value: 'sameoldpassword123' } })
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/i), { target: { value: 'sameoldpassword123' } })
    fireEvent.click(screen.getByRole('button', { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(
        'For safety reasons, you cannot change the password to your old one.',
      )
    })
  })
})
