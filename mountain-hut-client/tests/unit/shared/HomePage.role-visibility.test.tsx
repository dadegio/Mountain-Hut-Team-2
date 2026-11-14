import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import HomePage from '../../../src/shared/pages/HomePage'
import { AuthContext, type AuthContextValue } from '../../../src/auth/context/auth-context.ts'
import type { User } from '../../../src/auth/types/auth.ts'

function renderHomeAs(user: User | null) {
  const auth: AuthContextValue = {
    user,
    loading: false,
    login: async () => {
      throw new Error('not used')
    },
    logout: async () => {},
  }
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const fakeUser = (type: User['type']): User => ({
  id: 1,
  email: 'test@example.com',
  name: 'Test',
  surname: 'User',
  phoneNumber: '+390000000000',
  type,
})

describe('HomePage role-based views', () => {
  it('shows availability CTA and tagline for guests', () => {
    renderHomeAs(null)

    expect(
      screen.getByRole('link', { name: 'Check Availability' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /Book Your Table/i }),
    ).not.toBeInTheDocument()
    const tagline = screen.getByText(/Easier than that it's impossible/i)
    expect(tagline).toBeInTheDocument()
    expect(tagline.className).toContain('italic')
    expect(screen.getByText('😉').className).toContain('not-italic')
  })

  it('shows booking CTA and tagline for hikers', () => {
    renderHomeAs(fakeUser('HIKER'))

    expect(
      screen.getByRole('link', { name: 'Check Availability & Book Your Table' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Easier than that it's impossible/i)).toBeInTheDocument()
  })

  it.each(['EMPLOYEE', 'MANAGER'] as const)(
    'hides booking CTA and tagline for %s',
    (role) => {
      renderHomeAs(fakeUser(role))

      expect(
        screen.queryByRole('link', { name: /Check Availability/i }),
      ).not.toBeInTheDocument()
      expect(screen.queryByText(/Easier than that it's impossible/i)).not.toBeInTheDocument()
    },
  )
})
