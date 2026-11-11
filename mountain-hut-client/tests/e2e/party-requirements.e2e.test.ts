import { test, expect, type Page } from '@playwright/test'

// Serial mode so tests don't compete for time slot table capacity
test.describe.configure({ mode: 'serial' })

function toDateString(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

async function registerAndLoginHiker(page: Page) {
  const id = Date.now() + Math.floor(Math.random() * 1000)
  const email = `hiker.requirements.${id}@example.com`
  const password = 'Password123!'

  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      email,
      password,
      name: 'Allergy',
      surname: 'Tester',
      phone_number: `+39333${String(id).slice(-7)}`,
      type: 'HIKER',
    },
  })
  expect(res.status()).toBe(201)

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()

  await expect(page).toHaveURL(/\/booking/)
  await expect(page.getByRole('heading', { name: 'Book a table' })).toBeVisible()

  return { email, password }
}

async function pickDate(page: Page, offsetDays: number = 1) {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  if (d.getDate() === 1) {
    await page.getByRole('button', { name: /next month/i }).click()
  }
  await page.locator(`[data-day="${toDateString(d)}"] button`).click()
}

async function pickFirstAvailableSlot(page: Page) {
  const slotGroup = page.getByRole('group', { name: 'Time slot' })
  await expect(slotGroup).toBeVisible()
  const firstSlot = slotGroup.getByRole('button').first()
  await firstSlot.click()
}

test.describe('MH-05: Provide party requirements (MH-60 E2E tests)', () => {
  test('hiker books a table selecting both allergens and other requirements notes', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 1)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    // Select Milk and Peanuts checkboxes
    const milkCheckbox = page.getByRole('checkbox', { name: 'Milk', exact: true })
    const peanutsCheckbox = page.getByRole('checkbox', { name: 'Peanuts', exact: true })

    await expect(milkCheckbox).toBeVisible()
    await milkCheckbox.check()
    await peanutsCheckbox.check()

    await expect(milkCheckbox).toBeChecked()
    await expect(peanutsCheckbox).toBeChecked()

    // Fill notes and verify character counter updates
    const note = 'One person has severe peanut allergy, please wipe down table'
    const notesInput = page.getByLabel('Other requirements')
    await notesInput.fill(note)
    await expect(page.getByText(`${note.length}/1000`)).toBeVisible()

    // Submit booking
    await page.getByRole('button', { name: 'Book', exact: true }).click()

    // Verify confirmation view displays both allergens and notes
    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    await expect(page.getByText('2 people')).toBeVisible()

    const dl = page.locator('dl')
    await expect(dl.getByText('Allergens', { exact: true })).toBeVisible()
    await expect(dl).toContainText('Milk')
    await expect(dl).toContainText('Peanuts')

    await expect(dl.getByText('Notes', { exact: true })).toBeVisible()
    await expect(dl).toContainText(note)
  })

  test('hiker books a table with only dietary notes (no allergen checkboxes)', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 1)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    // Add notes only
    const note = 'Table near the fireplace and a high chair please'
    await page.getByLabel('Other requirements').fill(note)

    // Submit booking
    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    const dl = page.locator('dl')

    // Notes should be visible, Allergens should NOT be visible
    await expect(dl.getByText('Notes', { exact: true })).toBeVisible()
    await expect(dl).toContainText(note)
    await expect(dl.getByText('Allergens', { exact: true })).not.toBeVisible()
  })

  test('hiker books a table with only allergen checkboxes (no notes)', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 1)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    // Select Eggs and Wheat only
    const eggsCheckbox = page.getByRole('checkbox', { name: 'Eggs', exact: true })
    const wheatCheckbox = page.getByRole('checkbox', { name: 'Wheat', exact: true })

    await eggsCheckbox.check()
    await wheatCheckbox.check()

    await expect(eggsCheckbox).toBeChecked()
    await expect(wheatCheckbox).toBeChecked()

    // Submit booking
    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    const dl = page.locator('dl')

    // Allergens should be visible with Eggs and Wheat, Notes should NOT be visible
    await expect(dl.getByText('Allergens', { exact: true })).toBeVisible()
    await expect(dl).toContainText('Eggs')
    await expect(dl).toContainText('Wheat')
    await expect(dl.getByText('Notes', { exact: true })).not.toBeVisible()
  })

  test('hiker toggles allergen checkboxes on and off before booking', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 2)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    const fishCheckbox = page.getByRole('checkbox', { name: 'Fish', exact: true })
    const peanutsCheckbox = page.getByRole('checkbox', { name: 'Peanuts', exact: true })

    // Check both, then uncheck Peanuts
    await fishCheckbox.check()
    await peanutsCheckbox.check()
    await expect(peanutsCheckbox).toBeChecked()

    await peanutsCheckbox.uncheck()
    await expect(peanutsCheckbox).not.toBeChecked()
    await expect(fishCheckbox).toBeChecked()

    // Submit booking
    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    const dl = page.locator('dl')

    await expect(dl.getByText('Allergens', { exact: true })).toBeVisible()
    await expect(dl).toContainText('Fish')
    await expect(dl).not.toContainText('Peanuts')
  })

  test('hiker books standard meal without any requirements', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 2)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    // Submit booking directly without touching allergens or notes
    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    const dl = page.locator('dl')

    // Neither Allergens nor Notes row should be present
    await expect(dl.getByText('Allergens', { exact: true })).not.toBeVisible()
    await expect(dl.getByText('Notes', { exact: true })).not.toBeVisible()
  })

  test('persists allergens and description in backend database across sessions', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 2)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    await page.getByRole('checkbox', { name: 'Soybeans', exact: true }).check()
    const note = 'Wheelchair accessible table'
    await page.getByLabel('Other requirements').fill(note)

    await page.getByRole('button', { name: 'Book', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()

    // Verify through backend API that the persisted booking record contains the requirements
    const bookingsRes = await page.request.get('/api/bookings/mine')
    expect(bookingsRes.status()).toBe(200)
    const bookings = await bookingsRes.json()
    expect(bookings.length).toBeGreaterThan(0)
    const latest = bookings[0]
    expect(latest.description).toBe(note)
    expect(latest.allergens).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'Soybeans' })]),
    )
  })
})
