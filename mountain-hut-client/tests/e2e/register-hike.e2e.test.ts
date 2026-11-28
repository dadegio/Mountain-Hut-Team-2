import { randomUUID } from 'node:crypto'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { SUGGESTED_ROUTES } from '../../src/hikes/utils/suggested-routes.ts'
import { uniquePhone } from './test-data.ts'

// From the backend seed, see the server README
const EMPLOYEE = { email: 'test.employee@example.com', password: 'Password123!' }
const PASSWORD = 'Password123!'

// "YYYY-MM-DD" in local time, days away from today
function dayFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// A local "YYYY-MM-DDTHH:MM" as the instant the backend stores
const asIso = (local: string) => new Date(local).toISOString()

// Different for each test, so that runs don't clash with each other
const unique = (name: string) => `${name} ${randomUUID().slice(0, 8)}`

// A new hiker account, created through the API
async function newHiker(request: APIRequestContext) {
  const email = `e2e.hiker.${randomUUID()}@example.com`
  const res = await request.post('/api/v1/auth/register', {
    data: { email, password: PASSWORD, name: 'E2E', surname: 'Hiker', phoneNumber: uniquePhone() },
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

// Logs in as a new hiker and opens the register page
async function openAsNewHiker(page: Page) {
  const email = await newHiker(page.request)
  await logIn(page, email, PASSWORD)
  await page.getByRole('link', { name: 'Register a hike' }).click()
  await expect(page).toHaveURL(/\/hikes$/)
}

async function myHikes(page: Page) {
  const res = await page.request.get('/api/v1/hikes/mine')
  expect(res.status()).toBe(200)
  return res.json()
}

const field = {
  destination: (page: Page) => page.getByLabel('Destination', { exact: true }),
  route: (page: Page) => page.getByLabel('Route details'),
  stop: (page: Page) => page.getByLabel(/Stops along the way/),
  departure: (page: Page) => page.getByLabel('Departure', { exact: true }),
  expectedReturn: (page: Page) => page.getByLabel('Expected return'),
  contact: (page: Page) => page.getByLabel(/Emergency contact/),
}
const registerButton = (page: Page) => page.getByRole('button', { name: 'Register hike' })

test.describe('who can register a hike (MH-20)', () => {
  test('a guest is sent to the login', async ({ page }) => {
    await page.goto('/hikes')
    await expect(page).toHaveURL(/\/login/)

    await page.goto('/my-hikes')
    await expect(page).toHaveURL(/\/login/)
  })

  test('staff do not see the hike pages', async ({ page }) => {
    await logIn(page, EMPLOYEE.email, EMPLOYEE.password)
    await expect(page.getByRole('link', { name: 'Register a hike' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'My hikes' })).toHaveCount(0)

    await page.goto('/hikes')

    await expect(page).not.toHaveURL(/\/hikes$/)
    await expect(registerButton(page)).toHaveCount(0)
  })
})

test.describe('registering a hike (MH-20)', () => {
  test('registers a hike with its own route, stops and contact', async ({ page }) => {
    await openAsNewHiker(page)
    const day = dayFromToday(1)
    const destination = unique('Bivouac')
    const route = 'Up the valley path to the old bivouac and back the same way'

    await field.destination(page).fill(destination)
    await field.route(page).fill(route)
    await field.stop(page).fill('Old mill')
    await field.stop(page).press('Enter')
    await field.stop(page).fill('Bridge')
    await page.getByRole('button', { name: 'Add', exact: true }).click()
    await field.departure(page).fill(`${day}T08:00`)
    await page.getByRole('button', { name: '5 h', exact: true }).click()
    await field.contact(page).fill('+39 333 123 4567')

    await expect(field.expectedReturn(page)).toHaveValue(`${day}T13:00`)
    await expect(page.getByText(/out for 5 h/)).toBeVisible()

    await registerButton(page).click()

    await expect(page.getByRole('status')).toContainText(`Hike to ${destination} registered.`)
    await expect(field.destination(page)).toHaveValue('')

    // Saved for real, with the times as instants
    const saved = (await myHikes(page)).find(
      (hike: { destination: string }) => hike.destination === destination,
    )
    expect(saved).toMatchObject({
      routeDescription: route,
      intermediatePoints: ['Old mill', 'Bridge'],
      emergencyContactPhone: '+39 333 123 4567',
      departureAt: asIso(`${day}T08:00`),
      expectedReturnAt: asIso(`${day}T13:00`),
    })

    // And shown in My hikes
    await page.getByRole('link', { name: 'See my hikes' }).click()
    await expect(page).toHaveURL(/\/my-hikes/)
    const upcoming = page.getByRole('region', { name: 'Upcoming hikes' })
    await expect(upcoming.getByText(destination)).toBeVisible()
    await expect(upcoming.getByText('Via Old mill → Bridge')).toBeVisible()
    await expect(upcoming.getByText('Emergency contact: +39 333 123 4567')).toBeVisible()
  })

  test('registers a hike with a suggested route', async ({ page }) => {
    test.skip(SUGGESTED_ROUTES.length === 0, 'No suggested routes to choose from')
    const suggested = SUGGESTED_ROUTES[0]
    await openAsNewHiker(page)

    await page.getByRole('button', { name: new RegExp(suggested.name) }).click()

    await expect(field.destination(page)).toHaveValue(suggested.destination)
    await expect(field.route(page)).toHaveValue(suggested.description)
    const departure = await field.departure(page).inputValue()
    const expectedReturn = await field.expectedReturn(page).inputValue()
    expect(Date.parse(expectedReturn) - Date.parse(departure)).toBe(suggested.hours * 60 * 60 * 1000)

    await registerButton(page).click()

    await expect(page.getByRole('status')).toContainText(`Hike to ${suggested.destination} registered.`)
    const [saved] = await myHikes(page)
    expect(saved).toMatchObject({
      destination: suggested.destination,
      routeDescription: suggested.description,
      intermediatePoints: suggested.points,
    })
  })

  test('does not register an incomplete hike, and the error goes away when fixed', async ({ page }) => {
    await openAsNewHiker(page)

    await registerButton(page).click()

    await expect(page.getByRole('alert')).toHaveText('Enter your destination.')

    await field.destination(page).fill('Lake')
    await expect(page.getByRole('alert')).toHaveCount(0)

    expect(await myHikes(page)).toEqual([])
  })

  test('does not register a hike that returns before it departs', async ({ page }) => {
    await openAsNewHiker(page)
    const day = dayFromToday(1)

    await field.destination(page).fill('Lake')
    await field.route(page).fill('Lake loop')
    await field.departure(page).fill(`${day}T10:00`)
    await field.expectedReturn(page).fill(`${day}T09:00`)

    await expect(page.getByText('The expected return must be after the departure.')).toBeVisible()

    await registerButton(page).click()

    await expect(page.getByRole('alert')).toHaveText('Expected return must be after departure.')
    expect(await myHikes(page)).toEqual([])
  })

  test("a hiker does not see another hiker's hikes", async ({ page, request }) => {
    // Another hiker registers a hike, with their own API session
    const otherEmail = await newHiker(request)
    const login = await request.post('/api/v1/auth/login', {
      data: { email: otherEmail, password: PASSWORD },
    })
    expect(login.status()).toBe(200)
    const otherDestination = unique('Glacier')
    const day = dayFromToday(1)
    const created = await request.post('/api/v1/hikes', {
      data: {
        departureAt: asIso(`${day}T09:00`),
        expectedReturnAt: asIso(`${day}T15:00`),
        destination: otherDestination,
        routeDescription: 'Somewhere else',
      },
    })
    expect(created.status()).toBe(201)

    await openAsNewHiker(page)
    await page.getByRole('link', { name: 'My hikes' }).click()

    await expect(page.getByText("You haven't registered any hikes yet.")).toBeVisible()
    await expect(page.getByText(otherDestination)).toHaveCount(0)
  })

    test('does not register a hike that already departed', async ({ page }) => {
    await openAsNewHiker(page)
    const yesterday = dayFromToday(-1)

    await field.destination(page).fill('Lake')
    await field.route(page).fill('Lake loop')
    await field.departure(page).fill(`${yesterday}T08:00`)
    await field.expectedReturn(page).fill(`${yesterday}T12:00`)
    await registerButton(page).click()

    await expect(page.getByRole('alert')).toHaveText('Departure must be in the future.')
    expect(await myHikes(page)).toEqual([])
  })
})