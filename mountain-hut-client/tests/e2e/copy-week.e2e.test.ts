import { test, expect, type Page } from '@playwright/test'

// From the backend seed, see the server README
const EMPLOYEE = { email: 'test.employee@example.com', password: 'Password123!' }

// Date-only arithmetic in UTC, like the copy-week form and API
function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// "YYYY-MM-DD" in local time, days away from today
function dayFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// A far away Monday whose week and the three after it have no slots yet, so
// leftovers of earlier runs in a local database cannot get in the way. It
// starts beyond the days used by employee-slots.e2e.test.ts (365 to 3365).
async function freeMonday(page: Page): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const far = dayFromToday(4000 + Math.floor(Math.random() * 3000))
    const weekday = new Date(`${far}T00:00:00.000Z`).getUTCDay()
    const monday = addDays(far, -((weekday + 6) % 7))
    const days = Array.from({ length: 28 }, (_, i) => addDays(monday, i))
    const lists = await Promise.all(
      days.map(async (day) => (await page.request.get(`/api/v1/slots?date=${day}`)).json()),
    )
    if (lists.every((slots: unknown[]) => slots.length === 0)) return monday
  }
  throw new Error('No free weeks found: reseed the database')
}

async function openAsEmployee(page: Page) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(EMPLOYEE.email)
  await page.getByLabel('Password').fill(EMPLOYEE.password)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL(/\/employee\/slots/)
}

const slotsOfTheDay = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { name: 'Slots of the day' }) })
const copySection = (page: Page) =>
  page.locator('section', { has: page.getByRole('heading', { name: 'Copy weekly schedule' }) })
const copyButton = (page: Page) => page.getByRole('button', { name: 'Copy week' })
const dayField = (page: Page) => page.getByLabel('Day', { exact: true })
const tile = (page: Page, code: string) =>
  page.getByRole('button', { name: new RegExp(`^${code} `) })

async function chooseDay(page: Page, day: string) {
  await dayField(page).fill(day)
  await expect(dayField(page)).toHaveValue(day)
  await expect(slotsOfTheDay(page).getByText('Loading…')).toHaveCount(0)
}

async function createSlotOn(page: Page, day: string, from: string, to: string, tables: string[]) {
  await chooseDay(page, day)
  await page.getByLabel('Start').fill(from)
  await page.getByLabel('End').fill(to)
  await page.getByLabel('End').blur()
  for (const code of tables) await tile(page, code).click()
  await page.getByRole('button', { name: /^Create slot/ }).click()
  await expect(page.getByText(`Slot ${from}–${to} created`)).toBeVisible()
}

test.describe('copying a weekly schedule (MH-09)', () => {
  test.beforeEach(async ({ page }) => {
    await openAsEmployee(page)
  })

  test('repeats the slots and their tables in the following week', async ({ page }) => {
    const monday = await freeMonday(page)
    const wednesday = addDays(monday, 2)
    const target = addDays(monday, 7)

    await createSlotOn(page, monday, '12:00', '13:00', ['T1', 'T3'])
    await createSlotOn(page, wednesday, '19:00', '21:00', ['T2'])

    // The form follows the selected day: its week is the source, the next one the destination
    await expect(copySection(page).getByText(`Monday ${monday}`)).toBeVisible()
    await expect(copySection(page).getByText(`Monday ${target}`)).toBeVisible()

    await copyButton(page).click()

    await expect(page.getByText('Copied 2 slots into 1 week')).toBeVisible()

    // The page moves to the Monday of the destination week
    await expect(dayField(page)).toHaveValue(target)
    await expect(slotsOfTheDay(page).getByText('12:00–13:00')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('6 seats')).toBeVisible()

    // Same weekday, same time, same tables
    await chooseDay(page, addDays(target, 2))
    await expect(slotsOfTheDay(page).getByText('19:00–21:00')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('2 seats')).toBeVisible()

    // A day without slots in the source week stays empty
    await chooseDay(page, addDays(target, 1))
    await expect(slotsOfTheDay(page).getByText('No slots yet')).toBeVisible()

    // The source week is untouched
    await chooseDay(page, monday)
    await expect(slotsOfTheDay(page).getByText('12:00–13:00')).toBeVisible()

    // And hikers can book the copied slot
    const res = await page.request.get(`/api/v1/availability?date=${target}&partySize=6`)
    expect((await res.json()).slots[0]).toMatchObject({ availableSeats: 6, available: true })
  })

  test('repeats the week more than once', async ({ page }) => {
    const monday = await freeMonday(page)
    await createSlotOn(page, monday, '12:00', '14:00', ['T1'])

    await page.getByLabel('Number of weeks', { exact: true }).fill('2')
    await copyButton(page).click()

    await expect(page.getByText('Copied 2 slots into 2 weeks')).toBeVisible()

    await expect(dayField(page)).toHaveValue(addDays(monday, 7))
    await expect(slotsOfTheDay(page).getByText('12:00–14:00')).toBeVisible()

    await chooseDay(page, addDays(monday, 14))
    await expect(slotsOfTheDay(page).getByText('12:00–14:00')).toBeVisible()

    await chooseDay(page, addDays(monday, 21))
    await expect(slotsOfTheDay(page).getByText('No slots yet')).toBeVisible()
  })

  test('copies nothing when a destination slot overlaps', async ({ page }) => {
    const monday = await freeMonday(page)
    const tuesday = addDays(monday, 1)

    await createSlotOn(page, monday, '12:00', '14:00', ['T1'])
    await createSlotOn(page, tuesday, '12:00', '13:00', ['T2'])
    // Already in the destination week, overlapping the copy of Tuesday
    await createSlotOn(page, addDays(tuesday, 7), '12:30', '13:30', ['T3'])

    // Back to the source week, so that the form copies from it
    await chooseDay(page, monday)
    await copyButton(page).click()

    await expect(copySection(page).getByRole('alert')).toContainText(/overlaps/)
    await expect(page.getByText(/Copied \d+ slots/)).toHaveCount(0)
    await expect(dayField(page)).toHaveValue(monday)

    // Not even the Monday slot, which had no conflict, was copied
    await chooseDay(page, addDays(monday, 7))
    await expect(slotsOfTheDay(page).getByText('No slots yet')).toBeVisible()
  })

  test('says so when the source week has no slots', async ({ page }) => {
    await chooseDay(page, await freeMonday(page))

    await copyButton(page).click()

    await expect(copySection(page).getByRole('alert')).toContainText('Source week has no slots')
  })

  test('does not allow copying a week onto itself', async ({ page }) => {
    const monday = await freeMonday(page)
    await chooseDay(page, monday)

    await page.getByLabel('First destination week', { exact: true }).fill(addDays(monday, 3))

    await expect(page.getByText('Source and destination weeks cannot overlap.')).toBeVisible()
    await expect(copyButton(page)).toBeDisabled()
  })

  test('does not allow copying into the past', async ({ page }) => {
    // From two weeks ago, the suggested destination is last week
    await chooseDay(page, dayFromToday(-14))

    await expect(page.getByText('The destination week must not start in the past.')).toBeVisible()
    await expect(copyButton(page)).toBeDisabled()
  })

  test('only accepts 1 to 12 weeks', async ({ page }) => {
    const monday = await freeMonday(page)
    await createSlotOn(page, monday, '12:00', '13:00', ['T1'])
    const weeks = page.getByLabel('Number of weeks', { exact: true })

    for (const value of ['', '0', '13']) {
      await weeks.fill(value)
      await expect(copyButton(page)).toBeDisabled()
    }

    await weeks.fill('12')
    await expect(copyButton(page)).toBeEnabled()
  })
})