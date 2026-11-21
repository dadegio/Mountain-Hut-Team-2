import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import ForgotPasswordPage from '../../../src/auth/pages/ForgotPasswordPage.tsx'
import * as authApi from '../../../src/auth/api/auth-api.ts'
import { ApiError } from '../../../src/shared/api/client.ts'

vi.mock('../../../src/auth/api/auth-api.ts', () => ({
  forgotPassword: vi.fn(),
}))

function renderForgotPasswordPage() {
  return render(
    <MemoryRouter>
      <ForgotPasswordPage />
    </MemoryRouter>,
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows error if email is not provided', async () => {
    renderForgotPasswordPage()

    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Please enter your email.')
    })
  })

  it('submits successfully and shows confirmation message', async () => {
    vi.mocked(authApi.forgotPassword).mockResolvedValue({ message: 'Success' })

    renderForgotPasswordPage()

    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(authApi.forgotPassword).toHaveBeenCalledWith('user@example.com')
      expect(screen.getByRole('status')).toHaveTextContent(/If an account with that email exists/i)
    })
  })

  it('shows error if API request fails', async () => {
    vi.mocked(authApi.forgotPassword).mockRejectedValue(new ApiError(500, 'Server error'))

    renderForgotPasswordPage()

    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'user@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: /send reset link/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.')
    })
  })
})
