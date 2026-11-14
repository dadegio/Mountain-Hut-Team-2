import { test, expect, type Page } from '@playwright/test'

// "YYYY-MM-DD" in local time
function toDateString(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function getTomorrowDate(): Date {
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  return tomorrow
}

/** Registers a new hiker via API and logs in through the UI */
async function registerAndLoginHiker(page: Page, testName: string) {
  const id = Date.now() + Math.floor(Math.random() * 1000)
  const email = `e2e.${testName}.${id}@example.com`
  const password = 'Password123!'

  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      email,
      password,
      name: 'E2E',
      surname: 'Tester',
      phoneNumber: `+39333${String(id).slice(-7)}`,
      type: 'HIKER',
    },
  })
  expect(res.status()).toBe(201)

  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/booking/)
}

/** Books a table for tomorrow through the booking page */
async function bookTable(page: Page, slotRegex: RegExp, partySize: number) {
  const tomorrow = getTomorrowDate()
  if (tomorrow.getDate() === 1) {
    await page.getByRole('button', { name: /next month/i }).click()
  }
  await page.locator(`[data-day="${toDateString(tomorrow)}"] button`).click()

  await page.getByRole('spinbutton', { name: 'Party size' }).fill(String(partySize))
  await page.getByRole('button', { name: slotRegex }).click()
  await page.getByRole('button', { name: 'Book', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
}

test.describe('MH-06: Change a booking E2E tests', () => {
  test.describe.configure({ mode: 'serial' })

  test('hiker changes party size on an existing booking', async ({ page }) => {
    await registerAndLoginHiker(page, 'change-party')
    await bookTable(page, /12:00/, 2)

    // Navigate to My bookings
    await page.getByRole('navigation').getByRole('link', { name: 'My bookings' }).click()
    await expect(page).toHaveURL(/\/my-bookings/)
    await expect(page.getByRole('heading', { name: 'My bookings' })).toBeVisible()

    // Verify initial booking details
    await expect(page.getByText('12:00–13:00 · 2 people')).toBeVisible()
    await expect(page.getByText(/You can change this booking until/)).toBeVisible()

    // Open change panel
    await page.getByRole('button', { name: 'Change' }).click()

    // Change party size to 4
    const partyInput = page.getByRole('spinbutton', { name: 'Party size' })
    await partyInput.fill('4')

    // Save changes
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Assert success notice and updated party size
    await expect(page.getByRole('status')).toHaveText('Your booking has been updated.')
    await expect(page.getByText('12:00–13:00 · 4 people')).toBeVisible()
  })

  test('hiker changes time slot on an existing booking', async ({ page }) => {
    await registerAndLoginHiker(page, 'change-slot')
    await bookTable(page, /12:00/, 2)

    // Navigate to My bookings
    await page.getByRole('navigation').getByRole('link', { name: 'My bookings' }).click()
    await expect(page).toHaveURL(/\/my-bookings/)
    await expect(page.getByText('12:00–13:00 · 2 people')).toBeVisible()

    // Open change panel
    await page.getByRole('button', { name: 'Change' }).click()

    // Select the 13:00–14:00 slot
    const slotGroup = page.getByRole('group', { name: 'Time slot' })
    await slotGroup.getByRole('button', { name: /^13:00/ }).click()

    // Save changes
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Assert success notice and updated slot time
    await expect(page.getByRole('status')).toHaveText('Your booking has been updated.')
    await expect(page.getByText('13:00–14:00 · 2 people')).toBeVisible()
  })

  test('hiker cancels editing without applying changes', async ({ page }) => {
    await registerAndLoginHiker(page, 'cancel-edit')
    await bookTable(page, /12:00/, 2)

    await page.goto('/my-bookings')
    await expect(page.getByText('12:00–13:00 · 2 people')).toBeVisible()

    // Open change panel
    await page.getByRole('button', { name: 'Change' }).click()
    await expect(page.getByRole('button', { name: 'Save changes' })).toBeVisible()

    // Cancel edit
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Panel closes, "Change" button reappears, booking remains 2 people
    await expect(page.getByRole('button', { name: 'Change' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Save changes' })).not.toBeVisible()
    await expect(page.getByText('12:00–13:00 · 2 people')).toBeVisible()
  })

  test('shows validation error when attempting to save with no changes', async ({ page }) => {
    await registerAndLoginHiker(page, 'no-changes')
    await bookTable(page, /12:00/, 2)

    await page.goto('/my-bookings')

    // Open change panel and immediately click Save without changing anything
    await page.getByRole('button', { name: 'Change' }).click()
    await page.getByRole('button', { name: 'Save changes' }).click()

    // Verify validation alert
    await expect(page.getByRole('alert')).toHaveText("You haven't changed anything yet.")
  })

  test('hiker adds and updates allergy/intolerance notes on an existing booking', async ({ page }) => {
    await registerAndLoginHiker(page, 'change-notes')
    await bookTable(page, /12:00/, 2)

    await page.getByRole('navigation').getByRole('link', { name: 'My bookings' }).click()
    await expect(page).toHaveURL(/\/my-bookings/)

    await page.getByRole('button', { name: 'Change' }).click()
    const checkbox = page.getByRole('checkbox', {
      name: /allergies, intolerances,? or special requests/i,
    })
    await expect(checkbox).not.toBeChecked()

    await checkbox.check()
    const textbox = page.getByLabel(/specify allergies, intolerances or notes/i)
    await textbox.fill('Gluten intolerance')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByRole('status')).toHaveText('Your booking has been updated.')
    await expect(page.getByText('Notes: Gluten intolerance')).toBeVisible()

    // Re-open Change and verify the saved note is prefilled and editable
    await page.getByRole('button', { name: 'Change' }).click()
    await expect(checkbox).toBeChecked()
    await expect(textbox).toHaveValue('Gluten intolerance')
    await textbox.fill('Gluten and lactose intolerance')
    await page.getByRole('button', { name: 'Save changes' }).click()

    await expect(page.getByRole('status')).toHaveText('Your booking has been updated.')
    await expect(page.getByText('Notes: Gluten and lactose intolerance')).toBeVisible()
  })
})
