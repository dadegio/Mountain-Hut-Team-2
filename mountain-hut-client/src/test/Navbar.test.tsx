import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { describe, it, expect } from 'vitest'
import Navbar from '../components/Navbar'

describe('Navbar', () => {
  it('renders the brand name', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getByText('Mountain Hut')).toBeInTheDocument()
  })

  it('renders all navigation links', () => {
    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>
    )
    expect(screen.getByText('Book a table')).toBeInTheDocument()
    expect(screen.getByText('My bookings')).toBeInTheDocument()
    expect(screen.getByText('Login')).toBeInTheDocument()
  })
})
