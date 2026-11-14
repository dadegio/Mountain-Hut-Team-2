import { randomUUID } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'

// From the backend seed, see the server README
const EMPLOYEE = { email: 'test.employee@example.com', password: 'Password123!' }

// "YYYY-MM-DD" in local time, days away from today
function dayFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// A far away day, different for each test, so that runs don't clash with each
// other or with the seed. Leaves room for the following day too.
function freeDay(): number {
  return 365 + Math.floor(Math.random() * 3000)
}

async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

async function openAsEmployee(page: Page) {
  await page.goto('/login')
  await logIn(page, EMPLOYEE.email, EMPLOYEE.password)
  await expect(page).toHaveURL(/\/employee\/slots/)
}

const slotsOfTheDay = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { name: 'Slots of the day' }) })
const tile = (page: Page, code: string) =>
  page.getByRole('button', { name: new RegExp(`^${code} `) })
const createButton = (page: Page) => page.getByRole('button', { name: /^Create slot/ })
const seatsSummary = (page: Page) => page.getByText(/· \d+ tables/).locator('..')

async function chooseDay(page: Page, day: string) {
  await page.getByLabel('Day', { exact: true }).fill(day)
  await expect(slotsOfTheDay(page).getByText('Loading…')).toHaveCount(0)
}

async function fillTimes(page: Page, from: string, to: string) {
  await page.getByLabel('Start').fill(from)
  await page.getByLabel('End').fill(to)
  await page.getByLabel('End').blur()
}

test.describe('who can open the page', () => {
  test('a guest is sent to the login and comes back after logging in', async ({ page }) => {
    await page.goto('/employee/slots')
    await expect(page).toHaveURL(/\/login/)

    await logIn(page, EMPLOYEE.email, EMPLOYEE.password)

    await expect(page).toHaveURL(/\/employee\/slots/)
    await expect(page.getByRole('heading', { name: 'Slots and tables' })).toBeVisible()
  })

  test('a hiker cannot open the page and does not see the link', async ({ page }) => {
    const email = `e2e.hiker.${randomUUID()}@example.com`
    const password = 'Password123!'
    const res = await page.request.post('/api/v1/auth/register', {
      data: { email, password, name: 'E2E', surname: 'Hiker', phoneNumber: '+393330000000' },
    })
    expect(res.status()).toBe(201)

    await page.goto('/login')
    await logIn(page, email, password)
    await expect(page).toHaveURL(/\/booking/)
    await expect(page.getByRole('link', { name: 'Manage slots' })).toHaveCount(0)

    await page.goto('/employee/slots')

    await expect(page).not.toHaveURL(/\/employee\/slots/)
    await expect(page.getByRole('heading', { name: 'Slots and tables' })).toHaveCount(0)
  })
})

