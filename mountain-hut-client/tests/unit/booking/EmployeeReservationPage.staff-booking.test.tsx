import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmployeeReservationPage from '../../../src/booking/pages/EmployeeReservationPage.tsx'
import { getAvailability } from '../../../src/booking/api/availability-api.ts'
import { createStaffBooking } from '../../../src/booking/api/bookings-api.ts'
import { createHiker, searchHikers } from '../../../src/booking/api/hikers-api.ts'
import { ApiError } from '../../../src/shared/api/client.ts'
import type { SlotAvailability } from '../../../src/booking/types/availability.ts'
import type { BookingResult } from '../../../src/booking/types/booking.ts'
import type { HikerMatch } from '../../../src/booking/types/hiker.ts'

// Only the calls to the backend are replaced: the page logic is the real one
vi.mock('../../../src/booking/api/availability-api.ts', () => ({ getAvailability: vi.fn() }))
vi.mock('../../../src/booking/api/bookings-api.ts', () => ({ createStaffBooking: vi.fn() }))
vi.mock('../../../src/booking/api/hikers-api.ts', () => ({
  searchHikers: vi.fn(),
  createHiker: vi.fn(),
}))

const TODAY = '2026-11-04'
const TOMORROW = '2026-11-05'

const mario: HikerMatch = {
  id: 7,
  name: 'Mario',
  surname: 'Rossi',
  email: 'mario.rossi@example.com',
  phoneNumber: '+393331234567',
}

const booking: BookingResult = {
  status: 'PLACED',
  userId: 7,
  slotId: 1,
  partySize: 2,
  reservations: [
    { reservationId: 11, tableId: 3, seats: 1 },
    { reservationId: 12, tableId: 4, seats: 1 },
  ],
}

function slot(overrides: Partial<SlotAvailability> = {}): SlotAvailability {
  return {
    slotId: 1,
    from: '19:00',
    to: '21:00',
    availableSeats: 6,
    available: true,
    tables: [
      { tableId: 3, code: 'T3', freeSeats: 4 },
      { tableId: 4, code: 'T4', freeSeats: 2 },
    ],
    allocation: null,
    ...overrides,
  }
}

function mockSlots(...slots: SlotAvailability[]) {
  vi.mocked(getAvailability).mockResolvedValue({ date: TODAY, partySize: 2, slots })
}

function renderPage() {
  render(<EmployeeReservationPage />)
  return userEvent.setup()
}

type User = ReturnType<typeof userEvent.setup>

const slotButton = (name: RegExp) => screen.findByRole('button', { name })
const dinner = () => slotButton(/19:00–21:00/)
const reserveButton = () => screen.getByRole('button', { name: 'Reserve' })
const searchField = () => screen.getByLabelText('Name, phone or email')

async function setPeople(user: User, value: string) {
  const people = screen.getByLabelText('People')
  await user.clear(people)
  if (value) await user.type(people, value)
}

async function pickMario(user: User) {
  await user.type(searchField(), 'rossi')
  await user.click(await screen.findByRole('button', { name: /Mario Rossi/ }))
}

async function fillAndReserve(user: User) {
  await user.click(await dinner())
  await pickMario(user)
  await user.click(reserveButton())
}

