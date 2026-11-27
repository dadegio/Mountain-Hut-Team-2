import { randomUUID } from 'node:crypto'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

// From the backend seed, see the server README
const EMPLOYEE = { email: 'test.employee@example.com', password: 'Password123!' }
const PASSWORD = 'Password123!'

const unique = (name: string) => `${name} ${randomUUID().slice(0, 8)}`

function dayFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

async function newHiker(request: APIRequestContext) {
  const email = `e2e.hiker.${randomUUID()}@example.com`
  const res = await request.post('/api/v1/auth/register', {
    data: { email, password: PASSWORD, name: 'E2E', surname: 'Hiker', phoneNumber: '+393330000000' },
  })
  expect(res.status()).toBe(201)
  return email
}

async function logIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

async function registerHikeViaApi(
  request: APIRequestContext,
  data: {
    destination: string
    routeDescription: string
    departureAt: string
    expectedReturnAt: string
  },
) {
  const res = await request.post('/api/v1/hikes', { data })
  expect(res.status()).toBe(201)
  return res.json() as Promise<{ id: number; destination: string }>
}

async function myHikes(page: Page) {
  const res = await page.request.get('/api/v1/hikes/mine')
  expect(res.status()).toBe(200)
  return res.json() as Promise<
    Array<{
      id: number
      destination: string
      completedAt: string | null
      outcome: 'COMPLETED' | 'CANCELLED' | null
    }>
  >
}

