import { randomUUID } from 'node:crypto'
import { test, expect, type Page } from '@playwright/test'
import { uniquePhone } from './test-data.ts'
// From the backend seed, see the server README
const EMPLOYEE = { email: 'test.employee@example.com', password: 'Password123!' }

function dayFromToday(offset: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

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

async function chooseDay(page: Page, day: string) {
  await page.getByLabel('Day', { exact: true }).fill(day)
  await expect(slotsOfTheDay(page).getByText('Loading…')).toHaveCount(0)
}

async function fillTimes(page: Page, from: string, to: string) {
  await page.getByLabel('Start').fill(from)
  await page.getByLabel('End').fill(to)
  await page.getByLabel('End').blur()
}

test.describe('MH-10: Define menus — access control', () => {
  test('a guest trying to open Manage menus is redirected to login', async ({ page }) => {
    await page.goto('/employee/menus')
    await expect(page).toHaveURL(/\/login/)
  })

  test('a hiker cannot open Manage menus and does not see the link in the navigation', async ({ page }) => {
    const email = `e2e.hiker.${randomUUID()}@example.com`
    const password = 'Password123!'
    const res = await page.request.post('/api/v1/auth/register', {
      data: { email, password, name: 'E2E', surname: 'Hiker', phoneNumber:  uniquePhone() },
    })
    expect(res.status()).toBe(201)

    await page.goto('/login')
    await logIn(page, email, password)
    await expect(page).toHaveURL(/\/booking/)
    await expect(page.getByRole('link', { name: 'Manage menus' })).toHaveCount(0)

    await page.goto('/employee/menus')
    await expect(page).not.toHaveURL(/\/employee\/menus/)
    await expect(page.getByRole('heading', { name: 'Manage menus' })).toHaveCount(0)
  })

  test('a staff member sees Manage menus in navbar and can navigate to it', async ({ page }) => {
    await openAsEmployee(page)

    const menuLink = page.getByRole('link', { name: 'Manage menus' })
    await expect(menuLink).toBeVisible()
    await menuLink.click()

    await expect(page).toHaveURL(/\/employee\/menus/)
    await expect(page.getByRole('heading', { name: 'Manage menus' })).toBeVisible()
  })
})

test.describe('MH-10: Define menus — menu management', () => {
  test.beforeEach(async ({ page }) => {
    await openAsEmployee(page)
    await page.goto('/employee/menus')
    await expect(page.getByRole('heading', { name: 'Manage menus' })).toBeVisible()
  })

  test('browses default menus and displays their details in the editor', async ({ page }) => {
    const defaultSection = page.locator('section', { has: page.getByRole('heading', { name: 'Default menus' }) })

    // Seeded templates should be listed (at least 1 template)
    const firstTemplate = defaultSection.getByRole('button').first()
    await expect(firstTemplate).toBeVisible()
    const templateName = (await firstTemplate.textContent())?.trim() ?? ''
    expect(templateName.length).toBeGreaterThan(0)

    // Clicking the template loads it in the editor
    await firstTemplate.click()
    await expect(page.getByRole('heading', { name: `Customize ${templateName}` })).toBeVisible()
    await expect(page.getByLabel('Menu name')).toHaveValue(`${templateName} (custom)`)
    await expect(page.getByRole('button', { name: 'Save as custom menu' })).toBeVisible()
  })

  test('creates a new custom menu and verifies persistence across page reload', async ({ page }) => {
    const customSection = page.locator('section', { has: page.getByRole('heading', { name: 'Custom menus' }) })

    await page.getByRole('button', { name: '+ New menu' }).click()
    await expect(page.getByRole('heading', { name: 'New menu' })).toBeVisible()
    await expect(page.getByLabel('Menu name')).toHaveValue('')

    const customName = `Alpine Harvest ${randomUUID().slice(0, 8)}`
    await page.getByLabel('Menu name').fill(customName)

    // Select distinct dishes in course dropdowns
    await page.getByLabel('Course 1').selectOption({ index: 1 })
    await page.getByLabel('Course 2').selectOption({ index: 2 })

    await page.getByRole('button', { name: 'Create menu' }).click()

    // Success notice and sidebar entry
    await expect(page.getByRole('status')).toContainText(`Custom menu "${customName}" created.`)
    await expect(customSection.getByRole('button', { name: customName })).toBeVisible()

    // Reload page to verify backend persistence
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Manage menus' })).toBeVisible()
    await expect(customSection.getByRole('button', { name: customName })).toBeVisible()
  })

  test('customizes an existing template menu into a new modified menu', async ({ page }) => {
    const defaultSection = page.locator('section', { has: page.getByRole('heading', { name: 'Default menus' }) })
    const customSection = page.locator('section', { has: page.getByRole('heading', { name: 'Custom menus' }) })

    const firstTemplate = defaultSection.getByRole('button').first()
    await expect(firstTemplate).toBeVisible()
    const templateName = (await firstTemplate.textContent())?.trim() ?? ''
    await firstTemplate.click()

    await expect(page.getByRole('heading', { name: `Customize ${templateName}` })).toBeVisible()

    const customizedName = `Custom ${templateName.slice(0, 15)} ${randomUUID().slice(0, 8)}`
    await page.getByLabel('Menu name').fill(customizedName)

    await page.getByRole('button', { name: 'Save as custom menu' }).click()

    await expect(page.getByRole('status')).toContainText(`Custom menu "${customizedName}" created.`)
    await expect(customSection.getByRole('button', { name: customizedName })).toBeVisible()

    // The original template remains intact under default menus
    await expect(defaultSection.getByRole('button', { name: templateName })).toBeVisible()
  })

  test('validates menu form inputs before allowing submission', async ({ page }) => {
    await page.getByRole('button', { name: '+ New menu' }).click()

    // Blank name disables the create button
    const submitButton = page.getByRole('button', { name: 'Create menu' })
    await expect(submitButton).toBeDisabled()

    // Providing name without selecting any dish still keeps it disabled
    await page.getByLabel('Menu name').fill('Incomplete Menu')
    await expect(submitButton).toBeDisabled()

    // Selecting a course enables the button
    await page.getByLabel('Course 1').selectOption({ index: 1 })
    await expect(submitButton).toBeEnabled()
  })
})

test.describe('MH-10: Define menus — slot menu assignment', () => {
  test.beforeEach(async ({ page }) => {
    await openAsEmployee(page)
  })

  test('assigns an available menu when creating a slot', async ({ page }) => {
    const day = dayFromToday(freeDay())
    await chooseDay(page, day)
    await expect(slotsOfTheDay(page).getByText('No slots yet')).toBeVisible()

    await fillTimes(page, '12:00', '14:00')
    await tile(page, 'T1').click()

    // Open menus section in CreateSlotForm and select a menu
    const menuDetails = page.locator('details', { hasText: 'Select menus' })
    await expect(menuDetails).toBeVisible()
    await menuDetails.locator('summary').click()

    // Toggle the first available menu checkbox
    const firstMenuCheckbox = page.getByRole('group', { name: 'Menus for this slot' }).locator('input[type="checkbox"]').first()
    await expect(firstMenuCheckbox).toBeVisible()
    await firstMenuCheckbox.check()

    await page.getByRole('button', { name: 'Create slot 12:00–14:00' }).click()

    await expect(page.getByText('Slot 12:00–14:00 created')).toBeVisible()
    await expect(slotsOfTheDay(page).getByText('12:00–14:00')).toBeVisible()
  })
})
