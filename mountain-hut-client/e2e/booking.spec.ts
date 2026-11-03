import { test, expect } from '@playwright/test'

// "YYYY-MM-DD" in local time
function toDateString(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

test('hiker logs in and books a table', async ({ page }) => {
  // fresh hiker for every run, so the test never hits "already booked"
  const id = Date.now()
  const email = `e2e.hiker.${id}@example.com`
  const password = 'Password123!'

  const res = await page.request.post('/api/v1/auth/register', {
    data: {
      email,
      password,
      name: 'E2E',
      surname: 'Hiker',
      phone_number: `+39333${String(id).slice(-7)}`,
      type: 'HIKER',
    },
  })
  expect(res.status()).toBe(201)

  // log in through the UI
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()

  // hikers land on the booking page
  await expect(page).toHaveURL(/\/booking/)
  await expect(page.getByRole('heading', { name: 'Book a table' })).toBeVisible()

  // pick tomorrow (the seed always creates slots for tomorrow)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (tomorrow.getDate() === 1) {
    await page.getByRole('button', { name: /next month/i }).click()
  }
  await page.locator(`[data-day="${toDateString(tomorrow)}"] button`).click()

  await page.getByLabel('Party size').fill('2')

  // slot buttons come from the availability API
  await page.getByRole('button', { name: /19:00/ }).click()
  await page.getByRole('button', { name: 'Book', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Booking confirmed' })).toBeVisible()
  await expect(page.getByText('2 people')).toBeVisible()
})