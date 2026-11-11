import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RequirementsFields from '../../../src/components/booking/RequirementsFields'

const allergens = [
  { id: 9, name: 'Milk' },
  { id: 10, name: 'Eggs' },
  { id: 14, name: 'Wheat' },
]

function renderFields(overrides: Partial<Parameters<typeof RequirementsFields>[0]> = {}) {
  const props = {
    allergens,
    loadError: false,
    selected: [] as number[],
    onToggle: vi.fn(),
    description: '',
    onDescriptionChange: vi.fn(),
    ...overrides,
  }
  render(<RequirementsFields {...props} />)
  return props
}

describe('RequirementsFields', () => {
  it('shows one checkbox per allergen, ticked according to selected', () => {
    renderFields({ selected: [14] })

    expect(screen.getByRole('checkbox', { name: 'Milk' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Eggs' })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Wheat' })).toBeChecked()
  })

  it('calls onToggle with the allergen id when a checkbox is clicked', async () => {
    const props = renderFields()

    await userEvent.click(screen.getByRole('checkbox', { name: 'Eggs' }))

    expect(props.onToggle).toHaveBeenCalledWith(10)
  })

  it('reports typing in the requirements box', async () => {
    const props = renderFields()

    await userEvent.type(screen.getByLabelText('Other requirements'), 'a')

    expect(props.onDescriptionChange).toHaveBeenCalledWith('a')
  })

  it('shows the character counter', () => {
    renderFields({ description: 'one vegetarian' })

    expect(screen.getByText('14/1000')).toBeInTheDocument()
  })

  it('shows loading placeholders while the list is loading', () => {
    renderFields({ allergens: null })

    expect(screen.getByLabelText('Loading allergens')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  it('still offers the text box when the list fails to load', () => {
    renderFields({ allergens: null, loadError: true })

    expect(screen.getByText(/couldn't be loaded/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Other requirements')).toBeInTheDocument()
  })
})