import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import BookingPage from '../../../src/booking/pages/BookingPage.tsx'
import { AuthContext, type AuthContextValue } from '../../../src/auth/context/auth-context.ts'
import * as availabilityApi from '../../../src/booking/api/availability-api.ts'
import { PENDING_BOOKING_KEY, loadBookingDraft } from '../../../src/booking/storage/booking-draft.ts'
import type { User } from '../../../src/auth/types/auth.ts'

vi.mock('../../../src/booking/api/availability-api.ts', () => ({
  getAvailability: vi.fn(),
}))

function futureDateString(daysAhead: number = 3): string {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function pastDateString(daysAgo: number = 2): string {
  const d = new Date()
  d.setDate(d.getDate() - daysAgo)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function renderBookingPage(user: User | null = null) {
  const auth: AuthContextValue = {
    user,
    loading: false,
    login: vi.fn(),
    logout: vi.fn(),
  }
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter>
        <BookingPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('BookingPage draft restoration & persistence (MH-96)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(availabilityApi.getAvailability).mockResolvedValue({
      date: futureDateString(3),
      partySize: 4,
      slots: [
        {
          slotId: 7,
          from: '12:00',
          to: '14:00',
          availableSeats: 12,
          available: true,
          tables: [],
          allocation: [],
        },
      ],
    })
  })

  it('restores draft parameters from localStorage on mount and requests availability', async () => {
    const future = futureDateString(5)
    localStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify({
        date: future,
        partySize: 4,
        slotId: '7',
        hasRequirements: true,
        description: 'Vegan and peanut allergy',
      }),
    )

    renderBookingPage(null)

    // Party size restored
    const partyInput = screen.getByLabelText(/^Party size/i)
    expect(partyInput).toHaveValue(4)

    // Requirements restored
    const notesInput = screen.getByPlaceholderText(/peanut allergy/i)
    expect(notesInput).toHaveValue('Vegan and peanut allergy')

    // Availability triggered for restored date and party size
    await waitFor(() => {
      expect(availabilityApi.getAvailability).toHaveBeenCalledWith(future, 4)
    })
  })

  it('clears expired drafts with dates in the past', () => {
    const past = pastDateString(3)
    localStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify({
        date: past,
        partySize: 5,
        slotId: '3',
      }),
    )

    renderBookingPage(null)

    // Reset to defaults
    const partyInput = screen.getByLabelText(/^Party size/i)
    expect(partyInput).toHaveValue(2)
    expect(localStorage.getItem(PENDING_BOOKING_KEY)).toBeNull()
  })

  it('updates the stored draft when party size changes', async () => {
    const future = futureDateString(2)
    localStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify({
        date: future,
        partySize: 2,
      }),
    )

    renderBookingPage(null)
    const partyInput = screen.getByLabelText(/^Party size/i)
    expect(partyInput).toHaveValue(2)

    fireEvent.click(screen.getByRole('button', { name: /increase party size/i }))

    await waitFor(() => {
      const draft = loadBookingDraft()
      expect(draft?.partySize).toBe(3)
    })
  })

  describe('BookingPage party size limit (MH-183)', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    vi.mocked(availabilityApi.getAvailability).mockResolvedValue({
      date: futureDateString(3),
      partySize: 2,
      slots: [],
    })
    // A date is chosen, so the page would normally load the slots
    localStorage.setItem(
      PENDING_BOOKING_KEY,
      JSON.stringify({ date: futureDateString(3), partySize: 2 }),
    )
  })

  it('shows an error as soon as the party size is above the limit', async () => {
    renderBookingPage(null)
    const partyInput = screen.getByLabelText(/^Party size/i)

    fireEvent.change(partyInput, { target: { value: '25' } })

    expect(screen.getByText(/Party size can be at most 20/)).toBeInTheDocument()
    expect(partyInput).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText(/No available slots/)).not.toBeInTheDocument()
    await waitFor(() => {
      expect(availabilityApi.getAvailability).not.toHaveBeenCalledWith(expect.anything(), 25)
    })
  })

  it('asks for at least one person when the field is emptied', () => {
    renderBookingPage(null)
    const partyInput = screen.getByLabelText(/^Party size/i)

    fireEvent.change(partyInput, { target: { value: '' } })

    expect(screen.getByText('Enter a party size of at least 1.')).toBeInTheDocument()
  })

  it('removes the error when the party size is valid again', () => {
    renderBookingPage(null)
    const partyInput = screen.getByLabelText(/^Party size/i)

    fireEvent.change(partyInput, { target: { value: '25' } })
    fireEvent.change(partyInput, { target: { value: '4' } })

    expect(screen.queryByText(/Party size can be at most/)).not.toBeInTheDocument()
    expect(partyInput).toHaveAttribute('aria-invalid', 'false')
  })
})
})