test.describe('confirm safe arrival (MH-22)', () => {
  test('hiker confirms safe arrival and completed hike is removed from active hikes', async ({ page }) => {
    const email = await newHiker(page.request)
    await logIn(page, email, PASSWORD)

    const destination = unique('Rifugio Elena')
    const now = Date.now()
    const created = await registerHikeViaApi(page.request, {
      destination,
      routeDescription: 'Trail 25 to the hut',
      departureAt: new Date(now + 1000).toISOString(),
      expectedReturnAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
    })

    // Wait until the departure instant passes so the hike is active ("In progress")
    await page.waitForTimeout(1200)

    await page.goto('/my-hikes')
    await expect(page).toHaveURL(/\/my-hikes/)

    const inProgressTab = page.getByRole('tab', { name: /In progress/i })
    await expect(inProgressTab).toHaveAttribute('aria-selected', 'true')
    await expect(inProgressTab).toContainText('1')

    const inProgressPanel = page.getByRole('tabpanel', { name: 'Hikes in progress' })
    await expect(inProgressPanel.getByText(destination)).toBeVisible()

    // Confirm safe arrival
    await inProgressPanel.getByRole('button', { name: 'Hike completed' }).click()

    // Feedback banner is displayed
    await expect(page.getByRole('status')).toContainText(`Safe arrival confirmed for "${destination}".`)

    // Completed hike is no longer displayed among active hikes
    await expect(inProgressTab).toContainText('0')
    await expect(inProgressPanel.getByText(destination)).toHaveCount(0)
    await expect(inProgressPanel.getByText('No hikes in progress.')).toBeVisible()

    // Switch to Past tab and verify the completed hike is shown there without the action button
    const pastTab = page.getByRole('tab', { name: /Past/i })
    await expect(pastTab).toContainText('1')
    await pastTab.click()

    const pastPanel = page.getByRole('tabpanel', { name: 'Past hikes' })
    await expect(pastPanel.getByText(destination)).toBeVisible()
    await expect(pastPanel.getByText(/^Safe arrival confirmed/)).toBeVisible()
    await expect(pastPanel.getByRole('button', { name: 'Hike completed' })).toHaveCount(0)

    // Persisted in backend and remains in Past after a full page reload
    const persisted = (await myHikes(page)).find((h) => h.id === created.id)
    expect(persisted?.completedAt).not.toBeNull()
    expect(persisted?.outcome).toBe('COMPLETED')

    await page.reload()
    await expect(page.getByRole('tab', { name: /In progress/i })).toContainText('0')
    await expect(page.getByRole('tab', { name: /Past/i })).toContainText('1')
    await expect(page.getByRole('tabpanel', { name: 'Past hikes' }).getByText(destination)).toBeVisible()
  })

  test('overdue hike remains active until safe arrival is confirmed', async ({ page }) => {
    const email = await newHiker(page.request)
    await logIn(page, email, PASSWORD)

    const destination = unique('Overdue Peak')
    const now = Date.now()
    await registerHikeViaApi(page.request, {
      destination,
      routeDescription: 'High ridge traverse',
      departureAt: new Date(now + 700).toISOString(),
      expectedReturnAt: new Date(now + 1300).toISOString(),
    })

    // Wait past expectedReturnAt without confirming arrival
    await page.waitForTimeout(1500)

    await page.goto('/my-hikes')

    // Must still be in "In progress", not moved to "Past"
    const inProgressTab = page.getByRole('tab', { name: /In progress/i })
    await expect(inProgressTab).toContainText('1')
    await expect(page.getByRole('tab', { name: /Past/i })).toContainText('0')

    const inProgressPanel = page.getByRole('tabpanel', { name: 'Hikes in progress' })
    await expect(inProgressPanel.getByText(destination)).toBeVisible()

    await inProgressPanel.getByRole('button', { name: 'Hike completed' }).click()

    await expect(page.getByRole('status')).toContainText(`Safe arrival confirmed for "${destination}".`)
    await expect(inProgressTab).toContainText('0')
    await expect(page.getByRole('tab', { name: /Past/i })).toContainText('1')
  })

  test('completing one active hike leaves other active hikes in In progress', async ({ page }) => {
    const email = await newHiker(page.request)
    await logIn(page, email, PASSWORD)

    const firstDest = unique('First Hut')
    const secondDest = unique('Second Hut')
    const now = Date.now()

    await registerHikeViaApi(page.request, {
      destination: firstDest,
      routeDescription: 'First route',
      departureAt: new Date(now + 800).toISOString(),
      expectedReturnAt: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    })
    await registerHikeViaApi(page.request, {
      destination: secondDest,
      routeDescription: 'Second route',
      departureAt: new Date(now + 900).toISOString(),
      expectedReturnAt: new Date(now + 4 * 60 * 60 * 1000).toISOString(),
    })

    await page.waitForTimeout(1100)
    await page.goto('/my-hikes')

    const inProgressPanel = page.getByRole('tabpanel', { name: 'Hikes in progress' })
    await expect(page.getByRole('tab', { name: /In progress/i })).toContainText('2')

    // Complete only the first hike card
    const firstCard = inProgressPanel.locator('li', { hasText: firstDest })
    await firstCard.getByRole('button', { name: 'Hike completed' }).click()

    await expect(page.getByRole('status')).toContainText(`Safe arrival confirmed for "${firstDest}".`)
    await expect(page.getByRole('tab', { name: /In progress/i })).toContainText('1')
    await expect(inProgressPanel.getByText(firstDest)).toHaveCount(0)
    await expect(inProgressPanel.getByText(secondDest)).toBeVisible()
  })

  test('upcoming hikes do not display the Hike completed button', async ({ page }) => {
    const email = await newHiker(page.request)
    await logIn(page, email, PASSWORD)

    const tomorrow = dayFromToday(1)
    const destination = unique('Future Pass')
    await registerHikeViaApi(page.request, {
      destination,
      routeDescription: 'Planned tomorrow hike',
      departureAt: new Date(`${tomorrow}T09:00`).toISOString(),
      expectedReturnAt: new Date(`${tomorrow}T15:00`).toISOString(),
    })

    await page.goto('/my-hikes')

    const upcomingPanel = page.getByRole('tabpanel', { name: 'Upcoming hikes' })
    await expect(upcomingPanel.getByText(destination)).toBeVisible()
    await expect(upcomingPanel.getByRole('button', { name: 'Hike completed' })).toHaveCount(0)
  })

  test('shows an inline error when the hike was already completed elsewhere', async ({ page }) => {
    const email = await newHiker(page.request)
    await logIn(page, email, PASSWORD)

    const destination = unique('Double Click Ridge')
    const now = Date.now()
    const created = await registerHikeViaApi(page.request, {
      destination,
      routeDescription: 'Ridge path',
      departureAt: new Date(now + 800).toISOString(),
      expectedReturnAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
    })

    await page.waitForTimeout(1000)
    await page.goto('/my-hikes')

    const inProgressPanel = page.getByRole('tabpanel', { name: 'Hikes in progress' })
    await expect(inProgressPanel.getByText(destination)).toBeVisible()

    // Simulate completion from another tab/session before clicking in the UI
    const conflictRes = await page.request.patch(`/api/v1/hikes/${created.id}/complete`)
    expect(conflictRes.status()).toBe(200)

    await inProgressPanel.getByRole('button', { name: 'Hike completed' }).click()

    await expect(inProgressPanel.getByRole('alert')).toContainText('Hike already completed or cancelled')
  })

  test('enforces ownership and role authorization on hike completion', async ({ page, request }) => {
    const ownerEmail = await newHiker(request)
    await logIn(page, ownerEmail, PASSWORD)
    const now = Date.now()
    const created = await registerHikeViaApi(page.request, {
      destination: unique('Private Trail'),
      routeDescription: 'Owner only',
      departureAt: new Date(now + 1000).toISOString(),
      expectedReturnAt: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
    })

    // Another hiker cannot complete someone else's hike (404)
    const otherEmail = await newHiker(request)
    const otherLogin = await request.post('/api/v1/auth/login', {
      data: { email: otherEmail, password: PASSWORD },
    })
    expect(otherLogin.status()).toBe(200)
    const otherRes = await request.patch(`/api/v1/hikes/${created.id}/complete`)
    expect(otherRes.status()).toBe(404)

    // Staff cannot call hiker-only hike completion (403)
    const staffLogin = await request.post('/api/v1/auth/login', {
      data: { email: EMPLOYEE.email, password: EMPLOYEE.password },
    })
    expect(staffLogin.status()).toBe(200)
    const staffRes = await request.patch(`/api/v1/hikes/${created.id}/complete`)
    expect(staffRes.status()).toBe(403)
  })
})
