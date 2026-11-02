import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import Navbar from '../components/Navbar'

describe('Navbar', () => {
  it('renders the brand name linking to home', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    )
    const brand = screen.getByText('Mountain Hut')
    expect(brand).toBeInTheDocument()
    expect(brand.closest('a')).toHaveAttribute('href', '/')
  })

  it('renders all navigation links including Manage slots', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getByText('Book a table')).toBeInTheDocument()
    expect(screen.getByText('My bookings')).toBeInTheDocument()
    expect(screen.getByText('Manage slots')).toBeInTheDocument()
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('highlights the active link based on current route', () => {
    render(
      <MemoryRouter initialEntries={['/booking']}>
        <Navbar />
      </MemoryRouter>
    )
    const bookingLink = screen.getByText('Book a table')
    expect(bookingLink.className).toContain('text-green-700')
    expect(bookingLink.className).toContain('font-semibold')

    const myBookingsLink = screen.getByText('My bookings')
    expect(myBookingsLink.className).not.toContain('font-semibold')
  })

  it('toggles mobile menu when clicking the menu button', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    )
    const toggleButton = screen.getByLabelText('Toggle navigation menu')
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'true')

    const bookingLinks = screen.getAllByText('Book a table')
    expect(bookingLinks.length).toBeGreaterThanOrEqual(2)

    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
  })
})
