import { useState } from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RequirementsFields from '../../../src/booking/components/RequirementsFields'

function renderFields(overrides: Partial<Parameters<typeof RequirementsFields>[0]> = {}) {
  const props = {
    enabled: false,
    onToggle: vi.fn(),
    description: '',
    onDescriptionChange: vi.fn(),
    ...overrides,
  }
  render(<RequirementsFields {...props} />)
  return props
}

function StatefulRequirementsFields() {
  const [enabled, setEnabled] = useState(false)
  const [description, setDescription] = useState('')
  return (
    <RequirementsFields
      enabled={enabled}
      onToggle={setEnabled}
      description={description}
      onDescriptionChange={setDescription}
    />
  )
}

describe('RequirementsFields', () => {
  it('renders a single unchecked checkbox and hides the textbox by default', () => {
    renderFields()

    const checkboxes = screen.getAllByRole('checkbox')
    expect(checkboxes).toHaveLength(1)
    expect(checkboxes[0]).not.toBeChecked()
    expect(
      screen.queryByLabelText(/specify allergies, intolerances or notes/i),
    ).not.toBeInTheDocument()
  })

  it('calls onToggle with the new checked state when clicked', async () => {
    const props = renderFields({ enabled: false })
    await userEvent.click(screen.getByRole('checkbox'))
    expect(props.onToggle).toHaveBeenCalledWith(true)

    const propsChecked = renderFields({ enabled: true })
    await userEvent.click(screen.getAllByRole('checkbox')[1])
    expect(propsChecked.onToggle).toHaveBeenCalledWith(false)
  })

  it('shows the textbox and character counter when enabled', () => {
    renderFields({ enabled: true, description: 'one vegetarian' })

    expect(
      screen.getByLabelText(/specify allergies, intolerances or notes/i),
    ).toHaveValue('one vegetarian')
    expect(screen.getByText('14/1000')).toBeInTheDocument()
  })

  it('reports typing in the requirements box', async () => {
    const props = renderFields({ enabled: true })

    await userEvent.type(
      screen.getByLabelText(/specify allergies, intolerances or notes/i),
      'a',
    )

    expect(props.onDescriptionChange).toHaveBeenCalledWith('a')
  })

  it('hides the textbox when unchecked while preserving the typed text', async () => {
    render(<StatefulRequirementsFields />)

    const checkbox = screen.getByRole('checkbox')
    await userEvent.click(checkbox)

    const textbox = screen.getByLabelText(/specify allergies, intolerances or notes/i)
    await userEvent.type(textbox, 'Peanut allergy')
    expect(textbox).toHaveValue('Peanut allergy')

    await userEvent.click(checkbox)
    expect(
      screen.queryByLabelText(/specify allergies, intolerances or notes/i),
    ).not.toBeInTheDocument()

    await userEvent.click(checkbox)
    expect(
      screen.getByLabelText(/specify allergies, intolerances or notes/i),
    ).toHaveValue('Peanut allergy')
  })
})