describe('EmployeeReservationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Only the clock is fixed: the timers of the search keep running
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
    vi.mocked(searchHikers).mockResolvedValue([mario])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('slots', () => {
    it('asks for the availability of the day and the party size', async () => {
      mockSlots(slot())
      const user = renderPage()
      await dinner()
      expect(getAvailability).toHaveBeenLastCalledWith(TODAY, 2)

      await setPeople(user, '4')

      expect(getAvailability).toHaveBeenLastCalledWith(TODAY, 4)
    })

    it('does not ask who the hiker is until a slot is chosen', async () => {
      mockSlots(slot())
      const user = renderPage()
      const button = await dinner()
      expect(screen.queryByText('Who')).not.toBeInTheDocument()

      await user.click(button)

      expect(screen.getByText('Who')).toBeInTheDocument()
      expect(button).toHaveAttribute('aria-pressed', 'true')
    })

    // Hikers cannot book it on the web (2 hours before), staff can
    it('offers a slot starting in ten minutes', async () => {
      mockSlots(slot({ from: '12:10', to: '13:00' }))
      renderPage()

      expect(await slotButton(/12:10–13:00/)).toBeEnabled()
    })

    // MH-07: staff cannot book after the beginning of the slot
    it.each([
      ['starting right now', '12:00', '13:00'],
      ['that has already started', '11:30', '12:30'],
      ['that has ended', '10:00', '11:00'],
    ])('does not offer a slot %s', async (_label, from, to) => {
      mockSlots(slot({ from, to }))
      renderPage()

      const button = await slotButton(new RegExp(`${from}–${to}`))
      expect(button).toBeDisabled()
      expect(button).toHaveTextContent('Started')
      expect(screen.getByText(/No room for 2 people/)).toBeInTheDocument()
    })

    it('does not offer a slot without enough seats, and suggests another day', async () => {
      mockSlots(slot({ availableSeats: 1, available: false }))
      renderPage()

      expect(await slotButton(/1 seat free/)).toBeDisabled()
      expect(screen.getByText(/No room for 2 people/)).toBeInTheDocument()
    })

    it('offers the other slots of the day when one is full', async () => {
      mockSlots(
        slot({ slotId: 1, from: '13:00', to: '14:00', availableSeats: 0, available: false }),
        slot({ slotId: 2 }),
      )
      renderPage()

      expect(await slotButton(/13:00–14:00/)).toBeDisabled()
      expect(await dinner()).toBeEnabled()
      expect(screen.queryByText(/No room/)).not.toBeInTheDocument()
    })

    it('says when the day has no slots', async () => {
      mockSlots()
      renderPage()

      expect(await screen.findByText('No slots on this day')).toBeInTheDocument()
    })

    it('shows when the availability cannot be loaded', async () => {
      vi.mocked(getAvailability).mockRejectedValue(new Error('Bad Gateway'))
      renderPage()

      expect(await screen.findByText('Error: Bad Gateway')).toBeInTheDocument()
    })

    it.each(['', '0', '-1', '2.5', '1001'])(
      'hides the slots with %j people',
      async (value) => {
        mockSlots(slot())
        const user = renderPage()
        await dinner()

        await setPeople(user, value)

        expect(screen.getByText(/Enter a number of people/)).toBeInTheDocument()
        expect(screen.queryByRole('button', { name: /19:00/ })).not.toBeInTheDocument()
      },
    )

    it('accepts the largest party the backend allows', async () => {
      mockSlots(slot())
      const user = renderPage()
      await dinner()

      await setPeople(user, '1000')

      expect(getAvailability).toHaveBeenLastCalledWith(TODAY, 1000)
    })

    it('forgets the slot when it no longer fits the party', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())
      expect(screen.getByText('Who')).toBeInTheDocument()

      mockSlots(slot({ available: false }))
      await setPeople(user, '9')

      expect(await dinner()).toBeDisabled()
      expect(screen.queryByText('Who')).not.toBeInTheDocument()
    })

    it('moves between days and shows the slots of the new day', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())
      const group = screen.getByRole('group', { name: 'Time slot' })
      expect(within(group).getByRole('button')).toHaveAttribute('aria-pressed', 'true')

      await user.click(screen.getByRole('button', { name: 'Next day' }))

      expect(getAvailability).toHaveBeenLastCalledWith(TOMORROW, 2)
      expect(await dinner()).toHaveAttribute('aria-pressed', 'false')
      expect(screen.queryByText('Who')).not.toBeInTheDocument()
    })
  })

  describe('hiker', () => {
    it('cannot reserve until a hiker is chosen', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())

      expect(reserveButton()).toBeDisabled()

      await pickMario(user)

      expect(reserveButton()).toBeEnabled()
    })

    it('shows the chosen hiker and allows changing it', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())
      await pickMario(user)

      expect(screen.getByText('Mario Rossi')).toBeInTheDocument()
      expect(screen.queryByLabelText('Name, phone or email')).not.toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'Change' }))

      expect(searchField()).toBeInTheDocument()
      expect(reserveButton()).toBeDisabled()
    })

    it('searches with what was typed', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())

      await user.type(searchField(), '  rossi ')

      await screen.findByRole('button', { name: /Mario Rossi/ })
      expect(searchHikers).toHaveBeenLastCalledWith('rossi')
    })

    it('does not search with less than two characters', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())

      await user.type(searchField(), 'r')
      await new Promise((resolve) => setTimeout(resolve, 400))

      expect(searchHikers).not.toHaveBeenCalled()
    })

    it('says when nobody is found', async () => {
      vi.mocked(searchHikers).mockResolvedValue([])
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())

      await user.type(searchField(), 'nobody')

      expect(await screen.findByText(/^No hiker found/)).toBeInTheDocument()
    })

    it('shows when the search fails', async () => {
      vi.mocked(searchHikers).mockRejectedValue(new Error('Search is down'))
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())

      await user.type(searchField(), 'rossi')

      expect(await screen.findByText('Error: Search is down')).toBeInTheDocument()
    })

    it('does not reserve for the chosen hiker while another option is open', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())
      await pickMario(user)

      await user.click(screen.getByRole('button', { name: 'Just a name' }))

      expect(reserveButton()).toBeDisabled()
    })
  })

  describe('reserving', () => {
    it('sends the hiker, the slot and the party, then shows the tables', async () => {
      mockSlots(slot())
      vi.mocked(createStaffBooking).mockResolvedValue(booking)
      const user = renderPage()

      await fillAndReserve(user)

      expect(createStaffBooking).toHaveBeenCalledWith({ hikerId: 7, slotId: 1, partySize: 2 })
      expect(await screen.findByText('✓ Reservation confirmed')).toBeInTheDocument()
      expect(screen.getByText('T3 · 1 seat, T4 · 1 seat')).toBeInTheDocument()
      expect(screen.getByText(/Mario Rossi · 2 people/)).toBeInTheDocument()
    })

    it('starts over with fresh seats after a confirmed reservation', async () => {
      mockSlots(slot())
      vi.mocked(createStaffBooking).mockResolvedValue(booking)
      const user = renderPage()
      await fillAndReserve(user)
      const button = await screen.findByRole('button', { name: 'New reservation' })
      const calls = vi.mocked(getAvailability).mock.calls.length

      await user.click(button)

      expect(await dinner()).toHaveAttribute('aria-pressed', 'false')
      expect(vi.mocked(getAvailability).mock.calls.length).toBe(calls + 1)
      expect(screen.queryByText('Who')).not.toBeInTheDocument()
    })

    it('shows the error of the backend, keeps the choices and reloads the seats', async () => {
      mockSlots(slot())
      vi.mocked(createStaffBooking).mockRejectedValue(
        new ApiError(409, 'Not enough available seats for this time slot'),
      )
      const user = renderPage()
      await user.click(await dinner())
      await pickMario(user)
      const calls = vi.mocked(getAvailability).mock.calls.length

      await user.click(reserveButton())

      expect(
        await screen.findByText('Not enough available seats for this time slot'),
      ).toBeInTheDocument()
      expect(vi.mocked(getAvailability).mock.calls.length).toBe(calls + 1)
      expect(await screen.findByText('Mario Rossi')).toBeInTheDocument()
      expect(screen.queryByText('✓ Reservation confirmed')).not.toBeInTheDocument()
    })

    it('tells staff that the hiker already has a booking in this slot', async () => {
      mockSlots(slot())
      vi.mocked(createStaffBooking).mockRejectedValue(
        new ApiError(409, 'You already have an active booking for this time slot'),
      )
      const user = renderPage()

      await fillAndReserve(user)

      expect(
        await screen.findByText('This hiker already has a booking for this time slot'),
      ).toBeInTheDocument()
      expect(screen.queryByText(/You already have/)).not.toBeInTheDocument()
    })

    it.each([
      ['another option', 'Just a name'],
      ['another hiker', 'Change'],
    ])('removes the error when choosing %s', async (_label, button) => {
      mockSlots(slot())
      vi.mocked(createStaffBooking).mockRejectedValue(new ApiError(409, 'Already booked'))
      const user = renderPage()
      await fillAndReserve(user)
      await screen.findByText('Already booked')

      await user.click(await screen.findByRole('button', { name: button }))

      expect(screen.queryByText('Already booked')).not.toBeInTheDocument()
    })

    it('keeps the error visible when the slot is no longer available', async () => {
      mockSlots(slot())
      vi.mocked(createStaffBooking).mockImplementation(async () => {
        mockSlots(slot({ availableSeats: 0, available: false }))
        throw new ApiError(409, 'Not enough available seats for this time slot')
      })
      const user = renderPage()

      await fillAndReserve(user)

      expect(await slotButton(/0 seats free/)).toBeDisabled()
      expect(
        screen.getByText('Not enough available seats for this time slot'),
      ).toBeInTheDocument()
      expect(screen.queryByText('Who')).not.toBeInTheDocument()
    })

    it('does not send twice while a reservation is in progress', async () => {
      mockSlots(slot())
      vi.mocked(createStaffBooking).mockReturnValue(new Promise(() => {}))
      const user = renderPage()

      await fillAndReserve(user)

      const sending = screen.getByRole('button', { name: 'Reserving…' })
      expect(sending).toBeDisabled()
      await user.click(sending)
      expect(createStaffBooking).toHaveBeenCalledTimes(1)
    })
  })

  // MH-07 clarifications: a hiker missing from the system can get a full
  // account (random password, to change at the first login) or just a name
  describe('new hiker', () => {
    const anna = {
      id: 20,
      name: 'Anna',
      surname: 'Bianchi',
      email: 'anna.bianchi@example.com',
      phoneNumber: '+393331112223',
    }
    const luigi = { id: 21, name: 'Luigi', surname: null, email: null, phoneNumber: null }

    async function fillAccount(user: User) {
      await user.click(await dinner())
      await user.click(screen.getByRole('button', { name: 'New account' }))
      await user.type(screen.getByLabelText('Name'), ' Anna ')
      await user.type(screen.getByLabelText('Surname'), 'Bianchi')
      await user.type(screen.getByLabelText('Email'), 'anna.bianchi@example.com')
      await user.type(screen.getByLabelText('Mobile number'), '+393331112223')
    }

    it('asks all the details of a new account before reserving', async () => {
      mockSlots(slot())
      const user = renderPage()
      await user.click(await dinner())
      await user.click(screen.getByRole('button', { name: 'New account' }))

      await user.type(screen.getByLabelText('Name'), 'Anna')
      await user.type(screen.getByLabelText('Surname'), 'Bianchi')
      await user.type(screen.getByLabelText('Email'), 'anna.bianchi@example.com')
      expect(reserveButton()).toBeDisabled()

      await user.type(screen.getByLabelText('Mobile number'), '   ')
      expect(reserveButton()).toBeDisabled()

      await user.type(screen.getByLabelText('Mobile number'), '+393331112223')
      expect(reserveButton()).toBeEnabled()
    })

    it('creates the account, reserves for it and shows the password to tell the hiker', async () => {
      mockSlots(slot())
      vi.mocked(createHiker).mockResolvedValue({ ...anna, temporaryPassword: 'k3Q9-xY7p' })
      vi.mocked(createStaffBooking).mockResolvedValue({ ...booking, userId: 20 })
      const user = renderPage()
      await fillAccount(user)

      await user.click(reserveButton())

      expect(createHiker).toHaveBeenCalledWith({
        type: 'TEMPORARY',
        name: 'Anna',
        surname: 'Bianchi',
        email: 'anna.bianchi@example.com',
        phoneNumber: '+393331112223',
      })
      expect(createStaffBooking).toHaveBeenCalledWith({ hikerId: 20, slotId: 1, partySize: 2 })
      expect(await screen.findByText('✓ Reservation confirmed')).toBeInTheDocument()
      expect(screen.getByText(/Anna Bianchi · 2 people/)).toBeInTheDocument()
      expect(screen.getByText('k3Q9-xY7p')).toBeInTheDocument()
      expect(screen.getByText(/change it at their first login/)).toBeInTheDocument()
      expect(screen.getByText(/sent to anna\.bianchi@example\.com/)).toBeInTheDocument()
    })

    it('needs only a name for a hiker without an account', async () => {
      mockSlots(slot())
      vi.mocked(createHiker).mockResolvedValue(luigi)
      vi.mocked(createStaffBooking).mockResolvedValue({ ...booking, userId: 21 })
      const user = renderPage()
      await user.click(await dinner())
      await user.click(screen.getByRole('button', { name: 'Just a name' }))
      expect(reserveButton()).toBeDisabled()

      await user.type(screen.getByLabelText('Name'), 'Luigi')
      await user.click(reserveButton())

      expect(createHiker).toHaveBeenCalledWith({ type: 'THROWAWAY', name: 'Luigi' })
      expect(createStaffBooking).toHaveBeenCalledWith({ hikerId: 21, slotId: 1, partySize: 2 })
      expect(await screen.findByText('✓ Reservation confirmed')).toBeInTheDocument()
      expect(screen.getByText(/Luigi\s+· 2 people/)).toBeInTheDocument()
      expect(screen.queryByText(/Temporary password/)).not.toBeInTheDocument()
    })

    it('sends the phone of a hiker without an account, when given', async () => {
      mockSlots(slot())
      vi.mocked(createHiker).mockResolvedValue({ ...luigi, phoneNumber: '+393339998887' })
      vi.mocked(createStaffBooking).mockResolvedValue(booking)
      const user = renderPage()
      await user.click(await dinner())
      await user.click(screen.getByRole('button', { name: 'Just a name' }))

      await user.type(screen.getByLabelText('Name'), 'Luigi')
      await user.type(screen.getByLabelText('Phone (optional)'), ' +393339998887 ')
      await user.click(reserveButton())

      expect(createHiker).toHaveBeenCalledWith({
        type: 'THROWAWAY',
        name: 'Luigi',
        phoneNumber: '+393339998887',
      })
    })

    it('does not create the hiker twice when the reservation fails and is tried again', async () => {
      mockSlots(slot())
      vi.mocked(createHiker).mockResolvedValue({ ...anna, temporaryPassword: 'k3Q9-xY7p' })
      vi.mocked(createStaffBooking)
        .mockRejectedValueOnce(new ApiError(409, 'Not enough available seats for this time slot'))
        .mockResolvedValueOnce({ ...booking, userId: 20 })
      const user = renderPage()
      await fillAccount(user)

      await user.click(reserveButton())

      expect(
        await screen.findByText('Not enough available seats for this time slot'),
      ).toBeInTheDocument()
      // The new hiker is now the chosen one, and the password is still shown
      expect(screen.getByText('Anna Bianchi')).toBeInTheDocument()
      expect(screen.getByText('k3Q9-xY7p')).toBeInTheDocument()

      await user.click(reserveButton())

      expect(await screen.findByText('✓ Reservation confirmed')).toBeInTheDocument()
      expect(createHiker).toHaveBeenCalledTimes(1)
      expect(createStaffBooking).toHaveBeenCalledTimes(2)
      expect(createStaffBooking).toHaveBeenLastCalledWith({ hikerId: 20, slotId: 1, partySize: 2 })
      expect(screen.getByText('k3Q9-xY7p')).toBeInTheDocument()
    })

    it.each([
      'An account with this email already exists',
      'An account with this phone number already exists',
    ])('says which detail is already used (%s), without reserving', async (backendMessage) => {
      mockSlots(slot())
      vi.mocked(createHiker).mockRejectedValue(new ApiError(409, backendMessage))
      const user = renderPage()
      await fillAccount(user)

      await user.click(reserveButton())

      expect(
        await screen.findByText(`${backendMessage}: find the hiker under Existing hiker.`),
      ).toBeInTheDocument()
      expect(createStaffBooking).not.toHaveBeenCalled()
      // The details stay, so they can be corrected
      expect(screen.getByLabelText('Email')).toHaveValue('anna.bianchi@example.com')
      expect(reserveButton()).toBeEnabled()
    })

    it('explains invalid details (400), without reserving', async () => {
      mockSlots(slot())
      vi.mocked(createHiker).mockRejectedValue(new ApiError(400, 'from the backend'))
      const user = renderPage()
      await fillAccount(user)

      await user.click(reserveButton())

      expect(
        await screen.findByText('Some details are not valid: check the email and the phone number.'),
      ).toBeInTheDocument()
      expect(createStaffBooking).not.toHaveBeenCalled()
    })
  })
})
