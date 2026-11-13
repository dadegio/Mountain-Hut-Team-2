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

const requirementsCheckbox = (page: Page) =>
  page.getByRole('checkbox', { name: /allergies, intolerances,? or special requests/i })

const requirementsTextbox = (page: Page) =>
  page.getByLabel(/specify allergies, intolerances or notes/i)

test.describe('MH-05: Provide party requirements (E2E tests)', () => {
  test('hiker opens the textbox via the checkbox and books with allergies and notes', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 1)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    await expect(requirementsTextbox(page)).not.toBeVisible()
    await requirementsCheckbox(page).check()
    await expect(requirementsTextbox(page)).toBeVisible()

    const note = 'Severe peanut and milk allergy, plus one high chair please'
    await requirementsTextbox(page).fill(note)
    await expect(page.getByText(`${note.length}/1000`)).toBeVisible()

    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    await expect(page.getByText('2 people')).toBeVisible()

    const dl = page.locator('dl')
    await expect(dl.getByText('Notes', { exact: true })).toBeVisible()
    await expect(dl).toContainText(note)
    await expect(dl.getByText('Allergens', { exact: true })).not.toBeVisible()
  })

  test('hiker can hide and re-open the textbox without losing written notes', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 1)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    const note = 'Lactose intolerance, table near the fireplace'
    await requirementsCheckbox(page).check()
    await requirementsTextbox(page).fill(note)

    await requirementsCheckbox(page).uncheck()
    await expect(requirementsTextbox(page)).not.toBeVisible()

    await requirementsCheckbox(page).check()
    await expect(requirementsTextbox(page)).toHaveValue(note)

    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    const dl = page.locator('dl')
    await expect(dl.getByText('Notes', { exact: true })).toBeVisible()
    await expect(dl).toContainText(note)
  })

  test('unchecking the checkbox before booking omits hidden draft notes', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 2)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    await requirementsCheckbox(page).check()
    await requirementsTextbox(page).fill('Temporary draft note')
    await requirementsCheckbox(page).uncheck()
    await expect(requirementsTextbox(page)).not.toBeVisible()

    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    const dl = page.locator('dl')
    await expect(dl.getByText('Notes', { exact: true })).not.toBeVisible()
    await expect(dl.getByText('Allergens', { exact: true })).not.toBeVisible()
  })

  test('hiker books standard meal without opening requirements', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 2)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    await expect(requirementsCheckbox(page)).not.toBeChecked()
    await page.getByRole('button', { name: 'Book', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
    const dl = page.locator('dl')

    await expect(dl.getByText('Allergens', { exact: true })).not.toBeVisible()
    await expect(dl.getByText('Notes', { exact: true })).not.toBeVisible()
  })

  test('persists requirements description in backend database across sessions', async ({ page }) => {
    await registerAndLoginHiker(page)
    await pickDate(page, 2)

    await page.getByRole('spinbutton', { name: 'Party size' }).fill('2')
    await pickFirstAvailableSlot(page)

    await requirementsCheckbox(page).check()
    const note = 'Soy allergy and wheelchair accessible table'
    await requirementsTextbox(page).fill(note)

    await page.getByRole('button', { name: 'Book', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()

    const bookingsRes = await page.request.get('/api/v1/bookings/mine')
    expect(bookingsRes.status()).toBe(200)
    const bookings = await bookingsRes.json()
    expect(bookings.length).toBeGreaterThan(0)
    const latest = bookings[0]
    expect(latest.description).toBe(note)
  })
})
