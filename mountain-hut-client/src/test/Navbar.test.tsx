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

  it('renders all navigation links including Home and Manage slots', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Book a table')).toBeInTheDocument()
    expect(screen.getByText('My bookings')).toBeInTheDocument()
    expect(screen.getByText('Manage slots')).toBeInTheDocument()
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('highlights Home when on home route and inactive when on another page', () => {
    const { unmount } = render(
      <MemoryRouter initialEntries={['/']}>
        <Navbar />
      </MemoryRouter>
    )
    const homeLink = screen.getByText('Home')
    expect(homeLink.className).toContain('text-green-700')
    expect(homeLink.className).toContain('font-semibold')

    const bookingLink = screen.getByText('Book a table')
    expect(bookingLink.className).not.toContain('font-semibold')

    unmount()

    // Test on another page
    render(
      <MemoryRouter initialEntries={['/booking']}>
        <Navbar />
      </MemoryRouter>
    )
    const homeLinkOnBooking = screen.getByText('Home')
    expect(homeLinkOnBooking.className).not.toContain('font-semibold')

    const bookingLinkActive = screen.getByText('Book a table')
    expect(bookingLinkActive.className).toContain('text-green-700')
    expect(bookingLinkActive.className).toContain('font-semibold')
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

    const homeLinks = screen.getAllByText('Home')
    expect(homeLinks.length).toBeGreaterThanOrEqual(2)

    fireEvent.click(toggleButton)
    expect(toggleButton).toHaveAttribute('aria-expanded', 'false')
  })
})
