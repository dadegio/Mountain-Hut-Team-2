import { randomUUID } from 'node:crypto'
import { test, expect, type APIRequestContext, type Page } from '@playwright/test'

// From the backend seed, see the server README
const EMPLOYEE = { email: 'test.employee@example.com', password: 'Password123!' }
const PASSWORD = 'Password123!'
const HUT_TIME_ZONE = 'Europe/Rome'

// The backend reads slot times as hut time, also when CI runs in UTC
test.use({ timezoneId: HUT_TIME_ZONE })

function hutNow() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: HUT_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  )
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  }
}

// "YYYY-MM-DD" of a far away day, different for each test, so that runs don't
// clash with each other or with the seed
function freeDay(): string {
  const d = new Date(`${hutNow().date}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 365 + Math.floor(Math.random() * 30000))
  return d.toISOString().slice(0, 10)
}

const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`

interface Hiker {
  name: string
  surname: string
  email: string
  phone: string
}

// A new hiker for each test: the search matches whole values, so they must be unique
async function registerHiker(request: APIRequestContext): Promise<Hiker> {
  const id = randomUUID().replaceAll('-', '').slice(0, 10)
  const hiker = {
    name: `Anna${id}`,
    surname: `Hiker${id}`,
    email: `e2e.hiker.${id}@example.com`,
    phone: `+39${String(Math.floor(Math.random() * 1e10)).padStart(10, '0')}`,
  }
  const res = await request.post('/api/v1/auth/register', {
    data: {
      email: hiker.email,
      password: PASSWORD,
      name: hiker.name,
      surname: hiker.surname,
      phone_number: hiker.phone,
    },
  })
  expect(res.status()).toBe(201)
  return hiker
}

async function logIn(page: Page, email: string, password: string) {
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Log in' }).click()
}

// Created through the API of the logged-in employee: returns the status, for
// the tests where another run may already have taken that time
async function postSlot(page: Page, date: string, from: string, to: string, tableCode: string) {
  const tables: { id: number; code: string }[] = await (await page.request.get('/api/v1/tables')).json()
  const table = tables.find((t) => t.code === tableCode)
  expect(table).toBeDefined()
  const res = await page.request.post('/api/v1/slots', {
    data: { date, from, to, tableIds: [table!.id] },
  })
  return res
}

async function createSlot(page: Page, date: string, from: string, to: string, tableCode = 'T3') {
  expect((await postSlot(page, date, from, to, tableCode)).status()).toBe(201)
  return `${from}–${to}`
}

async function chooseDay(page: Page, day: string) {
  await page.getByLabel('Day', { exact: true }).fill(day)
  await expect(page.getByText('Loading…')).toHaveCount(0)
}

const slotTile = (page: Page, time: string) =>
  page.getByRole('group', { name: 'Time slot' }).getByRole('button', { name: new RegExp(`^${time}`) })
const searchField = (page: Page) => page.getByLabel('Name, phone or email')
const reserveButton = (page: Page) => page.getByRole('button', { name: 'Reserve' })
const hikerResult = (page: Page, hiker: Hiker) =>
  page.getByRole('button', { name: new RegExp(`${hiker.name} ${hiker.surname}`) })

async function pickHiker(page: Page, hiker: Hiker, search = hiker.surname) {
  await searchField(page).fill(search)
  await hikerResult(page, hiker).click()
}

test.describe('who can open the page', () => {
  test('a guest is sent to the login and comes back after logging in', async ({ page }) => {
    await page.goto('/employee/reservations')
    await expect(page).toHaveURL(/\/login/)

    await logIn(page, EMPLOYEE.email, EMPLOYEE.password)

    await expect(page).toHaveURL(/\/employee\/reservations/)
    await expect(page.getByRole('heading', { name: 'New reservation' })).toBeVisible()
  })

  test('a hiker cannot open the page and does not see the link', async ({ page, request }) => {
    const hiker = await registerHiker(request)
    await page.goto('/login')
    await logIn(page, hiker.email, PASSWORD)
    await expect(page).toHaveURL(/\/booking/)
    await expect(page.getByRole('link', { name: 'New reservation' })).toHaveCount(0)

    await page.goto('/employee/reservations')

    await expect(page).not.toHaveURL(/\/employee\/reservations/)
    await expect(page.getByRole('heading', { name: 'New reservation' })).toHaveCount(0)
  })
})

test.describe('as an employee', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await logIn(page, EMPLOYEE.email, EMPLOYEE.password)
    await expect(page).toHaveURL(/\/employee\/slots/)
    await page.getByRole('link', { name: 'New reservation' }).click()
    await expect(page.getByRole('heading', { name: 'New reservation' })).toBeVisible()
  })

  test('reserves for a hiker and sees the table to show them', async ({ page, request }) => {
    const hiker = await registerHiker(request)
    const day = freeDay()
    const time = await createSlot(page, day, '12:00', '13:00')
    await chooseDay(page, day)

    // Who the hiker is only matters once there is a place for them
    await expect(page.getByText('Who', { exact: true })).toHaveCount(0)
    await expect(slotTile(page, time)).toContainText('4 seats free')
    await slotTile(page, time).click()
    await expect(reserveButton(page)).toBeDisabled()

    await pickHiker(page, hiker)
    await expect(page.getByText(`${hiker.name} ${hiker.surname}`)).toBeVisible()
    await reserveButton(page).click()

    await expect(page.getByText('✓ Reservation confirmed')).toBeVisible()
    await expect(page.getByText('T3 · 2 seats')).toBeVisible()
    await expect(page.getByText(new RegExp(`${hiker.name} ${hiker.surname} · 2 people`))).toBeVisible()

    // The seats are taken for real: the next reservation sees fewer of them
    await page.getByRole('button', { name: 'New reservation' }).click()
    await expect(slotTile(page, time)).toContainText('2 seats free')

    // And the booking belongs to the hiker, not to the employee
    const login = await request.post('/api/v1/auth/login', {
      data: { email: hiker.email, password: PASSWORD },
    })
    expect(login.status()).toBe(200)
    const bookings = await (await request.get('/api/v1/bookings/mine')).json()
    expect(bookings).toMatchObject([{ date: day, from: '12:00', partySize: 2, status: 'PLACED' }])
  })

  for (const [label, search] of [
    ['surname', (h: Hiker) => h.surname],
    ['name', (h: Hiker) => h.name],
    ['full name', (h: Hiker) => `${h.name} ${h.surname}`],
    ['full name, surname first', (h: Hiker) => `${h.surname} ${h.name}`],
    ['full name in lower case', (h: Hiker) => `${h.name} ${h.surname}`.toLowerCase()],
    ['email', (h: Hiker) => h.email],
    ['phone', (h: Hiker) => h.phone],
  ] as const) {
    test(`finds a hiker by ${label}`, async ({ page, request }) => {
      const hiker = await registerHiker(request)
      const day = freeDay()
      const time = await createSlot(page, day, '12:00', '13:00')
      await chooseDay(page, day)
      await slotTile(page, time).click()

      await searchField(page).fill(search(hiker))

      await expect(hikerResult(page, hiker)).toBeVisible()
      await expect(hikerResult(page, hiker)).toContainText(hiker.phone)
    })
  }

  test('finds nobody, and does not offer staff as hikers', async ({ page }) => {
    const day = freeDay()
    const time = await createSlot(page, day, '12:00', '13:00')
    await chooseDay(page, day)
    await slotTile(page, time).click()

    await searchField(page).fill(`Nobody${randomUUID()}`)
    await expect(page.getByText(/^No hiker found/)).toBeVisible()

    await searchField(page).fill(EMPLOYEE.email)
    await expect(page.getByText(/^No hiker found/)).toBeVisible()
    await expect(reserveButton(page)).toBeDisabled()
  })

  test('cannot choose a slot without enough seats, and can choose another', async ({ page }) => {
    const day = freeDay()
    const small = await createSlot(page, day, '12:00', '13:00', 'T1') // 2 seats
    const big = await createSlot(page, day, '19:00', '21:00', 'T6') // 8 seats
    await chooseDay(page, day)

    await page.getByLabel('People').fill('5')

    await expect(slotTile(page, small)).toBeDisabled()
    await expect(slotTile(page, big)).toBeEnabled()
    await expect(page.getByText(/No room/)).toHaveCount(0)

    await page.getByLabel('People').fill('9')

    await expect(slotTile(page, big)).toBeDisabled()
    await expect(page.getByText('No room for 9 people on this day: try another day')).toBeVisible()
  })

  test('says when a day has no slots', async ({ page }) => {
    await chooseDay(page, freeDay())

    await expect(page.getByText('No slots on this day')).toBeVisible()
  })

  test('reserves within 2 hours of the slot, which a hiker cannot do', async ({ page, request }) => {
    const now = hutNow()
    // The next 2 hours must still be today
    test.skip(now.minutes > 23 * 60 + 30, 'Too close to midnight')

    // A slot of one minute, starting soon: other runs may have taken some times
    let time = ''
    let slotId = 0
    const latest = Math.min(now.minutes + 110, 23 * 60 + 58)
    for (let attempt = 0; attempt < 20 && !time; attempt++) {
      const start = now.minutes + 5 + Math.floor(Math.random() * (latest - now.minutes - 5))
      const res = await postSlot(page, now.date, toTime(start), toTime(start + 1), 'T3')
      if (res.status() === 201) {
        time = `${toTime(start)}–${toTime(start + 1)}`
        slotId = (await res.json()).id
      }
    }
    expect(time, 'no free time found today').not.toBe('')

    const hiker = await registerHiker(request)
    const login = await request.post('/api/v1/auth/login', {
      data: { email: hiker.email, password: PASSWORD },
    })
    expect(login.status()).toBe(200)
    const refused = await request.post('/api/v1/bookings', { data: { slotId, partySize: 2 } })
    expect(refused.status()).toBe(409)

    // The page opens on today, and loaded its slots before this one existed
    await page.reload()
    await chooseDay(page, now.date)
    await slotTile(page, time).click()
    await pickHiker(page, hiker)
    await reserveButton(page).click()

    await expect(page.getByText('✓ Reservation confirmed')).toBeVisible()
  })

  // MH-07: staff cannot book after the beginning of the slot
  test('cannot choose a slot that has already started', async ({ page }) => {
    const now = hutNow()
    // The slot must start and end today
    test.skip(now.minutes < 1 || now.minutes > 23 * 60 + 57, 'Too close to midnight')

    // A slot running now. Other runs may have one already: the test then uses it
    for (const [from, to] of [
      [now.minutes - 1, now.minutes + 1],
      [now.minutes, now.minutes + 1],
    ]) {
      const res = await postSlot(page, now.date, toTime(from), toTime(to), 'T3')
      expect([201, 409]).toContain(res.status())
      if (res.status() === 201) break
    }
    const slots: { from: string; to: string }[] = await (
      await page.request.get(`/api/v1/slots?date=${now.date}`)
    ).json()
    const nowTime = toTime(now.minutes)
    const running = slots.find((slot) => slot.from <= nowTime && nowTime < slot.to)
    test.skip(!running, 'No slot could be created at this time')
    const time = `${running!.from}–${running!.to}`
    // The page opens on today, and loaded its slots before this one existed
    await page.reload()
    await chooseDay(page, now.date)

    await expect(slotTile(page, time)).toBeDisabled()
    await expect(slotTile(page, time)).toContainText('Started')
  })

  test('cannot choose a slot that has ended', async ({ page }) => {
    const now = hutNow()
    test.skip(now.minutes < 2, 'The slot of this test has not ended yet')

    // Another run may have created it already: it is the same slot
    const res = await postSlot(page, now.date, '00:00', '00:01', 'T3')
    expect([201, 409]).toContain(res.status())
    // The page opens on today, and loaded its slots before this one existed
    await page.reload()
    await chooseDay(page, now.date)

    await expect(slotTile(page, '00:00–00:01')).toBeDisabled()
    await expect(slotTile(page, '00:00–00:01')).toContainText('Started')
  })

  test('shows the error of the backend when the hiker already has a booking', async ({ page, request }) => {
    const hiker = await registerHiker(request)
    const day = freeDay()
    const time = await createSlot(page, day, '12:00', '13:00', 'T6')
    await chooseDay(page, day)
    await slotTile(page, time).click()
    await pickHiker(page, hiker)
    await reserveButton(page).click()
    await page.getByRole('button', { name: 'New reservation' }).click()

    await slotTile(page, time).click()
    await pickHiker(page, hiker)
    await reserveButton(page).click()

    await expect(page.getByText(/already have a booking/)).toBeVisible()
    await expect(page.getByText('✓ Reservation confirmed')).toHaveCount(0)
    await expect(reserveButton(page)).toBeEnabled()
  })

  // Not available yet: to be replaced by real tests with MH-20 and the new account
  test('shows the other two options as not available', async ({ page }) => {
    const day = freeDay()
    const time = await createSlot(page, day, '12:00', '13:00')
    await chooseDay(page, day)
    await slotTile(page, time).click()

    for (const [option, field] of [
      ['New account', 'Email'],
      ['Just a name', 'Phone (optional)'],
    ]) {
      await page.getByRole('button', { name: option }).click()

      await expect(page.getByText('Not available yet')).toBeVisible()
      await expect(page.getByLabel(field)).toBeDisabled()
      await expect(reserveButton(page)).toBeDisabled()
    }
  })

  test('moves to another day, and forgets the chosen slot', async ({ page, request }) => {
    const hiker = await registerHiker(request)
    const day = freeDay()
    const time = await createSlot(page, day, '12:00', '13:00')
    await chooseDay(page, day)
    await slotTile(page, time).click()
    await pickHiker(page, hiker)

    await page.getByRole('button', { name: 'Next day' }).click()

    await expect(page.getByText('No slots on this day')).toBeVisible()
    await expect(reserveButton(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Previous day' }).click()

    await expect(slotTile(page, time)).toHaveAttribute('aria-pressed', 'false')
  })
})
