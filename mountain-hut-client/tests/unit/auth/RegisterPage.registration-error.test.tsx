import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import RegisterPage from '../../../src/auth/pages/RegisterPage.tsx'
import { AuthContext, type AuthContextValue } from '../../../src/auth/context/auth-context.ts'
import * as authApi from '../../../src/auth/api/auth-api.ts'
import { ApiError } from '../../../src/shared/api/client.ts'

vi.mock('../../../src/auth/api/auth-api.ts', () => ({
  register: vi.fn(),
}))

function renderRegisterPage() {
  const auth: AuthContextValue = {
    user: null,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('RegisterPage error messaging (MH-92)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('displays generic privacy-safe error message when email already exists (409 Conflict)', async () => {
    vi.mocked(authApi.register).mockRejectedValue(new ApiError(409, 'Conflict'))

    renderRegisterPage()

    fireEvent.change(screen.getByLabelText(/^Name/i), { target: { value: 'Mario' } })
    fireEvent.change(screen.getByLabelText(/^Surname/i), { target: { value: 'Rossi' } })
    fireEvent.change(screen.getByLabelText(/^Email/i), { target: { value: 'existing@example.com' } })
    fireEvent.change(screen.getByLabelText(/^Phone number/i), { target: { value: '+39 333 1234567' } })
    fireEvent.change(screen.getByLabelText(/^Password/i), { target: { value: 'password123' } })
    fireEvent.change(screen.getByLabelText(/^Confirm password/i), { target: { value: 'password123' } })

    fireEvent.click(screen.getByRole('button', { name: /create account/i }))

    await waitFor(() => {
      const alert = screen.getByRole('alert')
      expect(alert).toHaveTextContent(
        'An error occurred while trying to register your account, try with a different email',
      )
      expect(screen.queryByText(/An account with this email already exists/i)).not.toBeInTheDocument()
    })
  })
})