test.describe('as an employee', () => {
  test.beforeEach(async ({ page }) => {
    await openAsEmployee(page)
  })

  test('creates a slot: seats add up and hikers can then book them', async ({ page }) => {
    const day = dayFromToday(freeDay())
    await chooseDay(page, day)
    await expect(slotsOfTheDay(page).getByText('No slots yet')).toBeVisible()
    await expect(seatsSummary(page)).toContainText('0 seats')

    // Typed times are tidied up when leaving the field
    await fillTimes(page, '930', '11.30')
    await expect(page.getByLabel('Start')).toHaveValue('09:30')
    await expect(page.getByLabel('End')).toHaveValue('11:30')

    await tile(page, 'T1').click()
    await expect(seatsSummary(page)).toContainText('2 seats')
    await tile(page, 'T3').click()
    await expect(seatsSummary(page)).toContainText('6 seats')

    await page.getByRole('button', { name: 'Create slot 09:30–11:30' }).click()

    await expect(page.getByText('Slot 09:30–11:30 created')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('09:30–11:30')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('6 seats')).toBeVisible()
    await expect(page.getByLabel('Start')).toHaveValue('')
    await expect(tile(page, 'T1')).toHaveAttribute('aria-pressed', 'false')

    // Saved for real: it is still there after reloading the page
    await page.reload()
    await chooseDay(page, day)
    await expect(slotsOfTheDay(page).getByText('09:30–11:30')).toBeVisible()

    // And it is what hikers can book: 6 seats fit, 7 do not
    const fits = await page.request.get(`/api/v1/availability?date=${day}&partySize=6`)
    expect((await fits.json()).slots[0]).toMatchObject({ availableSeats: 6, available: true })
    const tooMany = await page.request.get(`/api/v1/availability?date=${day}&partySize=7`)
    expect((await tooMany.json()).slots[0]).toMatchObject({ available: false })
  })

  test('uses a preset and selects all the tables', async ({ page }) => {
    await chooseDay(page, dayFromToday(freeDay()))

    await page.getByRole('button', { name: /^Dinner/ }).click()
    await page.getByRole('button', { name: 'All', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Create slot 19:00–21:00' })).toBeVisible()
    await expect(tile(page, 'T6')).toHaveAttribute('aria-pressed', 'true')

    await page.getByRole('button', { name: 'None', exact: true }).click()

    await expect(seatsSummary(page)).toContainText('0 seats')
    await expect(tile(page, 'T6')).toHaveAttribute('aria-pressed', 'false')
  })

  test('warns about a slot without tables, which then has 0 seats', async ({ page }) => {
    await chooseDay(page, dayFromToday(freeDay()))
    await expect(page.getByText('0 seats: nobody can book this slot')).toHaveCount(0)

    await fillTimes(page, '12:00', '13:00')
    await expect(page.getByText('0 seats: nobody can book this slot')).toBeVisible()

    await createButton(page).click()

    await expect(page.getByText('Slot 12:00–13:00 created')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('0 seats')).toBeVisible()
  })

  test('shows the errors of the backend and keeps what was entered', async ({ page }) => {
    await chooseDay(page, dayFromToday(freeDay()))
    await fillTimes(page, '12:00', '14:00')
    await tile(page, 'T1').click()
    await createButton(page).click()
    await expect(page.getByText('Slot 12:00–14:00 created')).toBeVisible()

    // Overlaps the slot just created
    await fillTimes(page, '13:00', '15:00')
    await tile(page, 'T2').click()
    await createButton(page).click()
    await expect(page.getByText('Slot overlaps with existing slot 12:00-14:00')).toBeVisible()
    await expect(page.getByLabel('Start')).toHaveValue('13:00')
    await expect(tile(page, 'T2')).toHaveAttribute('aria-pressed', 'true')

    // Ends before it starts
    await fillTimes(page, '18:00', '17:00')
    await createButton(page).click()
    await expect(page.getByText(/'from' must be before 'to'/)).toBeVisible()

    await expect(slotsOfTheDay(page).getByText('12:00–14:00')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('13:00–15:00')).toHaveCount(0)
  })

  test('marks an impossible time and does not create the slot', async ({ page }) => {
    await chooseDay(page, dayFromToday(freeDay()))

    await fillTimes(page, '25', '26')
    await expect(page.getByLabel('Start')).toHaveAttribute('aria-invalid', 'true')

    await createButton(page).click()

    await expect(page.getByText('Check the times')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('No slots yet')).toBeVisible()
  })

  test('cannot create a slot on a past day', async ({ page }) => {
    await chooseDay(page, dayFromToday(-1))

    await expect(page.getByText('This day is in the past')).toBeVisible()
    await expect(createButton(page)).toBeDisabled()
  })

  test('copies the tables of a slot of the previous day', async ({ page }) => {
    const offset = freeDay()
    await chooseDay(page, dayFromToday(offset))
    await fillTimes(page, '12:00', '13:00')
    await tile(page, 'T2').click()
    await tile(page, 'T4').click()
    await createButton(page).click()
    await expect(page.getByText('Slot 12:00–13:00 created')).toBeVisible()

    await chooseDay(page, dayFromToday(offset + 1))
    await expect(slotsOfTheDay(page).getByText('No slots yet')).toBeVisible()
    await expect(tile(page, 'T2')).toHaveAttribute('aria-pressed', 'false')

    await page.getByRole('button', { name: /Copy from another slot/ }).click()
    const source = page.getByRole('button', { name: /12:00–13:00 · 6 seats/ })
    await expect(source).toContainText('T2, T4')
    await source.click()

    await expect(tile(page, 'T2')).toHaveAttribute('aria-pressed', 'true')
    await expect(tile(page, 'T4')).toHaveAttribute('aria-pressed', 'true')
    await expect(tile(page, 'T1')).toHaveAttribute('aria-pressed', 'false')
    await expect(seatsSummary(page)).toContainText('6 seats')
    await expect(page.getByText(/Copied from .*12:00–13:00/)).toBeVisible()

    await fillTimes(page, '19:00', '20:00')
    await createButton(page).click()

    await expect(slotsOfTheDay(page).getByText('19:00–20:00')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('6 seats')).toBeVisible()
  })

  test('adds a table, which can then be selected, and refuses a duplicate code', async ({ page }) => {
    const code = `E${randomUUID().slice(0, 8)}`

    await page.getByLabel('Table code').fill(code)
    await page.getByLabel('Seats', { exact: true }).fill('5')
    await page.getByRole('button', { name: 'Add table' }).click()

    await expect(tile(page, code)).toBeVisible()
    await expect(page.getByLabel('Table code')).toHaveValue('')
    await tile(page, code).click()
    await expect(seatsSummary(page)).toContainText('5 seats')

    await page.getByLabel('Table code').fill(code)
    await page.getByLabel('Seats', { exact: true }).fill('3')
    await page.getByRole('button', { name: 'Add table' }).click()

    await expect(page.getByText(`Table code ${code} already exists`)).toBeVisible()
  })

  test('moves between days with the arrows', async ({ page }) => {
    const day = page.getByLabel('Day', { exact: true })
    await expect(day).toHaveValue(dayFromToday(0))

    await page.getByRole('button', { name: 'Next day' }).click()
    await expect(day).toHaveValue(dayFromToday(1))

    // The seed always creates slots for tomorrow
    await expect(slotsOfTheDay(page).getByText('12:00–13:00')).toBeVisible()

    await page.getByRole('button', { name: 'Previous day' }).click()
    await expect(day).toHaveValue(dayFromToday(0))
  })
})
